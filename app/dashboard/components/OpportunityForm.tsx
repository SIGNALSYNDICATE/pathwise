'use client'

import { FormEvent, useId, useState } from 'react'
import {
  LINK_MAX,
  validateOpportunity,
  type FieldErrors,
  type OpportunityDraft,
  type OpportunityField,
} from '@/lib/jobAdvertisements'

type OpportunityFormProps = {
  mode: 'create' | 'edit'
  initial: OpportunityDraft
  saving: boolean
  formError: string | null
  onCancel: () => void
  onDismissError: () => void
  onSubmit: (draft: OpportunityDraft) => void
}

const FIELDS: { name: OpportunityField; label: string; required?: boolean }[] = [
  { name: 'title', label: 'Job title', required: true },
  { name: 'company', label: 'Company', required: true },
]

export default function OpportunityForm({
  mode,
  initial,
  saving,
  formError,
  onCancel,
  onDismissError,
  onSubmit,
}: OpportunityFormProps) {
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const formId = useId()

  const update = (field: OpportunityField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    onDismissError()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = validateOpportunity(draft)
    setErrors(result.errors)
    if (!result.value) return
    onSubmit(draft)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/10 border border-white/20 rounded-xl p-5 sm:p-6 space-y-5"
      noValidate
    >
      <div>
        <h2 className="text-lg font-semibold text-white">
          {mode === 'create' ? 'Add a job advertisement' : 'Edit opportunity'}
        </h2>
        <p className="text-sm text-orange-100/80 mt-1">
          Save a public posting, or a role you heard about that has no link.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map((field) => (
          <label key={field.name} className="block" htmlFor={`${formId}-${field.name}`}>
            <span className="text-orange-200 text-sm">
              {field.label}
              {field.required ? <span className="text-[#e67600]"> *</span> : null}
            </span>
            <input
              id={`${formId}-${field.name}`}
              value={draft[field.name]}
              onChange={(event) => update(field.name, event.target.value)}
              disabled={saving}
              required={field.required}
              maxLength={160}
              aria-invalid={Boolean(errors[field.name])}
              aria-describedby={errors[field.name] ? `${formId}-${field.name}-error` : undefined}
              className="mt-1 w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-[#e67600] disabled:opacity-60"
            />
            {errors[field.name] ? (
              <p id={`${formId}-${field.name}-error`} className="mt-1 text-sm text-rose-300">
                {errors[field.name]}
              </p>
            ) : null}
          </label>
        ))}
      </div>

      <label className="block" htmlFor={`${formId}-description`}>
        <span className="text-orange-200 text-sm">Description</span>
        <textarea
          id={`${formId}-description`}
          value={draft.description}
          onChange={(event) => update('description', event.target.value)}
          disabled={saving}
          rows={5}
          maxLength={8000}
          placeholder="Paste the posting, or note what you know about the role."
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? `${formId}-description-error` : undefined}
          className="mt-1 w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-[#e67600] disabled:opacity-60 resize-y"
        />
        {errors.description ? (
          <p id={`${formId}-description-error`} className="mt-1 text-sm text-rose-300">
            {errors.description}
          </p>
        ) : null}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block" htmlFor={`${formId}-link`}>
          <span className="text-orange-200 text-sm">Link</span>
          <input
            id={`${formId}-link`}
            type="url"
            inputMode="url"
            value={draft.link}
            onChange={(event) => update('link', event.target.value)}
            disabled={saving}
            placeholder="https://"
            maxLength={LINK_MAX}
            aria-invalid={Boolean(errors.link)}
            aria-describedby={`${formId}-link-help${errors.link ? ` ${formId}-link-error` : ''}`}
            className="mt-1 w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-[#e67600] disabled:opacity-60"
          />
          <p id={`${formId}-link-help`} className="mt-1 text-xs text-orange-100/70">
            Leave this blank for a referral, an internal role, or any opportunity without a public posting.
          </p>
          {errors.link ? (
            <p id={`${formId}-link-error`} className="mt-1 text-sm text-rose-300">
              {errors.link}
            </p>
          ) : null}
        </label>

        <label className="block" htmlFor={`${formId}-deadline`}>
          <span className="text-orange-200 text-sm">Deadline</span>
          <input
            id={`${formId}-deadline`}
            type="date"
            value={draft.deadline}
            onChange={(event) => update('deadline', event.target.value)}
            disabled={saving}
            aria-invalid={Boolean(errors.deadline)}
            aria-describedby={errors.deadline ? `${formId}-deadline-error` : undefined}
            className="mt-1 w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-[#e67600] disabled:opacity-60 [color-scheme:dark]"
          />
          {errors.deadline ? (
            <p id={`${formId}-deadline-error`} className="mt-1 text-sm text-rose-300">
              {errors.deadline}
            </p>
          ) : null}
        </label>
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-[#e67600] hover:bg-[#d46900] disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-semibold transition-colors"
        >
          {saving ? 'Saving…' : mode === 'create' ? 'Save opportunity' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="border border-white/20 text-white hover:bg-white/10 disabled:opacity-60 px-5 py-2 rounded-lg font-semibold transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
