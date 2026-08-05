'use client'

// Hero band for the profile editor — full-bleed cover photo, overlapping
// avatar, name/role/verified badges, contact summary, and the availability
// quick pill. Cover + avatar edits flow up through onChangeCover/onChangeAvatar.

import React from 'react'
import { Badge } from '@/components/ui/badge'
import MediaUploader from '@/components/MediaUploader'
import { Mail, Phone, MapPin, ShieldCheck } from 'lucide-react'

export default function ProfileHero({ user, form, availability, onChangeCover, onChangeAvatar, initials, role }) {
  return (
    <section className="relative">
      {/* Cover photo (full-bleed) — uses MediaUploader with cover variant */}
      <MediaUploader
        variant="cover"
        value={form.coverImageUrl}
        onChange={(url) => onChangeCover(url)}
        accept="image/*"
        showRemove
      />

      {/* Avatar + name (overlapping the cover by -mt-12) */}
      <div className="container mx-auto -mt-6 px-4 pb-3 sm:-mt-12">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative">
            <MediaUploader
              variant="avatar"
              value={form.profilePhotoUrl || form.avatarUrl || ''}
              onChange={(url) => onChangeAvatar(url)}
              label={initials}
              accept="image/*"
              showRemove
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="max-w-full truncate text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">{user.name || user.email}</h1>
              {user.verified && (
                <Badge variant="outline" className="border-green-300 bg-green-50 text-green-800">
                  <ShieldCheck className="mr-0.5 h-3 w-3" /> Verified
                </Badge>
              )}
              <Badge variant="outline" className="border-neutral-300 bg-white text-[10px] uppercase tracking-wider text-neutral-600">
                {role}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
              <span className="inline-flex min-w-0 max-w-full items-start gap-1"><Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span className="min-w-0 break-all">{user.email}</span></span>
              {user.phone && <span className="inline-flex min-w-0 max-w-full items-center gap-1"><Phone className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{user.phone}</span></span>}
              {(user.city || user.state) && <span className="inline-flex min-w-0 max-w-full items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{[user.city, user.state].filter(Boolean).join(', ')}</span></span>}
            </div>
          </div>
          {/* Availability quick pill (mirrors the Preferences status) */}
          <div className={`mb-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${availability.tone}`}>
            {availability.Icon && <availability.Icon className="h-4 w-4" />} {availability.label}
          </div>
        </div>
      </div>
    </section>
  )
}
