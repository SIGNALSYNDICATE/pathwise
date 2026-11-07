export const TITLE_MIN = 2
export const TITLE_MAX = 160
export const DESCRIPTION_MAX = 8000
export const LINK_MAX = 2000
export const DUPLICATE_OPPORTUNITY_MESSAGE = 'You already saved this opportunity.'

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|gbraid$|wbraid$|mc_cid$|mc_eid$|igshid$|_ga$)/i

export type JobAdvertisement = {
  id: string
  user_id: string
  title: string
  company: string
  description: string | null
  link: string | null
  deadline: string | null
  dedupe_key: string
  created_at: string
  updated_at: string
}

export type OpportunityDraft = {
  title: string
  company: string
  description: string
  link: string
  deadline: string
}

export type OpportunityField = keyof OpportunityDraft
export type FieldErrors = Partial<Record<OpportunityField, string>>

export type PreparedOpportunity = {
  title: string
  company: string
  description: string | null
  link: string | null
  deadline: string | null
  dedupe_key: string
}

export function emptyDraft(): OpportunityDraft {
  return { title: '', company: '', description: '', link: '', deadline: '' }
}

export function draftFromAdvertisement(ad: JobAdvertisement): OpportunityDraft {
  return {
    title: ad.title,
    company: ad.company,
    description: ad.description ?? '',
    link: ad.link ?? '',
    deadline: ad.deadline ?? '',
  }
}

export function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function normalizeListingUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  if (!url.hostname || !url.hostname.includes('.')) return null

  url.hash = ''
  url.hostname = url.hostname.toLowerCase()

  const kept = [...url.searchParams.entries()].filter(([key]) => !TRACKING_PARAM.test(key))
  kept.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
  url.search = ''
  for (const [key, value] of kept) {
    url.searchParams.append(key, value)
  }

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }

  return url.toString()
}

export function buildDedupeKey(input: {
  title: string
  company: string
  link?: string | null
}): string {
  const normalizedLink = input.link ? normalizeListingUrl(input.link) : null
  if (normalizedLink) return `url:${normalizedLink}`
  return `role:${normalizeLabel(input.company)}|${normalizeLabel(input.title)}`
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function validateOpportunity(draft: OpportunityDraft): {
  errors: FieldErrors
  value: PreparedOpportunity | null
} {
  const errors: FieldErrors = {}
  const title = draft.title.trim()
  const company = draft.company.trim()
  const description = draft.description.trim()
  const link = draft.link.trim()
  const deadline = draft.deadline.trim()

  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    errors.title = `Enter a job title between ${TITLE_MIN} and ${TITLE_MAX} characters.`
  }
  if (company.length < TITLE_MIN || company.length > TITLE_MAX) {
    errors.company = `Enter a company name between ${TITLE_MIN} and ${TITLE_MAX} characters.`
  }
  if (description.length > DESCRIPTION_MAX) {
    errors.description = `Description must be ${DESCRIPTION_MAX.toLocaleString()} characters or fewer.`
  }
  if (link && (link.length > LINK_MAX || !normalizeListingUrl(link))) {
    errors.link = 'Enter a valid http or https link, or leave it blank.'
  }
  if (deadline && !isRealDate(deadline)) {
    errors.deadline = 'Enter a valid deadline.'
  }

  if (Object.keys(errors).length > 0) {
    return { errors, value: null }
  }

  return {
    errors,
    value: {
      title,
      company,
      description: description || null,
      link: link || null,
      deadline: deadline || null,
      dedupe_key: buildDedupeKey({ title, company, link }),
    },
  }
}

export function isDuplicateOpportunityError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  return /duplicate key|job_advertisements_user_dedupe/i.test(error.message ?? '')
}

export function isMissingAdvertisementsTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const message = error.message ?? ''
  return /job_advertisements/i.test(message) && /schema cache|does not exist|could not find/i.test(message)
}
