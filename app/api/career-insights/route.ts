import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 60

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Base Supabase config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aofvzgqksbhgljzowyby.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvZnZ6Z3Frc2JoZ2xqem93eWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MzAxMTEsImV4cCI6MjA3MDAwNjExMX0.XA4xgMqrMy9finlY9xvOhPdrQIsKYlRGmrNx_1D6db4'

type Diagnosis = {
  performance_summary: string
  bottleneck: {
    stage: 'application_to_interview' | 'interview_to_offer' | 'offer_to_hire' | 'insufficient_data'
    explanation: string
    measured_rate?: number
  }
  possible_causes: { hypothesis: string; evidence: string; confidence: 'low' | 'medium' | 'high' }[]
  cv_issues: { issue: string; suggestion: string; example_rewrite?: string }[]
  action_plan: { priority: number; action: string; why: string }[]
  limitations: string[]
  data_quality: { total_apps: number; apps_with_outcomes: number; sample_size_warning: boolean }
}

export async function POST(req: Request) {
  try {
    // ── 1. Auth ─────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Missing auth token.' },
        { status: 401 }
      )
    }

    // Create a per-request Supabase client that includes the user's token.
    // This allows RLS to evaluate auth.uid() correctly during the SELECT query.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Session expired — please sign in again.' },
        { status: 401 }
      )
    }

    // ── 2. Fetch applications ───────────────────────────
    const { data: apps, error } = await supabase
      .from('job_applications')
      .select('*')
      .eq('user_id', user.id)

    // Keep this log until you confirm the data loads, then you can remove it.
    console.log('=== DEBUG career-insights ===')
    console.log('Auth user.id:', user.id)
    console.log('DB error:', error)
    console.log('Apps returned count:', apps?.length ?? 0)
    console.log('==============================')

    if (error) {
      console.error('DB error:', error)
      return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })
    }

    // ── 3. Metrics ──────────────────────────────────────
    const metrics = computeMetrics(apps ?? [])
    if (metrics.total_apps === 0) {
      return NextResponse.json(
        {
          error: 'insufficient_data',
          message: 'Add a few job applications first so the AI has something to analyze.',
        },
        { status: 422 }
      )
    }

    // ── 4. Optional CV + JD ─────────────────────────────
    const body = await req.json().catch(() => ({}))
    const cv_text: string | undefined = body.cv_text
    const job_description: string | undefined = body.job_description

    // ── 5. Call OpenAI ──────────────────────────────────
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'config_error', message: 'OPENAI_API_KEY is not set on the server.' },
        { status: 500 }
      )
    }

    const prompt = buildPrompt(metrics, apps ?? [], cv_text, job_description)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    })

    const content: string = completion.choices[0].message.content ?? '{}'

    if (!content || content === '{}') {
      console.error('OpenAI returned no content:', JSON.stringify(completion).slice(0, 500))
      return NextResponse.json(
        {
          error: 'ai_empty',
          message: 'OpenAI returned an empty response. Try again.',
        },
        { status: 502 }
      )
    }

    // ── 6. Parse + sanitize ─────────────────────────────
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : {}
    }

    const safe = sanitize(parsed, metrics)
    return NextResponse.json({ diagnosis: safe, metrics })
    
  } catch (e: any) {
    console.error('career-insights unexpected error:', e)

    if (e?.status === 401) {
      return NextResponse.json(
        { error: 'ai_failed', message: 'OpenAI API key is invalid or lacks access.' },
        { status: 502 }
      )
    }
    if (e?.status === 429) {
      return NextResponse.json(
        { error: 'ai_failed', message: 'OpenAI rate limit reached. Wait a minute and retry.' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { error: 'ai_failed', message: e?.message ?? 'Unknown error.' },
      { status: 500 }
    )
  }
}

// ─────────────────────────── Helpers ───────────────────────────

function computeMetrics(apps: any[]) {
  const total = apps.length
  const statusOf = (a: any): string => {
    if (a.application_status) return a.application_status
    if (a.got_job) return 'hired'
    if (a.offered) return 'offered'
    if (a.interviewed) return 'interview'
    return 'applied'
  }

  const withOutcome = apps.filter((a) => statusOf(a) !== 'applied').length
  const interviews = apps.filter((a) => ['interview', 'offered', 'hired'].includes(statusOf(a))).length
  const offers = apps.filter((a) => ['offered', 'hired'].includes(statusOf(a))).length
  const hired = apps.filter((a) => statusOf(a) === 'hired').length
  const rejected = apps.filter((a) => statusOf(a) === 'rejected').length
  const withdrawn = apps.filter((a) => statusOf(a) === 'withdrawn').length
  const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10)

  return {
    total_apps: total,
    apps_with_outcomes: withOutcome,
    interviews,
    offers,
    hired,
    rejected,
    withdrawn,
    app_to_interview: pct(interviews, total),
    interview_to_offer: pct(offers, interviews),
    hire_rate: pct(hired, total),
    small_sample: total < 10,
  }
}

function buildPrompt(metrics: any, apps: any[], cv?: string, jd?: string) {
  const statusOf = (a: any): string => {
    if (a.application_status) return a.application_status
    if (a.got_job) return 'hired'
    if (a.offered) return 'offered'
    if (a.interviewed) return 'interview'
    return 'applied'
  }

  const log = apps.slice(0, 30).map((a) => ({
    company: a.company,
    role: a.role,
    status: statusOf(a),
    date: a.date_applied,
    mood: a.mood,
    expectation: a.application_expectation,
    rejection_reason: a.rejection_reason ?? null,
    interview_feedback: a.interview_feedback ?? null,
    has_cv: !!a.resume_data,
  }))

  return `You are Pathwise, a careful career analyst. Analyze the user's job-search data and return ONLY valid JSON.

MEASURED METRICS (facts — use these exactly, do NOT invent numbers):
${JSON.stringify(metrics, null, 2)}

APPLICATION LOG (most recent first):
${JSON.stringify(log, null, 2)}

${cv ? `USER CV TEXT (excerpt):\n"""\n${cv.slice(0, 4000)}\n"""` : 'No CV provided by the user.'}
${jd ? `TARGET JOB DESCRIPTION (excerpt):\n"""\n${jd.slice(0, 2000)}\n"""` : 'No target job description provided.'}

STRICT RULES:
1. Separate FACTS (numbers/statuses from metrics/log) from HYPOTHESES (your inference).
2. If total_apps < 10, set data_quality.sample_size_warning=true and phrase conclusions cautiously.
3. NEVER claim to know an employer's rejection reason unless it appears verbatim in rejection_reason.
4. CV suggestions must NOT invent achievements, metrics, or technologies. If evidence is missing, write "add real, verifiable detail here".
5. Bottleneck = the stage with the lowest meaningful conversion rate. If n is too small, use "insufficient_data".
6. performance_summary: 2-4 sentences.
7. possible_causes: 2-4 items, each tied to a specific number or logged event.
8. action_plan: 3-5 prioritized items (priority 1 = highest).
9. limitations: at least 2 items describing what the data cannot tell you.

Return EXACTLY this JSON shape:
{
  "performance_summary": "string",
  "bottleneck": {
    "stage": "application_to_interview" | "interview_to_offer" | "offer_to_hire" | "insufficient_data",
    "explanation": "string",
    "measured_rate": number
  },
  "possible_causes": [
    { "hypothesis": "string", "evidence": "string", "confidence": "low" | "medium" | "high" }
  ],
  "cv_issues": [
    { "issue": "string", "suggestion": "string", "example_rewrite": "string" }
  ],
  "action_plan": [
    { "priority": 1, "action": "string", "why": "string" }
  ],
  "limitations": ["string"],
  "data_quality": {
    "total_apps": number,
    "apps_with_outcomes": number,
    "sample_size_warning": boolean
  }
}`
}

function sanitize(d: any, metrics: any): Diagnosis {
  return {
    performance_summary:
      typeof d?.performance_summary === 'string' ? d.performance_summary : 'Analysis unavailable.',
    bottleneck: {
      stage: d?.bottleneck?.stage ?? 'insufficient_data',
      explanation: d?.bottleneck?.explanation ?? 'Not enough data to identify a bottleneck.',
      measured_rate: metrics.app_to_interview ?? undefined,
    },
    possible_causes: Array.isArray(d?.possible_causes) ? d.possible_causes : [],
    cv_issues: Array.isArray(d?.cv_issues) ? d.cv_issues : [],
    action_plan: Array.isArray(d?.action_plan) ? d.action_plan : [],
    limitations:
      Array.isArray(d?.limitations) && d.limitations.length > 0
        ? d.limitations
        : ['Limited data — conclusions are preliminary.'],
    data_quality: {
      total_apps: metrics.total_apps,
      apps_with_outcomes: metrics.apps_with_outcomes,
      sample_size_warning: metrics.small_sample,
    },
  }
}