'use client'

// Business Info tab — bio, company, website, business type/EIN, and the
// independent vs. company-representative toggle.
//
// Saving is EXPLICIT: react-hook-form holds the field state, zod validates on
// submit, and only then does one PATCH go out with the changed fields. This
// replaces the old save-on-blur behaviour (one request per field, half-typed
// values persisted, no way to abandon an edit).

import React, { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import FieldError from '@/components/FieldError'
import { FieldRow, ProfileCard, profileInputClass } from '@/components/profile/primitives'
import { businessSchema, BUSINESS_KEYS, pickDefaults, changedFields } from '@/validator/profile'
import { Sparkles, Briefcase, Globe, Lock, User, Loader2, Check } from 'lucide-react'

const REPRESENTATION = [
  { value: 'independent', title: 'Independent', desc: 'Solo contractor / individual' },
  { value: 'company_representative', title: 'Company Representative', desc: 'I represent a business' },
]

// `setForm` is intentionally not used: save() already syncs the parent draft with
// the server's normalised values (e.g. the https:// prefix on website).
export default function BusinessTab({ form, save, saving }) {
  const defaults = useMemo(() => {
    const d = pickDefaults(form, BUSINESS_KEYS)
    // The toggle is an enum with no empty state — fall back to the server's default.
    if (!d.isRepresentative) d.isRepresentative = 'independent'
    return d
  }, [form])

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({
    resolver: zodResolver(businessSchema),
    mode: 'onTouched',
    defaultValues: defaults,
  })

  // The draft loads asynchronously (SWR), so re-seed when it arrives — but only
  // while untouched, so a reset never discards in-progress typing.
  useEffect(() => {
    if (!isDirty) reset(defaults)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults])

  const onSubmit = async (values) => {
    const patch = changedFields(values, defaults)
    if (Object.keys(patch).length === 0) return

    // save() folds the server's normalised response back into the parent draft
    // itself (e.g. website gains its https:// prefix), so no setForm here.
    const ok = await save(patch, 'Business info')
    if (ok) reset(values)
  }

  const busy = isSubmitting || !!saving

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <ProfileCard
        title="Business information"
        desc="Your bio, company, and business details"
        icon={Briefcase}
        action={
          <Button type="submit" size="sm" disabled={busy || !isDirty} className="gap-1.5 bg-green-600 hover:bg-green-700">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        }
      >
        <FieldRow label="Bio / About you" icon={Sparkles}>
          <Textarea
            rows={3}
            {...register('bio')}
            placeholder="Tell the community who you are and what you do. 1-2 sentences works best."
          />
          <FieldError msg={errors.bio?.message} />
        </FieldRow>

        <FieldRow label="Company name" icon={Briefcase}>
          <Input className={profileInputClass} {...register('companyName')} placeholder="DumpMaps Inc · ABC Hauling · etc." />
          <FieldError msg={errors.companyName?.message} />
        </FieldRow>

        <FieldRow label="Website" icon={Globe}>
          <Input className={profileInputClass} {...register('website')} placeholder="example.com" />
          <FieldError msg={errors.website?.message} />
        </FieldRow>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Business type" icon={Briefcase} note="LLC, Sole Prop, Corp, etc.">
            <Input className={profileInputClass} {...register('businessType')} placeholder="e.g. LLC" />
            <FieldError msg={errors.businessType?.message} />
          </FieldRow>
          <FieldRow label="EIN (optional)" icon={Lock} note="Required for verified business status">
            <Input className={profileInputClass} {...register('ein')} placeholder="XX-XXXXXXX" />
            <FieldError msg={errors.ein?.message} />
          </FieldRow>
        </div>

        {/* Button-group enum — not a native input, so it goes through Controller
            to stay part of the form state (and the dirty check). */}
        <FieldRow label="Representation" icon={User} note="Are you an individual or representing a company?">
          <Controller
            name="isRepresentative"
            control={control}
            render={({ field }) => (
              <div className="flex gap-2">
                {REPRESENTATION.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => field.onChange(o.value)}
                    aria-pressed={field.value === o.value}
                    className={`flex-1 rounded-lg border p-3 text-left text-sm transition ${
                      field.value === o.value
                        ? 'border-green-500 bg-green-50'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className="font-bold text-neutral-900">{o.title}</div>
                    <div className="text-xs text-neutral-600">{o.desc}</div>
                  </button>
                ))}
              </div>
            )}
          />
          <FieldError msg={errors.isRepresentative?.message} />
        </FieldRow>

        {isDirty && !busy && (
          <p className="text-[11px] text-neutral-400">You have unsaved changes.</p>
        )}
      </ProfileCard>
    </form>
  )
}
