import { NextResponse } from 'next/server'
import { dispatchSecret, isMissingSchema, json, MISSING_MIGRATION_MESSAGE, requireUser } from '@/lib/apiAuth'
import { normalizeTargetRoles } from '@/lib/targetRoles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PUT(req: Request) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  const secret = dispatchSecret()
  if (!secret) {
    return json(req, { error: 'not_configured', message: 'Saving target roles is not configured.' }, 500)
  }

  const body = await req.json().catch(() => null)
  const { roles, error } = normalizeTargetRoles(body && typeof body === 'object' ? body.roles : null)
  if (!roles) {
    return json(req, { error: 'invalid', message: error }, 400)
  }

  const { data, error: saveError } = await auth.supabase.rpc('save_target_roles', {
    p_roles: roles,
    p_dispatch_secret: secret,
  })

  if (saveError) {
    if (isMissingSchema(saveError)) {
      return json(req, { error: 'migration_required', message: MISSING_MIGRATION_MESSAGE }, 503)
    }
    if (saveError.code === '22023' || /invalid target role/i.test(saveError.message ?? '')) {
      return json(req, { error: 'invalid', message: 'Check the target roles and try again.' }, 400)
    }
    console.error('Target role save failed:', saveError.code ?? 'unknown', saveError.message)
    return json(req, { error: 'save_failed', message: 'Could not save your target roles.' }, 500)
  }

  const saved = data as { targetRoles?: unknown } | null
  const targetRoles = Array.isArray(saved?.targetRoles)
    ? saved.targetRoles.filter((role): role is string => typeof role === 'string')
    : roles

  return json(req, { targetRoles })
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
