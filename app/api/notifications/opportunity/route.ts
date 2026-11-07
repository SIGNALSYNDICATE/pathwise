import {
  MISSING_MIGRATION_MESSAGE,
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

export async function POST(req: Request) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  const secret = dispatchSecret()
  if (!secret) {
    return json(req, { sent: false, reason: 'not_configured' }, 500)
  }

  const body = await req.json().catch(() => null)
  const advertisementId = body?.advertisementId
  if (typeof advertisementId !== 'string' || !UUID.test(advertisementId)) {
    return json(req, { error: 'invalid', message: 'A valid opportunity id is required.' }, 400)
  }

  const { data, error } = await auth.supabase.rpc('claim_opportunity_alert', {
    p_advertisement_id: advertisementId,
    p_dispatch_secret: secret,
  })

  if (error) {
    if (isMissingSchema(error)) {
      return json(req, { sent: false, reason: 'migration_required', message: MISSING_MIGRATION_MESSAGE }, 503)
    }
    console.error('Opportunity alert claim failed:', error.code ?? 'unknown', error.message)
    return json(req, { sent: false, reason: 'sms_failed' }, 500)
  }

  const claim = (data ?? {}) as { status?: string; alerts?: unknown[] }
  if (claim.status === 'not_found') {
    console.log('[sms] opportunity skipped', { reason: 'not_found' })
    return json(req, { notified: 0, failed: 0, reason: 'not_found' }, 404)
  }

  const alerts = claim.alerts ?? []
  console.log('[sms] opportunity recipients', { count: alerts.length })

  let notified = 0
  let failed = 0
  for (const item of alerts) {
    const alert = asSmsAlert(item)
    if (!alert) {
      failed += 1
      continue
    }
    const sent = await deliverAlert(auth.supabase, secret, alert)
    if (sent) notified += 1
    else failed += 1
  }

  return json(req, {
    notified,
    failed,
    reason: alerts.length === 0 ? 'no_recipients' : notified > 0 ? 'sent' : 'sms_failed',
  }, failed > 0 && notified === 0 ? 502 : 200)
}
