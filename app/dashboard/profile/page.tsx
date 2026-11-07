'use client'

import { FormEvent, useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import {
  COUNTRY_OPTIONS,
  DEFAULT_PHONE_COUNTRY,
  formatPhoneDisplay,
  validateProfile,
  type ProfileErrors,
} from '@/lib/phone'
import TargetRolesForm from '../components/TargetRolesForm'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type ProfileResponse = {
  email?: string
  fullName?: string
  phone?: string
  phoneCountry?: string
  smsOptIn?: boolean
  targetRoles?: string[]
  message?: string
  errors?: ProfileErrors
}

export default function ProfilePage() {
  const formId = useId()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phoneCountry, setPhoneCountry] = useState<string>(DEFAULT_PHONE_COUNTRY)
  const [phone, setPhone] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [targetRoles, setTargetRoles] = useState<string[]>([])
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

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
        const body = (await response.json().catch(() => ({}))) as ProfileResponse
        if (cancelled) return
        if (response.status === 401) {
          window.location.href = '/'
          return
        }
        if (!response.ok) {
          setFormError(body.message || 'Could not load your profile.')
          return
        }
        setEmail(body.email || session.user.email || '')
        setFullName(body.fullName || '')
        setPhoneCountry(body.phoneCountry || DEFAULT_PHONE_COUNTRY)
        setPhone(body.phone ? formatPhoneDisplay(body.phone) : '')
        setSmsOptIn(Boolean(body.smsOptIn))
        setTargetRoles(Array.isArray(body.targetRoles) ? body.targetRoles : [])
      } catch {
        if (!cancelled) setFormError('Could not load your profile.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const phonePreview = useMemo(() => {
    if (!phone.trim()) return null
    const { value } = validateProfile({ fullName: '', phone, phoneCountry, smsOptIn: false })
    if (!value?.phoneE164) return null
    const country = COUNTRY_OPTIONS.find((option) => option.code === value.phoneCountry)
    return {
      display: formatPhoneDisplay(value.phoneE164),
      countryLabel: country?.label ?? value.phoneCountry,
    }
  }, [phone, phoneCountry])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return

    const { errors: nextErrors } = validateProfile({ fullName, phone, phoneCountry, smsOptIn })
    setErrors(nextErrors)
    setSavedMessage(null)
    setFormError(null)
    if (Object.keys(nextErrors).length > 0) return

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/'
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fullName, phone, phoneCountry, smsOptIn }),
      })
      const body = (await response.json().catch(() => ({}))) as ProfileResponse
      if (response.status === 401) {
        window.location.href = '/'
        return
      }
      if (!response.ok) {
        setErrors(body.errors ?? {})
        setFormError(body.message || 'Could not save your profile.')
        return
      }
      setFullName(body.fullName || '')
      setPhoneCountry(body.phoneCountry || DEFAULT_PHONE_COUNTRY)
      setPhone(body.phone ? formatPhoneDisplay(body.phone) : '')
      setSmsOptIn(Boolean(body.smsOptIn))
      setSavedMessage(
        body.smsOptIn
          ? 'Profile saved. Text alerts are on for this number.'
          : 'Profile saved.'
      )
    } catch {
      setFormError('Could not save your profile.')
    } finally {
      setSaving(false)
    }
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
            <h1 className="text-2xl font-bold text-white">Profile</h1>
            <p className="text-orange-200 text-sm">Your name, mobile number, and target roles</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-[#e67600] hover:bg-[#d46900] text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <form
          onSubmit={handleSubmit}
          className="bg-white/10 border border-white/20 rounded-xl p-6 space-y-5"
          noValidate
        >
          <label className="block" htmlFor={`${formId}-email`}>
            <span className="text-orange-200 text-sm">Email</span>
            <input
              id={`${formId}-email`}
              value={email}
              readOnly
              className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/70 outline-none"
            />
          </label>

          <label className="block" htmlFor={`${formId}-name`}>
            <span className="text-orange-200 text-sm">Full name</span>
            <input
              id={`${formId}-name`}
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value)
                setErrors((current) => ({ ...current, fullName: undefined }))
              }}
              disabled={saving}
              autoComplete="name"
              maxLength={80}
              placeholder="Your name"
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? `${formId}-name-error` : undefined}
              className="mt-1 w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-[#e67600] disabled:opacity-60"
            />
            {errors.fullName ? (
              <p id={`${formId}-name-error`} className="mt-1 text-sm text-rose-300">
                {errors.fullName}
              </p>
            ) : null}
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <label className="block sm:col-span-2" htmlFor={`${formId}-country`}>
              <span className="text-orange-200 text-sm">Country</span>
              <select
                id={`${formId}-country`}
                value={phoneCountry}
                onChange={(event) => setPhoneCountry(event.target.value)}
                disabled={saving}
                className="mt-1 w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-[#e67600] disabled:opacity-60"
                style={{ colorScheme: 'dark' }}
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block sm:col-span-3" htmlFor={`${formId}-phone`}>
              <span className="text-orange-200 text-sm">Mobile number</span>
              <input
                id={`${formId}-phone`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value)
                  setErrors((current) => ({ ...current, phone: undefined }))
                }}
                disabled={saving}
                placeholder="712 345 678"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={`${formId}-phone-help${errors.phone ? ` ${formId}-phone-error` : ''}`}
                className="mt-1 w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-[#e67600] disabled:opacity-60"
              />
            </label>
          </div>

          <p id={`${formId}-phone-help`} className="text-xs text-orange-100/70 -mt-2">
            Kenya numbers can start with 07 or 7. For another country, choose it above or type the number with a leading +.
          </p>
          {phonePreview ? (
            <p className="text-sm text-emerald-200 -mt-2">
              Texts will go to {phonePreview.display}
              {phonePreview.countryLabel ? ` · ${phonePreview.countryLabel}` : ''}
            </p>
          ) : null}
          {errors.phone ? (
            <p id={`${formId}-phone-error`} className="text-sm text-rose-300 -mt-2">
              {errors.phone}
            </p>
          ) : null}

          <label className="flex items-start gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-3">
            <input
              type="checkbox"
              checked={smsOptIn}
              onChange={(event) => setSmsOptIn(event.target.checked)}
              disabled={saving}
              className="mt-1 accent-[#e67600]"
            />
            <span>
              <span className="font-semibold">Text alerts</span>
              <span className="block text-sm text-orange-100/80 mt-1">
                A saved mobile number receives a text when someone else adds an opportunity. This switch also texts you once when someone else applies to a saved role you have not applied to.
              </span>
            </span>
          </label>

          {formError ? (
            <p role="alert" className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
              {formError}
            </p>
          ) : null}
          {savedMessage ? (
            <p role="status" className="text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-400/30 rounded-lg px-3 py-2">
              {savedMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="bg-[#e67600] hover:bg-[#d46900] text-white px-5 py-2 rounded-lg font-semibold transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>

        <section className="bg-white/10 border border-white/20 rounded-xl p-6 mt-6">
          <h2 className="text-lg font-semibold mb-1">Target roles</h2>
          <p className="text-sm text-orange-100/80 mb-4">
            The roles you chose during onboarding. Recommendations search these before you apply.
          </p>
          <TargetRolesForm
            key={targetRoles.join('|')}
            initialRoles={targetRoles}
            onSaved={setTargetRoles}
          />
        </section>
      </div>
    </div>
  )
}
