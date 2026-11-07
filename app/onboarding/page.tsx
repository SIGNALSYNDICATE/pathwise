'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TargetRolesForm from '../dashboard/components/TargetRolesForm'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

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
        const response = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const body = await response.json().catch(() => ({}))
        if (cancelled) return
        if (response.status === 401) {
          window.location.href = '/'
          return
        }
        if (!response.ok) {
          setLoadError(body.message || 'Could not load your profile.')
          return
        }
        setRoles(Array.isArray(body.targetRoles) ? body.targetRoles : [])
      } catch {
        if (!cancelled) setLoadError('Could not load your profile.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#052525] text-white flex items-center justify-center p-4">
      <div className="bg-white/10 border border-white/20 rounded-xl p-6 sm:p-8 w-full max-w-lg space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Which roles are you targeting?</h1>
          <p className="text-orange-200 text-sm mt-2">
            These roles are used to find recommendations before you apply.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#e67600]" />
          </div>
        ) : loadError ? (
          <p className="text-sm text-rose-300">{loadError}</p>
        ) : (
          <TargetRolesForm
            key={roles.join('|')}
            initialRoles={roles}
            submitLabel="Continue"
            onSaved={() => router.push('/dashboard')}
          />
        )}
      </div>
    </div>
  )
}
