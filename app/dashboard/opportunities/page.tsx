'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Briefcase, CalendarClock, ExternalLink, Plus, Search } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import OpportunityForm from '../components/OpportunityForm'
import {
  DUPLICATE_OPPORTUNITY_MESSAGE,
  draftFromAdvertisement,
  emptyDraft,
  isDuplicateOpportunityError,
  isMissingAdvertisementsTable,
  validateOpportunity,
  type JobAdvertisement,
  type OpportunityDraft,
} from '@/lib/jobAdvertisements'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MISSING_TABLE_MESSAGE =
  'Job advertisements are not available yet. Apply the latest database migration, then reload this page.'

type EditorState =
  | { mode: 'create'; draft: OpportunityDraft }
  | { mode: 'edit'; id: string; draft: OpportunityDraft }

function parseDeadline(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function deadlineMeta(deadline: string | null) {
  if (!deadline) {
    return { label: 'No deadline', className: 'bg-white/10 text-white/70' }
  }

  const due = parseDeadline(deadline)
  const days = Math.round((startOfDay(due).getTime() - startOfDay(new Date()).getTime()) / 86400000)
  const formatted = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  if (days < 0) {
    return { label: 'Deadline passed', className: 'bg-rose-500/20 text-rose-200' }
  }
  if (days === 0) {
    return { label: 'Due today', className: 'bg-amber-500/20 text-amber-200' }
  }
  if (days <= 7) {
    return {
      label: `Due in ${days} day${days === 1 ? '' : 's'}`,
      className: 'bg-amber-500/20 text-amber-200',
    }
  }
  return { label: `Upcoming · ${formatted}`, className: 'bg-emerald-500/15 text-emerald-200' }
}

function compareAdvertisements(a: JobAdvertisement, b: JobAdvertisement) {
  const aDue = a.deadline ? parseDeadline(a.deadline).getTime() : Number.POSITIVE_INFINITY
  const bDue = b.deadline ? parseDeadline(b.deadline).getTime() : Number.POSITIVE_INFINITY
  if (aDue !== bDue) return aDue - bDue
  return Date.parse(b.created_at) - Date.parse(a.created_at)
}

export default function OpportunitiesPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [advertisements, setAdvertisements] = useState<JobAdvertisement[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

      if (cancelled) return
      setUserId(session.user.id)

      const { data, error } = await supabase
        .from('job_advertisements')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        setLoadError(
          isMissingAdvertisementsTable(error)
            ? MISSING_TABLE_MESSAGE
            : 'Could not load your saved advertisements.'
        )
      } else {
        setAdvertisements((data ?? []) as JobAdvertisement[])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return advertisements
      .filter((item) => {
        if (!needle) return true
        return [item.title, item.company, item.description ?? '', item.link ?? ''].join(' ').toLowerCase().includes(needle)
      })
      .sort(compareAdvertisements)
  }, [advertisements, query])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const openCreate = () => {
    setFormError(null)
    setActionError(null)
    setPendingDeleteId(null)
    setEditor({ mode: 'create', draft: emptyDraft() })
  }

  const openEdit = (item: JobAdvertisement) => {
    setFormError(null)
    setActionError(null)
    setPendingDeleteId(null)
    setEditor({ mode: 'edit', id: item.id, draft: draftFromAdvertisement(item) })
  }

  const saveOpportunity = async (draft: OpportunityDraft) => {
    if (!userId || saving) return

    const { value } = validateOpportunity(draft)
    if (!value) {
      setFormError('Check the highlighted fields and try again.')
      return
    }

    const editingId = editor?.mode === 'edit' ? editor.id : null
    const duplicate = advertisements.some(
      (item) => item.dedupe_key === value.dedupe_key && item.id !== editingId
    )
    if (duplicate) {
      setFormError(DUPLICATE_OPPORTUNITY_MESSAGE)
      return
    }

    setSaving(true)
    setFormError(null)

    const payload = {
      title: value.title,
      company: value.company,
      description: value.description,
      link: value.link,
      deadline: value.deadline,
      dedupe_key: value.dedupe_key,
    }

    const request = editingId
      ? supabase
          .from('job_advertisements')
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', userId)
          .select('*')
          .single()
      : supabase
          .from('job_advertisements')
          .insert({ ...payload, user_id: userId })
          .select('*')
          .single()

    const { data, error } = await request
    setSaving(false)

    if (error || !data) {
      if (isDuplicateOpportunityError(error)) {
        setFormError(DUPLICATE_OPPORTUNITY_MESSAGE)
        return
      }
      if (isMissingAdvertisementsTable(error)) {
        setFormError(MISSING_TABLE_MESSAGE)
        return
      }
      setFormError('Could not save this opportunity. Try again.')
      return
    }

    const saved = data as JobAdvertisement
    setAdvertisements((current) => {
      if (editingId) return current.map((item) => (item.id === saved.id ? saved : item))
      return [saved, ...current.filter((item) => item.id !== saved.id)]
    })
    setEditor(null)
  }

  const removeOpportunity = async (id: string) => {
    if (!userId || deletingId) return
    setDeletingId(id)
    setActionError(null)

    const { error } = await supabase
      .from('job_advertisements')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    setDeletingId(null)

    if (error) {
      setActionError(
        isMissingAdvertisementsTable(error)
          ? MISSING_TABLE_MESSAGE
          : 'Could not remove that opportunity. Try again.'
      )
      return
    }

    setAdvertisements((current) => current.filter((item) => item.id !== id))
    setPendingDeleteId(null)
    if (editor?.mode === 'edit' && editor.id === id) setEditor(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#052525] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e67600]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#052525] text-white">
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="container mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-4">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-orange-200 hover:text-white text-sm mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white">Job advertisements</h1>
            <p className="text-orange-200 text-sm">
              {advertisements.length === 1
                ? '1 saved opportunity'
                : `${advertisements.length} saved opportunities`}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-[#e67600] hover:bg-[#d46900] text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {loadError ? (
          <div className="bg-white/10 border border-white/20 rounded-xl p-8 text-center space-y-2">
            <p className="text-lg font-semibold">Advertisements unavailable</p>
            <p className="text-orange-100/80 max-w-xl mx-auto">{loadError}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
              <label className="flex-1 block">
                <span className="text-orange-200 text-sm">Search</span>
                <span className="mt-1 flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3">
                  <Search className="h-4 w-4 text-orange-200" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Title, company, or description"
                    className="w-full bg-transparent py-2 outline-none text-white placeholder:text-white/40"
                  />
                </span>
              </label>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 bg-[#e67600] hover:bg-[#d46900] text-white px-5 py-2 rounded-lg font-semibold transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add opportunity
              </button>
            </div>

            {editor ? (
              <OpportunityForm
                key={editor.mode === 'edit' ? editor.id : 'create'}
                mode={editor.mode}
                initial={editor.draft}
                saving={saving}
                formError={formError}
                onCancel={() => {
                  if (saving) return
                  setEditor(null)
                  setFormError(null)
                }}
                onDismissError={() => setFormError(null)}
                onSubmit={saveOpportunity}
              />
            ) : null}

            {actionError ? (
              <p role="alert" className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
                {actionError}
              </p>
            ) : null}

            {advertisements.length === 0 ? (
              <div className="bg-white/10 border border-white/20 rounded-xl p-8 text-center">
                <p className="text-lg font-semibold">No saved advertisements yet</p>
                <p className="text-orange-100/80 mt-2 max-w-xl mx-auto">
                  Add a posting with its link and deadline, or save a role that has no public advertisement.
                </p>
              </div>
            ) : visible.length === 0 ? (
              <div className="bg-white/10 border border-white/20 rounded-xl p-8 text-center">
                <p className="text-lg font-semibold">No advertisements match that search</p>
                <p className="text-orange-100/80 mt-2">Try a different title or company.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {visible.map((item) => {
                  const deadline = deadlineMeta(item.deadline)
                  const confirming = pendingDeleteId === item.id
                  const editing = editor?.mode === 'edit' && editor.id === item.id

                  return (
                    <article
                      key={item.id}
                      className={`bg-white/10 backdrop-blur-sm rounded-xl p-5 border flex flex-col gap-4 ${
                        editing ? 'border-[#e67600]' : 'border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold leading-snug">{item.title}</h2>
                          <p className="text-orange-200 mt-1 flex items-center gap-2">
                            <Briefcase className="h-4 w-4 shrink-0" />
                            {item.company}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full text-xs font-semibold px-3 py-1 ${deadline.className}`}>
                          {deadline.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
                        <CalendarClock className="h-4 w-4 text-orange-200" />
                        {item.deadline
                          ? parseDeadline(item.deadline).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'No deadline set'}
                        {!item.link ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/15 text-orange-100">
                            No public listing
                          </span>
                        ) : null}
                      </div>

                      {item.description ? (
                        <p className="text-sm text-white/80 whitespace-pre-wrap line-clamp-3">{item.description}</p>
                      ) : null}

                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-semibold text-[#e67600] hover:text-orange-300 break-all"
                        >
                          View posting
                          <ExternalLink className="h-4 w-4 shrink-0" />
                        </a>
                      ) : null}

                      <div className="mt-auto pt-1">
                        {confirming ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm text-orange-100">Remove this opportunity?</p>
                            <button
                              type="button"
                              onClick={() => removeOpportunity(item.id)}
                              disabled={deletingId === item.id}
                              className="text-sm font-semibold text-rose-200 hover:text-rose-100 disabled:opacity-60"
                            >
                              {deletingId === item.id ? 'Removing…' : 'Remove'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(null)}
                              disabled={deletingId === item.id}
                              className="text-sm font-semibold text-white/70 hover:text-white disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-4">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="text-sm font-semibold text-white hover:text-orange-200"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActionError(null)
                                setPendingDeleteId(item.id)
                              }}
                              className="text-sm font-semibold text-rose-200 hover:text-rose-100"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
