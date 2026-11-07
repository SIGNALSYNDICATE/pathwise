export type JobApplicationInput = {
  company?: string | null
  role?: string | null
  resume_data?: string | null
  job_description?: string | null
  date_applied?: string | null
}

export type TargetJobInput = {
  title?: string | null
  description?: string | null
}

export type SearchProfile = {
  titles: string[]
  keywords: string[]
  targetTitles: string[]
}

export type RecommendedJob = {
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

export type RecommendationResult = {
  count: number
  profile: SearchProfile
  jobs: RecommendedJob[]
}

export class InsufficientProfileError extends Error {
  constructor() {
    super('Add a target role during onboarding, or add an application or resume, before we can recommend jobs.')
    this.name = 'InsufficientProfileError'
  }
}

export class JobBoardsUnavailableError extends Error {
  constructor() {
    super('Job boards are unavailable right now. Try again shortly.')
    this.name = 'JobBoardsUnavailableError'
  }
}

const CACHE_TTL_MS = 5 * 60 * 1000
const MIN_SCORE = 30
const MAX_JOBS = 40
const MAX_SEARCH_TITLES = 4
const FETCH_TIMEOUT_MS = 8000

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'this', 'that', 'from',
  'have', 'has', 'had', 'will', 'not', 'but', 'all', 'can', 'any', 'job', 'role',
  'work', 'team', 'company', 'experience', 'years', 'year', 'using', 'use', 'used',
  'skills', 'skill', 'ability', 'able', 'including', 'include', 'etc', 'per', 'via',
  'into', 'over', 'than', 'then', 'them', 'they', 'their', 'was', 'were', 'been',
  'being', 'about', 'across', 'after', 'before', 'between', 'within', 'without',
  'also', 'such', 'other', 'more', 'most', 'some', 'each', 'both', 'who', 'what',
  'when', 'where', 'which', 'while', 'how', 'why', 'its', 'out', 'off', 'too',
  'very', 'just', 'like', 'make', 'made', 'well', 'good', 'great', 'new', 'one',
  'two', 'plus', 'based', 'related', 'strong', 'excellent', 'looking', 'seek',
  'seeking', 'join', 'please', 'must', 'should', 'would', 'could', 'may', 'might',
  'need', 'needs', 'required', 'requirements', 'responsibility', 'responsibilities',
  'description', 'position', 'candidate', 'candidates', 'apply', 'application',
  'opportunity', 'full', 'time', 'part', 'remote', 'hybrid', 'onsite', 'location',
  'responsibilities', 'qualifications', 'preferred', 'bonus', 'about', 'our',
  'we', 'us', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'by', 'or', 'as', 'is',
  'be', 'it', 'if', 'so', 'do', 'did', 'done', 'working', 'worked', 'help',
  'across', 'within', 'including', 'through', 'during', 'under', 'over',
])

type RawJob = {
  id: string
  title: string
  company: string
  location: string
  remote: boolean
  postedAt: string | null
  applyUrl: string
  source: 'remotive' | 'arbeitnow'
  description: string
  tags: string[]
}

const cache = new Map<string, { expires: number; value: RecommendationResult }>()

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function usableText(value: string | null | undefined): string {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('%PDF') || trimmed.startsWith('data:application/pdf')) return ''
  const letters = (trimmed.match(/[a-zA-Z]/g) || []).length
  if (trimmed.length > 200 && !trimmed.includes(' ') && letters / trimmed.length < 0.5) return ''
  return stripHtml(trimmed).slice(0, 20000)
}

function tokens(text: string): string[] {
  return stripHtml(text)
    .toLowerCase()
    .split(/[^a-z0-9+#./-]+/)
    .map((token) => token.replace(/^[.#/+-]+|[.#/+-]+$/g, ''))
    .filter((token) => token.length >= 3 && token.length <= 32 && !STOPWORDS.has(token) && !/^\d+$/.test(token))
}

function uniqueTitles(values: string[]): string[] {
  const titles: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const title = value.trim()
    if (title.length < 2) continue
    const key = normalize(title)
    if (seen.has(key)) continue
    seen.add(key)
    titles.push(title)
  }
  return titles
}

export function buildSearchProfile(
  apps: JobApplicationInput[],
  targets: TargetJobInput[] = []
): SearchProfile {
  const targetTitles = uniqueTitles(targets.map((target) => target.title || ''))

  const titleCounts = new Map<string, { label: string; count: number }>()
  for (const app of apps) {
    const role = (app.role || '').trim()
    if (role.length < 2) continue
    const key = normalize(role)
    const existing = titleCounts.get(key)
    if (existing) existing.count += 1
    else titleCounts.set(key, { label: role, count: 1 })
  }

  const applicationTitles = [...titleCounts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((entry) => entry.label)

  const titles = uniqueTitles([...targetTitles, ...applicationTitles]).slice(0, MAX_SEARCH_TITLES)

  const withResume = apps
    .filter((app) => usableText(app.resume_data).length > 0)
    .sort((a, b) => (b.date_applied || '').localeCompare(a.date_applied || ''))
  const resume = usableText(withResume[0]?.resume_data)
  const descriptions = [
    ...apps.map((app) => usableText(app.job_description)),
    ...targets.map((target) => usableText(target.description)),
  ]
    .filter(Boolean)
    .join(' ')

  const freq = new Map<string, number>()
  for (const token of tokens(`${resume} ${descriptions}`)) {
    freq.set(token, (freq.get(token) || 0) + 1)
  }

  const keywords = [...freq.entries()]
    .filter(([, count]) => resume.length < 400 || count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([token]) => token)

  for (const title of titles) {
    for (const token of tokens(title)) {
      if (!keywords.includes(token)) keywords.push(token)
    }
  }
  for (const token of tokens(targets.map((target) => target.description || '').join(' '))) {
    if (!keywords.includes(token)) keywords.push(token)
    if (keywords.length >= 48) break
  }

  if (titles.length === 0 && keywords.length === 0) {
    throw new InsufficientProfileError()
  }

  return { titles, keywords: keywords.slice(0, 48), targetTitles }
}

function toIso(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Pathwise/1.0 (job recommendations)',
      },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function asList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null)
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
}

async function fetchRemotive(query: string): Promise<RawJob[]> {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=40`
  const payload = asRecord(await fetchJson(url))
  return asList(payload?.jobs)
    .map((job) => {
      const title = stringField(job, 'title')
      const applyUrl = stringField(job, 'url')
      if (!title || !applyUrl) return null
      const tags = Array.isArray(job.tags) ? job.tags.filter((tag): tag is string => typeof tag === 'string') : []
      return {
        id: `remotive-${String(job.id ?? applyUrl)}`,
        title,
        company: stringField(job, 'company_name') || 'Unknown company',
        location: stringField(job, 'candidate_required_location') || 'Remote',
        remote: true,
        postedAt: toIso(job.publication_date),
        applyUrl,
        source: 'remotive' as const,
        description: stringField(job, 'description'),
        tags,
      }
    })
    .filter((job): job is RawJob => job !== null)
}

async function fetchArbeitnow(): Promise<RawJob[]> {
  const payload = asRecord(await fetchJson('https://www.arbeitnow.com/api/job-board-api'))
  return asList(payload?.data)
    .map((job) => {
      const title = stringField(job, 'title')
      const applyUrl = stringField(job, 'url')
      if (!title || !applyUrl) return null
      const tags = Array.isArray(job.tags) ? job.tags.filter((tag): tag is string => typeof tag === 'string') : []
      return {
        id: `arbeitnow-${stringField(job, 'slug') || applyUrl}`,
        title,
        company: stringField(job, 'company_name') || 'Unknown company',
        location: stringField(job, 'location') || (job.remote ? 'Remote' : 'Unspecified'),
        remote: Boolean(job.remote),
        postedAt: toIso(job.created_at),
        applyUrl,
        source: 'arbeitnow' as const,
        description: stringField(job, 'description'),
        tags,
      }
    })
    .filter((job): job is RawJob => job !== null)
}

function alreadyApplied(job: RawJob, apps: JobApplicationInput[]): boolean {
  const company = normalize(job.company)
  const title = normalize(job.title)
  const titleTokens = new Set(tokens(job.title))
  if (!company) return false

  return apps.some((app) => {
    const appCompany = normalize(app.company || '')
    const appTitle = normalize(app.role || '')
    if (!appCompany || appCompany !== company || !appTitle) return false
    if (appTitle === title) return true
    const appTokens = tokens(app.role || '')
    if (appTokens.length === 0) return false
    const overlap = appTokens.filter((token) => titleTokens.has(token)).length
    return overlap / appTokens.length >= 0.6
  })
}

function scoreJob(job: RawJob, profile: SearchProfile): { score: number; matchedTerms: string[] } {
  const titleTokens = tokens(job.title)
  const haystack = new Set<string>([
    ...titleTokens,
    ...tokens(job.description).slice(0, 500),
    ...job.tags.flatMap((tag) => tokens(tag)),
  ])
  const matched = new Set<string>()

  let titlePoints = 0
  for (const target of profile.titles) {
    const targetTokens = tokens(target)
    if (targetTokens.length === 0) continue
    const hits = targetTokens.filter((token) =>
      titleTokens.some(
        (titleToken) =>
          titleToken === token ||
          (token.length >= 5 && (titleToken.startsWith(token) || token.startsWith(titleToken)))
      )
    )
    hits.forEach((token) => matched.add(token))
    const ratio = hits.length / targetTokens.length
    const exact = normalize(job.title) === normalize(target)
    const points = exact ? 60 : Math.round(ratio * 50)
    if (points > titlePoints) titlePoints = points
  }

  const keywordHits = profile.keywords.filter((keyword) => haystack.has(keyword))
  keywordHits.forEach((keyword) => matched.add(keyword))
  const denominator = Math.min(Math.max(profile.keywords.length, 1), 12)
  let keywordPoints = Math.min(40, Math.round((keywordHits.length / denominator) * 40))
  if (profile.titles.length === 0) {
    keywordPoints = Math.min(80, keywordPoints * 2)
  }

  let recency = 0
  if (job.postedAt) {
    const days = (Date.now() - new Date(job.postedAt).getTime()) / 86_400_000
    if (days >= 0 && days <= 7) recency = 8
    else if (days <= 30) recency = 4
  }

  const score = Math.max(0, Math.min(100, titlePoints + keywordPoints + recency))
  return { score, matchedTerms: [...matched].slice(0, 8) }
}

function cacheKey(userId: string, apps: JobApplicationInput[], targets: TargetJobInput[], profile: SearchProfile): string {
  return [
    userId,
    profile.titles.join('|'),
    profile.targetTitles.join('|'),
    profile.keywords.slice(0, 12).join('|'),
    String(apps.length),
    String(targets.length),
  ].join('::')
}

export async function recommendJobs(
  userId: string,
  apps: JobApplicationInput[],
  targets: TargetJobInput[] = []
): Promise<RecommendationResult> {
  const profile = buildSearchProfile(apps, targets)
  const key = cacheKey(userId, apps, targets, profile)
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.value

  const queries = profile.titles.length > 0 ? profile.titles : [profile.keywords.slice(0, 4).join(' ')]
  const settled = await Promise.allSettled([
    ...queries.filter(Boolean).map((query) => fetchRemotive(query)),
    fetchArbeitnow(),
  ])

  const listings = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  if (listings.length === 0 && settled.every((result) => result.status === 'rejected')) {
    throw new JobBoardsUnavailableError()
  }

  const seen = new Set<string>()
  const jobs: RecommendedJob[] = []

  for (const listing of listings) {
    const dedupeKey = `${normalize(listing.company)}|${normalize(listing.title)}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    if (alreadyApplied(listing, apps)) continue

    const { score, matchedTerms } = scoreJob(listing, profile)
    if (score < MIN_SCORE) continue

    jobs.push({
      id: listing.id,
      title: listing.title,
      company: listing.company,
      location: listing.location,
      remote: listing.remote,
      postedAt: listing.postedAt,
      applyUrl: listing.applyUrl,
      source: listing.source,
      score,
      matchedTerms,
    })
  }

  jobs.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (b.postedAt || '').localeCompare(a.postedAt || '')
  })

  const value: RecommendationResult = {
    count: Math.min(jobs.length, MAX_JOBS),
    profile: {
      titles: profile.titles,
      keywords: profile.keywords.slice(0, 12),
      targetTitles: profile.targetTitles,
    },
    jobs: jobs.slice(0, MAX_JOBS),
  }

  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value })
  return value
}
