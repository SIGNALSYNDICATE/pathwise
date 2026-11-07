import { NextResponse } from 'next/server'
import {
  MISSING_MIGRATION_MESSAGE,
  corsHeaders,
  dispatchSecret,
  isMissingSchema,
  json,
  requireUser,
} from '@/lib/apiAuth'
import { asSmsAlert, deliverAlert } from '@/lib/smsDelivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: Request) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  const secret = dispatchSecret()
  if (!secret) {
    return json(req, { error: 'not_configured', message: 'Text alerts are not configured.' }, 500)
  }

  const body = await req.json().catch(() => null)
  const applicationId = body?.applicationId
  if (typeof applicationId !== 'string' || !UUID.test(applicationId)) {
    return json(req, { error: 'invalid', message: 'A valid application id is required.' }, 400)
  }

  const { data, error } = await auth.supabase.rpc('claim_peer_application_alerts', {
    p_application_id: applicationId,
    p_dispatch_secret: secret,
  })

  if (error) {
    if (isMissingSchema(error)) {
      return json(req, { error: 'migration_required', message: MISSING_MIGRATION_MESSAGE }, 503)
    }
    console.error('Peer alert claim failed:', error.code ?? 'unknown')
    return json(req, { error: 'sms_failed', message: 'Could not send text alerts.' }, 500)
  }

  const claim = (data ?? {}) as { status?: string; alerts?: unknown[] }
  if (claim.status === 'not_found') {
    return json(req, { error: 'not_found', message: 'Application not found.' }, 404)
  }

  let notified = 0
  let failed = 0
  for (const item of claim.alerts ?? []) {
    const alert = asSmsAlert(item)
    if (!alert) {
      failed += 1
      continue
    }
    const sent = await deliverAlert(auth.supabase, secret, alert)
    if (sent) notified += 1
    else failed += 1
  }

  return json(req, { notified, failed })
}
