import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://job-dash-ashy.vercel.app',
  'https://34c9-105-164-69-197.ngrok-free.app',
])

export const MISSING_MIGRATION_MESSAGE =
  'Profiles and text alerts are not available yet. Apply the latest database migration, then try again.'

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || ''
  const allowed = ALLOWED_ORIGINS.has(origin) || origin.startsWith('chrome-extension://')
  if (!allowed) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function json(req: Request, body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...corsHeaders(req),
      'Cache-Control': 'private, no-store',
    },
  })
}

export function isMissingSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === '42883' || error.code === 'PGRST202' || error.code === 'PGRST205') {
    return true
  }
  const message = error.message ?? ''
  return /schema cache|does not exist|could not find the function|could not find the table/i.test(message)
}

export async function requireUser(
  req: Request
): Promise<{ supabase: SupabaseClient; user: User } | { response: NextResponse }> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) {
    return { response: json(req, { error: 'unauthorized', message: 'Missing auth token.' }, 401) }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return {
      response: json(req, { error: 'unauthorized', message: 'Session expired — please sign in again.' }, 401),
    }
  }

  return { supabase, user }
}

export function dispatchSecret(): string | null {
  const secret = process.env.SMS_DISPATCH_SECRET?.trim() ?? ''
  if (secret.length < 32) return null
  return secret
}
