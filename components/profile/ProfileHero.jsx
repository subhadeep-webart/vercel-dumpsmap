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
          showRemove
        />
        {/* Scrims: faint top wash for control legibility + a soft bottom
            darkening so the floating avatar always separates from the image. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
      </div>

      {/* Identity block. The avatar floats up onto the cover (negative margin ≈
          half the avatar height) while the text sits below it. On desktop the
          avatar overlaps the cover on the left and the text flows to its right. */}
      <div className="container mx-auto px-4 pb-5">
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-end sm:gap-5 sm:text-left">
          {/* Avatar medallion — floats onto the cover via negative top margin.
              -mt matches ~half the avatar size at each breakpoint so the top
              half sits on the image (Facebook style). size="xl" sizes the
              MediaUploader avatar circle itself (h-28 → sm:h-36 with a 5px white
              ring); the wrapper only adds the float, drop-shadow, and hover. */}
          <div className="pf-avatar-in pf-avatar-ring relative z-10 -mt-16 shrink-0 rounded-full [filter:drop-shadow(0_12px_28px_rgba(16,24,40,0.25))] sm:-mt-20">
            <MediaUploader
              variant="avatar"
              size="xl"
              value={form.profilePhotoUrl || form.avatarUrl || ''}
              onChange={(url) => onChangeAvatar(url)}
              label={initials}
              accept="image/*"
              showRemove
            />
          </div>

          <div className="w-full min-w-0 sm:flex-1 sm:pb-2">
            <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
              <h1 className="pf-fade-up block w-full break-words bg-gradient-to-br from-neutral-900 to-neutral-600 bg-clip-text text-2xl font-extrabold leading-tight tracking-tight text-transparent sm:w-auto sm:max-w-full sm:truncate sm:text-3xl" style={{ '--pf-i': 0 }}>{user.name || user.email}</h1>
              {user.verified && (
                <Badge variant="outline" className="pf-fade-up border-green-300/70 bg-green-50 text-green-700 shadow-sm" style={{ '--pf-i': 1 }}>
                  <ShieldCheck className="mr-0.5 h-3 w-3" /> Verified
                </Badge>
              )}
              <Badge variant="outline" className="pf-fade-up border-neutral-200 bg-white/80 text-[10px] uppercase tracking-wider text-neutral-500 backdrop-blur" style={{ '--pf-i': 2 }}>
                {role}
              </Badge>
            </div>
            <div className="pf-fade-up mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-neutral-500 sm:justify-start" style={{ '--pf-i': 3 }}>
              <span className="inline-flex min-w-0 max-w-full items-start gap-1.5"><Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" /> <span className="min-w-0 break-all">{user.email}</span></span>
              {user.phone && <span className="inline-flex min-w-0 max-w-full items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0 text-neutral-400" /> <span className="truncate">{user.phone}</span></span>}
              {(user.city || user.state) && <span className="inline-flex min-w-0 max-w-full items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-400" /> <span className="truncate">{[user.city, user.state].filter(Boolean).join(', ')}</span></span>}
            </div>
          </div>

          {/* Availability quick pill (mirrors the Preferences status). A pulsing
              dot gives it a little live feel. Fades up with the rest. */}
          <div className={`pf-fade-up inline-flex w-max items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-sm transition-transform hover:scale-105 sm:mb-2 ${availability.tone}`} style={{ '--pf-i': 4 }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
            </span>
            {availability.Icon && <availability.Icon className="h-4 w-4" />} {availability.label}
          </div>
        </div>
      </div>
    </section>
  )
}
