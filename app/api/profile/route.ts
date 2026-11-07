import { NextResponse } from 'next/server'
import {
  MISSING_MIGRATION_MESSAGE,
  dispatchSecret,
  isMissingSchema,
  json,
  requireUser,
} from '@/lib/apiAuth'
import { validateProfile, type ProfileErrors } from '@/lib/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMPTY_PROFILE = {
  fullName: '',
  phone: '',
  phoneCountry: 'KE',
  smsOptIn: false,
}

function profileFromRow(row: {
  full_name?: string | null
  phone_e164?: string | null
  phone_country?: string | null
  sms_opt_in?: boolean | null
  target_roles?: string[] | null
} | null) {
  return {
    fullName: row?.full_name ?? '',
    phone: row?.phone_e164 ?? '',
    phoneCountry: row?.phone_country ?? 'KE',
    smsOptIn: Boolean(row?.sms_opt_in),
    targetRoles: Array.isArray(row?.target_roles) ? row.target_roles : [],
  }
}

function mapProfileError(error: { code?: string; message?: string }) {
  if (isMissingSchema(error)) {
    return { status: 503, message: MISSING_MIGRATION_MESSAGE }
  }
  const message = error.message ?? ''
  if (error.code === '23505' || /phone in use/i.test(message)) {
    return { status: 409, message: 'That mobile number is already on another account.' }
  }
  if (/invalid name/i.test(message)) {
    return { status: 400, message: 'Check your name and try again.' }
  }
  if (error.code === '22023' || /invalid phone/i.test(message)) {
    return { status: 400, message: 'Enter a valid mobile number.' }
  }
  if (error.code === '42501' && /unauthorized/i.test(message)) {
    return { status: 401, message: 'Session expired — please sign in again.' }
  }
  return { status: 500, message: 'Could not save your profile.' }
}

export async function GET(req: Request) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  let { data, error } = await auth.supabase
    .from('profiles')
    .select('full_name, phone_e164, phone_country, sms_opt_in, target_roles')
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (error?.code === '42703') {
    const fallback = await auth.supabase
      .from('profiles')
      .select('full_name, phone_e164, phone_country, sms_opt_in')
      .eq('user_id', auth.user.id)
      .maybeSingle()
    data = fallback.data ? { ...fallback.data, target_roles: null } : null
    error = fallback.error
  }

  if (error) {
    if (isMissingSchema(error)) {
      return json(req, { error: 'migration_required', message: MISSING_MIGRATION_MESSAGE }, 503)
    }
    console.error('Profile read failed:', error.code ?? 'unknown')
    return json(req, { error: 'db_error', message: 'Could not load your profile.' }, 500)
  }

  return json(req, {
    email: auth.user.email ?? '',
    ...profileFromRow(data),
  })
}

export async function PUT(req: Request) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  const secret = dispatchSecret()
  if (!secret) {
    return json(req, { error: 'not_configured', message: 'Profile saving is not configured.' }, 500)
  }

  const body = await req.json().catch(() => null)
  if (
    !body ||
    typeof body !== 'object' ||
    typeof body.fullName !== 'string' ||
    typeof body.phone !== 'string' ||
    typeof body.phoneCountry !== 'string' ||
    typeof body.smsOptIn !== 'boolean'
  ) {
    return json(req, { error: 'invalid', message: 'Check the form and try again.' }, 400)
  }

  const { errors, value } = validateProfile({
    fullName: body.fullName,
    phone: body.phone,
    phoneCountry: body.phoneCountry,
    smsOptIn: body.smsOptIn,
  })

  if (!value) {
    return json(req, { error: 'invalid', message: 'Check the highlighted fields.', errors }, 400)
  }

  const { data, error } = await auth.supabase.rpc('save_profile', {
    p_full_name: value.fullName,
    p_phone_e164: value.phoneE164,
    p_phone_country: value.phoneCountry,
    p_sms_opt_in: value.smsOptIn,
    p_dispatch_secret: secret,
  })

  if (error) {
    const mapped = mapProfileError(error)
    if (mapped.status === 400 && /name/i.test(mapped.message)) {
      const fieldErrors: ProfileErrors = { fullName: mapped.message }
      return json(req, { error: 'invalid', message: mapped.message, errors: fieldErrors }, 400)
    }
    if (mapped.status === 400 || mapped.status === 409) {
      const fieldErrors: ProfileErrors = { phone: mapped.message }
      return json(req, { error: 'invalid', message: mapped.message, errors: fieldErrors }, mapped.status)
    }
    console.error('Profile save failed:', error.code ?? 'unknown', error.message)
    return json(req, { error: 'save_failed', message: mapped.message }, mapped.status)
  }

  const saved = (data ?? EMPTY_PROFILE) as {
    fullName?: string | null
    phone?: string | null
    phoneCountry?: string | null
    smsOptIn?: boolean
  }

  return json(req, {
    email: auth.user.email ?? '',
    fullName: saved.fullName ?? '',
    phone: saved.phone ?? '',
    phoneCountry: saved.phoneCountry ?? 'KE',
    smsOptIn: Boolean(saved.smsOptIn),
  })
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
