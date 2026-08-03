'use client'

// Small presentational primitives + helpers shared across the profile editor
// (app/profile/page.js and the components/profile/ tabs).

import React from 'react'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

// Canonical profile photo resolver. Fallback chain:
//   profilePhotoUrl → avatarUrl → imageUrl → '' (initials placeholder)
// We migrate all surfaces to read profilePhotoUrl first, but writes mirror to
// avatarUrl so legacy reads (Marketplace, Community, etc.) still work.
export const resolveAvatar = (u) => (
  (u && (u.profilePhotoUrl || u.avatarUrl || u.imageUrl)) || ''
)

// Two-letter initials from a name/email, for the avatar placeholder.
export const deriveInitials = (nameOrEmail) =>
  (nameOrEmail || 'U').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()

// Labelled form row — an uppercase caption with optional leading icon, the
// input(s) as children, and an optional helper note beneath.
export function FieldRow({ label, icon: Icon, note, children }) {
  return (
    <div>
      <Label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-600">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </Label>
      {children}
      {note && <p className="mt-1 text-[11px] text-neutral-500">{note}</p>}
    </div>
  )
}

// Inline "Saving …" hint shown at the bottom of a tab while a field persists.
export function SavingHint({ label }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
      <Loader2 className="h-3 w-3 animate-spin" /> Saving {label}…
    </div>
  )
}
