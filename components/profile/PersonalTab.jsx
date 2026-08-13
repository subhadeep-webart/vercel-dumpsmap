'use client'

// Personal Info tab — name, email, phone, and full address.
//
// Saving is EXPLICIT: react-hook-form holds the field state, zod validates on
// submit, and only then does one PATCH go out with the changed fields. This
// replaces the old save-every-field-on-blur behaviour, which fired a request per
// field (several per tab visit), persisted half-typed values, and gave the user
// no way to abandon an edit.

import React, { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import FieldError from '@/components/FieldError'
import { FieldRow, ProfileCard, profileInputClass } from '@/components/profile/primitives'
import { personalSchema, PERSONAL_KEYS, pickDefaults, changedFields } from '@/validator/profile'
import { User, Mail, Phone, MapPin, Loader2, Check } from 'lucide-react'

// `setForm` is intentionally not used: save() already syncs the parent draft with
// the server's normalised values. It stays in the props list because the shared
// tab interface passes it to every tab.
export default function PersonalTab({ form, save, saving }) {
  const defaults = useMemo(() => pickDefaults(form, PERSONAL_KEYS), [form])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({
    resolver: zodResolver(personalSchema),
    mode: 'onTouched',
    defaultValues: defaults,
  })

  // The draft loads asynchronously (SWR), so the first render can have empty
  // defaults. Re-seed once the real values arrive — but only while the user
  // hasn't started editing, so a reset never discards in-progress typing.
  useEffect(() => {
    if (!isDirty) reset(defaults)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults])

  const onSubmit = async (values) => {
    const patch = changedFields(values, defaults)
    if (Object.keys(patch).length === 0) return

    // save() folds the server's normalised response back into the parent draft
    // itself, so there's no setForm here — it would just duplicate that write
    // with un-normalised values.
    const ok = await save(patch, 'Personal info')
    // Mark the form pristine so the Save button disables until the next edit.
    if (ok) reset(values)
  }

  const busy = isSubmitting || !!saving

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <ProfileCard
        title="Personal information"
        desc="Your name, contact details, and address"
        icon={User}
        action={
          <Button type="submit" size="sm" disabled={busy || !isDirty} className="gap-1.5 bg-green-600 hover:bg-green-700">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        }
      >
        <FieldRow label="Full name" icon={User}>
          <Input className={profileInputClass} {...register('name')} placeholder="e.g. Jane Smith" />
          <FieldError msg={errors.name?.message} />
        </FieldRow>

        <FieldRow label="Email" icon={Mail} note="Changing email resets verification status">
          <Input className={profileInputClass} type="email" {...register('email')} />
          <FieldError msg={errors.email?.message} />
        </FieldRow>

        <FieldRow label="Phone" icon={Phone}>
          <Input className={profileInputClass} {...register('phone')} placeholder="(555) 555-5555" />
          <FieldError msg={errors.phone?.message} />
        </FieldRow>

        <FieldRow label="Address line 1" icon={MapPin}>
          <Input className={profileInputClass} {...register('addressLine1')} placeholder="123 Main St" />
          <FieldError msg={errors.addressLine1?.message} />
        </FieldRow>

        <FieldRow label="Address line 2" icon={MapPin}>
          <Input className={profileInputClass} {...register('addressLine2')} placeholder="Apt, suite, unit (optional)" />
          <FieldError msg={errors.addressLine2?.message} />
        </FieldRow>

        <div className="grid gap-4 sm:grid-cols-3">
          <FieldRow label="City">
            <Input className={profileInputClass} {...register('city')} />
            <FieldError msg={errors.city?.message} />
          </FieldRow>
          <FieldRow label="State">
            <Input className={profileInputClass} {...register('state')} maxLength={2} placeholder="CA" />
            <FieldError msg={errors.state?.message} />
          </FieldRow>
          <FieldRow label="ZIP">
            <Input className={profileInputClass} {...register('zip')} maxLength={10} />
            <FieldError msg={errors.zip?.message} />
          </FieldRow>
        </div>

        {/* Mirrors the Save button's state for users scrolled past the header. */}
        {isDirty && !busy && (
          <p className="text-[11px] text-neutral-400">You have unsaved changes.</p>
        )}
      </ProfileCard>
    </form>
  )
}
