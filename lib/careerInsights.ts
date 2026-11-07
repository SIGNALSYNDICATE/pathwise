import type { SupabaseClient } from '@supabase/supabase-js'

export type Diagnosis = {
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

export type CareerInsightsResult = {
  diagnosis: Diagnosis
  metrics: {
    total_apps: number
    apps_with_outcomes: number
    interviews: number
    offers: number
    hired: number
    app_to_interview: number | null
    interview_to_offer: number | null
    hire_rate: number | null
    small_sample: boolean
  }
}

export async function fetchCareerInsights(
  supabase: SupabaseClient,
  payload: { cv_text?: string; job_description?: string }
): Promise<CareerInsightsResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expired — please sign in again.')

  const res = await fetch('/api/career-insights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  let json: any = {}
  try {
    json = await res.json()
  } catch {
    // non-JSON response
  }

  if (res.status === 401) throw new Error(json.message ?? 'Session expired — please sign in again.')
  if (res.status === 422) throw new Error(json.message ?? 'Not enough data yet — add a few applications first.')
  if (!res.ok) throw new Error(json.message ?? 'AI service unavailable. Try again shortly.')

  return json as CareerInsightsResult
}