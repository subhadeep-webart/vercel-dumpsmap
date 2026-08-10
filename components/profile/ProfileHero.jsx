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
      {/* Cover photo (full-bleed) — uses MediaUploader with cover variant.
          Ken-Burns zoom-in on load. Facebook-style: the cover is tall and the
          avatar floats ON it, overlapping the bottom edge by about half its
          height. A gentle dark scrim at the bottom keeps a light cover from
          washing out the avatar's white ring. */}
      <div className="pf-cover-in relative overflow-hidden">
        <MediaUploader
          variant="cover"
          value={form.coverImageUrl}
          onChange={(url) => onChangeCover(url)}
          accept="image/*"
        />
        {/* Scrims: faint top wash for control legibility + a soft bottom
            darkening so the floating avatar always separates from the image. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
      </div>

      {/* Identity block. The avatar floats up onto the cover (negative margin ≈
          half the avatar height) while the text sits below it. On desktop the
          avatar overlaps the cover on the left and the text flows to its right. */}
      <div className="container mx-auto px-4 pb-5">
        {/* Facebook layout: the avatar and the identity header (name + USER
            badge + Verified + Available pill) sit side-by-side in a row. The
            contact details (email · phone · location) are then listed line-by-
            line BELOW the whole row — not wrapping beside the name. */}
        <div className="flex items-end gap-4 sm:gap-5">
          {/* Avatar medallion — floats onto the cover via negative top margin. */}
          <div className="pf-avatar-in pf-avatar-ring relative z-10 -mt-16 shrink-0 rounded-full [filter:drop-shadow(0_12px_28px_rgba(16,24,40,0.25))] sm:-mt-20">
            <MediaUploader
              variant="avatar"
              size="xl"
              value={form.profilePhotoUrl || form.avatarUrl || ''}
              onChange={(url) => onChangeAvatar(url)}
              label={initials}
              accept="image/*"
            />
          </div>

          {/* Identity header — name, role/verified badges, availability pill.
              Sits beside the avatar. */}
          <div className="min-w-0 flex-1 pb-1 sm:pb-2">
            {/* Name — smaller + more vibrant: a green→emerald gradient instead of
                the muted neutral one, so the header reads as lively, not heavy. */}
            <h1 className="pf-fade-up block max-w-full break-words bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-xl font-extrabold leading-tight tracking-tight text-transparent sm:truncate sm:text-2xl" style={{ '--pf-i': 0 }}>{user.name || user.email}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {user.verified && (
                <Badge variant="outline" className="pf-fade-up border-green-300/70 bg-green-50 text-[10px] font-semibold text-green-700 shadow-sm" style={{ '--pf-i': 1 }}>
                  <ShieldCheck className="mr-0.5 h-2.5 w-2.5" /> Verified
                </Badge>
              )}
              <Badge variant="outline" className="pf-fade-up border-neutral-200 bg-white/80 text-[9px] uppercase tracking-wider text-neutral-500 backdrop-blur" style={{ '--pf-i': 2 }}>
                {role}
              </Badge>
              {/* Availability pill — beside the name/badges (Facebook style). */}
              <div className={`pf-fade-up inline-flex w-max items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-sm transition-transform hover:scale-105 ${availability.tone}`} style={{ '--pf-i': 3 }}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                </span>
                {availability.Icon && <availability.Icon className="h-3.5 w-3.5" />} {availability.label}
              </div>
            </div>
          </div>
        </div>

        {/* Contact details — stacked line-by-line below the identity row, like
            Facebook's "Personal details" list. Green-tinted icons add a vibrant
            on-brand accent to each row. */}
        <div className="pf-fade-up mt-3 flex flex-col gap-1.5 text-[13px] text-neutral-600" style={{ '--pf-i': 4 }}>
          <span className="inline-flex min-w-0 max-w-full items-start gap-2"><Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" /> <span className="min-w-0 break-all">{user.email}</span></span>
          {user.phone && <span className="inline-flex min-w-0 max-w-full items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0 text-green-500" /> <span className="truncate">{user.phone}</span></span>}
          {(user.city || user.state) && <span className="inline-flex min-w-0 max-w-full items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-green-500" /> <span className="truncate">{[user.city, user.state].filter(Boolean).join(', ')}</span></span>}
        </div>
      </div>
    </section>
  )
}
