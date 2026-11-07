'use client'

import { useState } from 'react'
import {
  Sparkles,
  AlertTriangle,
  TrendingDown,
  Target,
  ListChecks,
  Loader2,
  RefreshCw,
  FileText,
  ShieldAlert,
} from 'lucide-react'
import { fetchCareerInsights, type Diagnosis } from '@/lib/careerInsights'
import type { SupabaseClient } from '@supabase/supabase-js'

interface Props {
  supabase: SupabaseClient
  cvText?: string
  jobDescription?: string
}

export default function CareerDiagnosis({ supabase, cvText, jobDescription }: Props) {
  const [data, setData] = useState<Diagnosis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const result = await fetchCareerInsights(supabase, {
        cv_text: cvText,
        job_description: jobDescription,
      })
      setData(result.diagnosis)
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ── Empty / initial state ──────────────────────────────
  if (!data && !loading && !error) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0a3a3a] p-6">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="h-5 w-5 text-[#e67600]" />
          <h2 className="text-lg font-semibold">AI Career Diagnosis</h2>
        </div>
        <p className="mt-2 text-sm text-gray-300">
          Let Gemma analyze your application history and CV to find where you&apos;re losing opportunities.
        </p>
        <button
          onClick={run}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#e67600] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#cf6900]"
        >
          <Sparkles className="h-4 w-4" /> Get AI Feedback
        </button>
      </div>
    )
  }

  // ── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0a3a3a] p-6">
        <Loader2 className="h-5 w-5 animate-spin text-[#e67600]" />
        <span className="text-sm text-gray-300">Gemma is analyzing your application data…</span>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
        <div className="flex items-center gap-2 text-red-300">
          <AlertTriangle className="h-5 w-5" />
          <strong>Couldn&apos;t generate diagnosis</strong>
        </div>
        <p className="mt-1 text-sm text-red-200">{error}</p>
        <button
          onClick={run}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-red-300 underline hover:text-red-200"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  // ── Success state ──────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Sample-size warning */}
      {data.data_quality.sample_size_warning && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Only {data.data_quality.total_apps} application
            {data.data_quality.total_apps === 1 ? '' : 's'} recorded — treat these insights as early signals,
            not reliable trends.
          </span>
        </div>
      )}

      {/* Performance Summary */}
      <section className="rounded-2xl border border-white/10 bg-[#0a3a3a] p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white">
          <Sparkles className="h-4 w-4 text-[#e67600]" /> Performance Summary
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-200">{data.performance_summary}</p>
      </section>

      {/* Bottleneck */}
      <section className="rounded-2xl border border-white/10 bg-[#0a3a3a] p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white">
          <TrendingDown className="h-4 w-4 text-rose-400" /> Where you&apos;re losing opportunities
        </h3>
        <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
          {data.bottleneck.stage.replaceAll('_', ' ')}
        </p>
        <p className="mt-2 text-sm text-gray-200">{data.bottleneck.explanation}</p>
        {typeof data.bottleneck.measured_rate === 'number' && (
          <p className="mt-2 text-sm font-medium text-white">
            Measured conversion: {data.bottleneck.measured_rate}%
          </p>
        )}
      </section>

      {/* Possible Causes */}
      {data.possible_causes.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#0a3a3a] p-6">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            <Target className="h-4 w-4 text-emerald-400" /> Possible causes
          </h3>
          <ul className="mt-3 space-y-3">
            {data.possible_causes.map((c, i) => (
              <li key={i} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-white">{c.hypothesis}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                      c.confidence === 'high'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : c.confidence === 'medium'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-white/10 text-gray-300'
                    }`}
                  >
                    {c.confidence}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-300">
                  <strong className="text-gray-200">Evidence:</strong> {c.evidence}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CV Issues */}
      {data.cv_issues.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#0a3a3a] p-6">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            <FileText className="h-4 w-4 text-[#e67600]" /> CV improvements
          </h3>
          <ul className="mt-3 space-y-3">
            {data.cv_issues.map((c, i) => (
              <li key={i} className="border-l-2 border-[#e67600]/40 pl-3">
                <p className="text-sm font-medium text-white">{c.issue}</p>
                <p className="mt-1 text-sm text-gray-300">{c.suggestion}</p>
                {c.example_rewrite && (
                  <pre className="mt-2 whitespace-pre-wrap rounded bg-black/40 p-2 text-xs text-emerald-300">
                    {c.example_rewrite}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Action Plan */}
      {data.action_plan.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#0a3a3a] p-6">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            <ListChecks className="h-4 w-4 text-[#e67600]" /> Prioritized action plan
          </h3>
          <ol className="mt-3 space-y-3">
            {[...data.action_plan]
              .sort((a, b) => a.priority - b.priority)
              .map((a) => (
                <li key={a.priority} className="flex gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#e67600] text-xs font-bold text-white">
                    {a.priority}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{a.action}</p>
                    <p className="text-xs text-gray-400">{a.why}</p>
                  </div>
                </li>
              ))}
          </ol>
        </section>
      )}

      {/* Limitations */}
      {data.limitations.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-200">
            <ShieldAlert className="h-4 w-4 text-gray-400" /> What this analysis can&apos;t tell you
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-400">
            {data.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}