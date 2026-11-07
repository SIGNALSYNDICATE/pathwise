'use client'

import { useState } from 'react'
import { Sparkles, Loader2, FileText, CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ResumeOptimizerResult {
  overall_feedback: string
  missing_keywords: string[]
  improvements: { section: string; original_text: string; suggested_rewrite: string }[]
  optimized_cv: string
}

export default function ResumeInsights({ applications }: { applications: any[] }) {
  // Only show applications that actually have resume data saved
  const appsWithResumes = applications.filter(a => a.resume_data && a.resume_data.trim().length > 10)
  
  const [selectedAppId, setSelectedAppId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResumeOptimizerResult | null>(null)

  const handleOptimize = async () => {
    const selectedApp = appsWithResumes.find(a => a.id === selectedAppId)
    if (!selectedApp) {
      setError('Please select an application with a saved CV first.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expired. Please log in again.')

      const res = await fetch('/api/resume-optimizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          cv_text: selectedApp.resume_data,
          job_description: selectedApp.job_description || '',
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to optimize resume.')
      
      setResult(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // If the user hasn't saved any resumes in the database yet
  if (appsWithResumes.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0a3a3a] p-6 space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#e67600]" /> Resume Optimizer
        </h2>
        <p className="text-sm text-gray-400">
          You don't have any CVs saved to your applications yet. Add a job application and include your CV text to use the AI optimizer.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a3a3a] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#e67600]" /> Resume Optimizer
        </h2>
      </div>

      {!result && !loading && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">
            Select a saved application. AI will analyze the CV you used for that job and optimize it against the target Job Description.
          </p>
          
          <select
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            className="w-full rounded-lg bg-black/20 border border-white/10 p-3 text-sm text-white focus:border-[#e67600] focus:outline-none appearance-none cursor-pointer"
          >
            <option value="" disabled>Select an application...</option>
            {appsWithResumes.map((app) => (
              <option key={app.id} value={app.id}>
                {app.company} — {app.role} ({new Date(app.date_applied).toLocaleDateString()})
              </option>
            ))}
          </select>

          <button
            onClick={handleOptimize}
            disabled={!selectedAppId}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#e67600] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#cf6900] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="h-4 w-4" /> Optimize with AI
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[#e67600]" />
          <span className="text-sm text-gray-300">AI is rewriting your CV...</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="rounded-lg bg-black/20 p-3 border border-white/10">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Overall Feedback</h3>
            <p className="text-sm text-gray-200">{result.overall_feedback}</p>
          </div>

          {result.missing_keywords.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Missing ATS Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {result.missing_keywords.map((kw, i) => (
                  <span key={i} className="rounded bg-[#e67600]/20 px-2 py-1 text-xs text-[#e67600]">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.improvements.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Bullet Point Upgrades</h3>
              <div className="space-y-3">
                {result.improvements.map((imp, i) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs text-red-300/80 line-through mb-1">{imp.original_text}</p>
                    <p className="text-sm text-emerald-300 flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {imp.suggested_rewrite}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Full Optimized CV</h3>
              <button 
                onClick={() => navigator.clipboard.writeText(result.optimized_cv)}
                className="text-xs text-[#e67600] hover:underline"
              >
                Copy to clipboard
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-gray-300 font-mono max-h-64 overflow-y-auto">
              {result.optimized_cv}
            </pre>
          </div>

          <button
            onClick={() => setResult(null)}
            className="w-full rounded-lg border border-white/20 py-2 text-sm text-gray-300 hover:bg-white/5 transition"
          >
            Optimize another CV
          </button>
        </div>
      )}
    </div>
  )
}