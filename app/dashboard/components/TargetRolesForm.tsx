'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { MAX_TARGET_ROLES, normalizeTargetRoles } from '@/lib/targetRoles'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type TargetRolesFormProps = {
  initialRoles: string[]
  submitLabel?: string
  onSaved: (roles: string[]) => void
}

export default function TargetRolesForm({
  initialRoles,
  submitLabel = 'Save target roles',
  onSaved,
}: TargetRolesFormProps) {
  const [roles, setRoles] = useState(initialRoles)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addDraft = () => {
    const next = normalizeTargetRoles([...roles, draft])
    if (!next.roles) {
      setError(next.error)
      return
    }
    setRoles(next.roles)
    setDraft('')
    setError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return

    const pending = draft.trim() ? [...roles, draft] : roles
    const next = normalizeTargetRoles(pending)
    if (!next.roles) {
      setError(next.error)
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/'
      return
    }

    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/profile/target-roles', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roles: next.roles }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401) {
        window.location.href = '/'
        return
      }
      if (!response.ok) {
        setError(body.message || 'Could not save your target roles.')
        return
      }
      const saved = Array.isArray(body.targetRoles) ? body.targetRoles : next.roles
      setRoles(saved)
      setDraft('')
      onSaved(saved)
    } catch {
      setError('Could not save your target roles.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
      <div>
        <p className="text-sm text-orange-100/80">
          Add the roles you want, such as Flutter developer or Software engineer. Recommendations use these before you apply.
        </p>
      </div>

      {roles.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <li key={role}>
              <button
                type="button"
                onClick={() => setRoles((current) => current.filter((item) => item !== role))}
                disabled={saving}
                className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/15 text-orange-100 hover:border-[#e67600] disabled:opacity-60"
              >
                {role} ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addDraft()
            }
          }}
          disabled={saving || roles.length >= MAX_TARGET_ROLES}
          maxLength={80}
          placeholder="Target role"
          className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-[#e67600] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={addDraft}
          disabled={saving || roles.length >= MAX_TARGET_ROLES}
          className="border border-white/20 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
        >
          Add
        </button>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="bg-[#e67600] hover:bg-[#d46900] text-white px-5 py-2 rounded-lg font-semibold disabled:opacity-60"
      >
        {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
