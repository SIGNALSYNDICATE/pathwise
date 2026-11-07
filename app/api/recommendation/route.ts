import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  InsufficientProfileError,
  JobBoardsUnavailableError,
  recommendJobs,
} from '@/lib/jobRecommendations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://job-dash-ashy.vercel.app',
])

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || ''
  const allowed =
    ALLOWED_ORIGINS.has(origin) || origin.startsWith('chrome-extension://')
  if (!allowed) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(req: Request, body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...corsHeaders(req),
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return json(req, { error: 'unauthorized', message: 'Missing auth token.' }, 401)
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return json(
        req,
        { error: 'unauthorized', message: 'Session expired — please sign in again.' },
        401
      )
    }

    // job_description is added by a migration that is not on every database yet.
    // PostgREST rejects the whole query when a selected column is missing.
    let { data: apps, error } = await supabase
      .from('job_applications')
      .select('company, role, resume_data, job_description, date_applied')
      .eq('user_id', user.id)

    if (error?.code === '42703') {
      const fallback = await supabase
        .from('job_applications')
        .select('company, role, resume_data, date_applied')
        .eq('user_id', user.id)
      apps = fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('Recommendation DB error:', error)
      return json(req, { error: 'db_error', message: 'Could not load your applications.' }, 500)
    }

    const result = await recommendJobs(user.id, apps || [])
    return json(req, result)
  } catch (error) {
    if (error instanceof InsufficientProfileError) {
      return json(req, { error: 'insufficient_profile', message: error.message }, 422)
    }
    if (error instanceof JobBoardsUnavailableError) {
      return json(req, { error: 'boards_unavailable', message: error.message }, 502)
    }
    console.error('Recommendation error:', error)
    return json(req, { error: 'server_error', message: 'Could not load recommendations.' }, 500)
  }
}
