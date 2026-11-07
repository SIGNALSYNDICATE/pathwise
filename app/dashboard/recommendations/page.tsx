'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Briefcase, ExternalLink, MapPin, Search } from 'lucide-react'
<<<<<<< Updated upstream
import { supabase } from '@/lib/supabase'
=======
import { createClient } from '@supabase/supabase-js'
import TargetRolesForm from '../components/TargetRolesForm'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
>>>>>>> Stashed changes

type RecommendedJob = {
  id: string
  title: string
  company: string
  location: string
  remote: boolean
  postedAt: string | null
  applyUrl: string
  source: 'remotive' | 'arbeitnow'
  score: number
  matchedTerms: string[]
}

type RecommendationResponse = {
  count: number
  profile: { titles: string[]; keywords: string[]; targetTitles?: string[] }
  jobs: RecommendedJob[]
}

function formatPosted(value: string | null) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RecommendationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emptyProfile, setEmptyProfile] = useState(false)
  const [result, setResult] = useState<RecommendationResponse | null>(null)
  const [query, setQuery] = useState('')
  const [minScore, setMinScore] = useState(30)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        window.location.href = '/'
        return
      }

      try {
        const response = await fetch('/api/recommendation', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const body = await response.json().catch(() => ({}))
        if (cancelled) return

        if (response.status === 422) {
          setEmptyProfile(true)
          setError(body.message || 'Add a few applications or a resume before we can recommend roles.')
          return
        }
        if (!response.ok) {
          setError(body.message || 'Could not load recommendations.')
          return
        }
        setResult(body as RecommendationResponse)
      } catch {
        if (!cancelled) setError('Could not load recommendations.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const jobs = useMemo(() => {
    const list = result?.jobs ?? []
    const needle = query.trim().toLowerCase()
    return list.filter((job) => {
      if (job.score < minScore) return false
      if (!needle) return true
      const haystack = [job.title, job.company, job.location, ...job.matchedTerms].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [result, query, minScore])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-[#052525] text-white">
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center gap-4">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-orange-200 hover:text-white text-sm mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white">Recommended jobs</h1>
            <p className="text-orange-200 text-sm">
              {result
                ? `${result.count} roles matched to your target roles, applications, and CV`
                : 'Roles matched to your target roles, applications, and CV'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/profile"
              className="border border-white/30 text-white hover:border-[#e67600] hover:text-[#e67600] px-5 py-2 rounded-lg font-semibold transition-colors"
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="bg-[#e67600] hover:bg-[#d46900] text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {loading && (
          <div className="min-h-[40vh] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e67600]" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-white/10 border border-white/20 rounded-xl p-8 text-center space-y-3">
            <p className="text-lg font-semibold">{emptyProfile ? 'Nothing to match yet' : 'Recommendations unavailable'}</p>
            <p className="text-orange-100/80 max-w-xl mx-auto">{error}</p>
            {emptyProfile && (
              <div className="max-w-xl mx-auto text-left pt-2">
                <TargetRolesForm
                  initialRoles={[]}
                  onSaved={() => {
                    setError(null)
                    setEmptyProfile(false)
                    setLoading(true)
                    setReloadKey((current) => current + 1)
                  }}
                />
              </div>
            )}
          </div>
        )}

        {!loading && result && (
          <>
            <div className="bg-white/10 border border-white/20 rounded-xl p-4 flex flex-col lg:flex-row gap-4 lg:items-end">
              <label className="flex-1 block">
                <span className="text-orange-200 text-sm">Search</span>
                <span className="mt-1 flex items-center gap-2 bg-white/5 border border-white/20 rounded-lg px-3">
                  <Search className="h-4 w-4 text-orange-200" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Title, company, or skill"
                    className="w-full bg-transparent py-2 outline-none text-white placeholder:text-white/40"
                  />
                </span>
              </label>
              <label className="block min-w-[200px]">
                <span className="text-orange-200 text-sm">Minimum match {minScore}%</span>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={10}
                  value={minScore}
                  onChange={(event) => setMinScore(Number(event.target.value))}
                  className="w-full mt-3 accent-[#e67600]"
                />
              </label>
            </div>

            {result.profile.titles.length > 0 && (
              <p className="text-sm text-orange-100/80">
                {(result.profile.targetTitles?.length ?? 0) > 0
                  ? `Targets: ${result.profile.targetTitles?.join(', ')}. `
                  : ''}
                Searching {result.profile.titles.join(', ')}
                {result.profile.keywords.length > 0 ? ` · ${result.profile.keywords.slice(0, 6).join(', ')}` : ''}
              </p>
            )}

            {jobs.length === 0 ? (
              <div className="bg-white/10 border border-white/20 rounded-xl p-8 text-center">
                <p className="text-lg font-semibold">No roles at this filter</p>
                <p className="text-orange-100/80 mt-2">Lower the match threshold or clear the search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {jobs.map((job) => (
                  <article
                    key={job.id}
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20 hover:border-[#e67600]/50 transition-colors flex flex-col gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold leading-snug">{job.title}</h2>
                        <p className="text-orange-200 mt-1 flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          {job.company}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#e67600] text-white text-sm font-bold px-3 py-1">
                        {job.score}%
                      </span>
                    </div>

                    <p className="text-sm text-white/80 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-orange-200" />
                      {job.location}
                      {job.remote ? ' · Remote' : ''}
                      <span className="text-white/40">·</span>
                      {formatPosted(job.postedAt)}
                    </p>

                    {job.matchedTerms.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {job.matchedTerms.map((term) => (
                          <span
                            key={term}
                            className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/15 text-orange-100"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto pt-1">
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#e67600] hover:text-orange-300"
                      >
                        Apply
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
