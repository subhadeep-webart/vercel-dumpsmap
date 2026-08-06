'use client'

// Small presentational primitives + helpers shared across the profile editor
// (app/profile/page.js and the components/profile/ tabs).

import React from 'react'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

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
// input(s) as children, and an optional helper note beneath. The icon sits in a
// small tinted chip so labels feel a touch more crafted than plain text.
export function FieldRow({ label, icon: Icon, note, children }) {
  return (
    <div className="group/field">
      <Label className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 transition-colors group-focus-within/field:text-green-700">
        {Icon && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-neutral-100 text-neutral-500 transition-colors group-focus-within/field:bg-green-100 group-focus-within/field:text-green-600">
            <Icon className="h-3 w-3" />
          </span>
        )}
        {label}
      </Label>
      {children}
      {note && <p className="mt-1.5 text-[11px] text-neutral-400">{note}</p>}
    </div>
  )
}

// Elevated card wrapper for profile tabs + sidebar. Softer border, a subtle
// hover lift, and a header row with a tinted icon chip + optional description —
// the "Vercel-simple but polished" look. Children render inside a padded body.
//
//   <ProfileCard title="Personal information" icon={User} desc="…">
//     …fields…
//   </ProfileCard>
export function ProfileCard({ title, icon: Icon, desc, action, children, className = '', bodyClassName = '', index = 0 }) {
  return (
    <Card
      style={{ '--dm-i': index }}
      className={`dm-rise-in group/card overflow-hidden border-neutral-200/80 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg hover:shadow-neutral-900/5 ${className}`}
    >
      {(title || Icon) && (
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-gradient-to-b from-neutral-50/80 to-transparent px-5 py-4">
          <div className="flex items-center gap-3">
            {Icon && (
              // Icon chip tilts + brightens when the card is hovered — a subtle
              // sign of life without being noisy.
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-sm shadow-green-600/25 transition-transform duration-300 group-hover/card:scale-105 group-hover/card:-rotate-3">
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </span>
            )}
            <div className="min-w-0">
              {title && <div className="text-sm font-bold text-neutral-900">{title}</div>}
              {desc && <div className="mt-0.5 text-xs text-neutral-500">{desc}</div>}
            </div>
          </div>
          {action}
        </div>
      )}
      <CardContent className={`space-y-4 p-5 ${bodyClassName}`}>{children}</CardContent>
    </Card>
  )
}

// Inline "Saving …" hint shown at the bottom of a tab while a field persists.
export function SavingHint({ label }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-[11px] font-medium text-green-700 ring-1 ring-green-100">
      <Loader2 className="h-3 w-3 animate-spin" /> Saving {label}…
    </div>
  )
}

// Shared input className for profile fields — a green focus ring so editing feels
// on-brand without touching the app-wide <Input> default. Spread onto Inputs:
//   <Input className={profileInputClass} … />
export const profileInputClass =
  'h-10 rounded-lg border-neutral-200 bg-white transition-shadow focus-visible:border-green-400 focus-visible:ring-2 focus-visible:ring-green-500/30'
