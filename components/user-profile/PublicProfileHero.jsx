'use client'

// Public profile hero — the read-only twin of the editor's ProfileHero, styled
// to match the Facebook mobile profile: tall cover, floating overlapping avatar,
// name, a stats row (Posts · Listings · Member since), then an inline icon list
// of details (member type · location · company · website). Purely presentational
// — no upload controls (visitors can't edit). Reuses the shared pf-* entrance
// animations so it feels native to the profile surface.

import React from 'react'
import { Badge } from '@/components/ui/badge'
import SafeImage from '@/components/SafeImage'
import { AVAILABILITY_OPTIONS } from '@/constants/profile_constants'
import { deriveInitials } from '@/components/profile/primitives'
import { PROFILE_TYPE_LABEL } from '@/components/user-profile/public-profile-helpers'
import { MapPin, Globe, Building2, ShieldCheck, Tag } from 'lucide-react'

// Compact number formatter for the stats row (1.2k, 3.6M) — FB style.
function compact(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

function memberSince(createdAt) {
  if (!createdAt) return null
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

// One inline detail chip in the FB "Digital creator · Shyamnagar · Company" row.
function DetailChip({ icon: Icon, children, href }) {
  const inner = (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon className="h-4 w-4 shrink-0 text-neutral-400" />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-green-700 hover:underline">
        {inner}
      </a>
    )
  }
  return inner
}

export default function PublicProfileHero({ user, stats = { posts: 0, listings: 0 } }) {
  const photo = user.profilePhotoUrl || user.avatarUrl || ''
  const initials = deriveInitials(user.name)
  const role = (user.role || 'user').replace(/_/g, ' ')
  const availability =
    AVAILABILITY_OPTIONS.find((o) => o.value === user.availabilityStatus) || AVAILABILITY_OPTIONS[0]
  const location = [user.city, user.state].filter(Boolean).join(', ')
  const joined = memberSince(user.createdAt)
  const profileType = user.profileType ? (PROFILE_TYPE_LABEL[user.profileType] || user.profileType.replace(/_/g, ' ')) : null

  return (
    <section className="relative">
      {/* Cover — full-bleed, tall. Mobile-safe fixed responsive height (not
          aspect-[x] + absolute child, which collapses to 0 on mobile). */}
      <div className="pf-cover-in relative h-44 w-full overflow-hidden bg-gradient-to-br from-green-600 via-emerald-500 to-teal-500 sm:h-60">
        {user.coverImageUrl ? (
          <SafeImage src={user.coverImageUrl} alt="" kind="banner" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_-10%,rgba(255,255,255,0.35),transparent_60%)]" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25" />
      </div>

      {/* Identity block — Facebook-mobile aligned: avatar floats bottom-LEFT
          over the cover at every breakpoint (smaller on mobile), never centered.
          On desktop the text flows to the right of the avatar; on mobile the
          text stacks below it, still left-aligned. */}
      <div className="container mx-auto px-4 pb-2">
        <div className="flex flex-col items-start gap-3 text-left sm:flex-row sm:items-end sm:gap-5">
          {/* Avatar medallion — floats up onto the cover (~half its height).
              h-24 on mobile (FB size), scaling to h-36 on desktop. */}
          <div className="pf-avatar-in pf-avatar-ring relative z-10 -mt-14 shrink-0 rounded-full [filter:drop-shadow(0_12px_28px_rgba(16,24,40,0.25))] sm:-mt-20">
            <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-white sm:h-36 sm:w-36 sm:border-[5px]">
              {photo ? (
                <SafeImage src={photo} alt={user.name} kind="avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600 text-3xl font-extrabold text-white sm:text-4xl">
                  {initials}
                </div>
              )}
            </div>
          </div>

          <div className="w-full min-w-0 sm:flex-1 sm:pb-2">
            <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
              <h1 className="pf-fade-up block max-w-full break-words bg-gradient-to-br from-neutral-900 to-neutral-600 bg-clip-text text-2xl font-extrabold leading-tight tracking-tight text-transparent sm:truncate sm:text-3xl" style={{ '--pf-i': 0 }}>
                {user.name}
              </h1>
              {user.verified && (
                <Badge variant="outline" className="pf-fade-up border-green-300/70 bg-green-50 text-green-700 shadow-sm" style={{ '--pf-i': 1 }}>
                  <ShieldCheck className="mr-0.5 h-3 w-3" /> Verified
                </Badge>
              )}
              <Badge variant="outline" className="pf-fade-up border-neutral-200 bg-white/80 text-[10px] uppercase tracking-wider text-neutral-500 backdrop-blur" style={{ '--pf-i': 2 }}>
                {role}
              </Badge>
            </div>

            {/* Stats row — Facebook "997 followers · 2.7T following · 3.6T posts".
                dumpsmap has no follow graph, so we surface real counts we do
                have: Posts · Listings · Member since. Left-aligned at all sizes,
                matching the name above it (Facebook mobile style). */}
            <div className="pf-fade-up mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600" style={{ '--pf-i': 3 }}>
              <span><b className="font-bold text-neutral-900">{compact(stats.posts)}</b> {stats.posts === 1 ? 'post' : 'posts'}</span>
              <span className="text-neutral-300">·</span>
              <span><b className="font-bold text-neutral-900">{compact(stats.listings)}</b> {stats.listings === 1 ? 'listing' : 'listings'}</span>
              {joined && (
                <>
                  <span className="text-neutral-300">·</span>
                  <span className="text-neutral-500">Joined {joined}</span>
                </>
              )}
            </div>
          </div>

          {/* Availability pill — mirrors the editor hero's live-dot pill. On
              mobile it sits left-aligned under the stats; on desktop it floats to
              the right edge of the identity row. */}
          <div className={`pf-fade-up inline-flex w-max items-center gap-2 self-start rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-sm sm:mb-2 sm:self-auto ${availability.tone}`} style={{ '--pf-i': 4 }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
            </span>
            {availability.Icon && <availability.Icon className="h-4 w-4" />} {availability.label}
          </div>
        </div>

        {/* Bio — Facebook shows it right under the name/stats, above the details.
            Only PUBLIC bio; no email/phone here. */}
        {user.bio && (
          <p className="pf-fade-up mt-3 whitespace-pre-line text-left text-sm leading-relaxed text-neutral-700" style={{ '--pf-i': 5 }}>
            {user.bio}
          </p>
        )}

        {/* Inline detail list — the FB "Digital creator · Shyamnagar · WebArt ·
            School" row: dot-separated chips with leading icons. Public fields
            only. Wraps naturally on narrow screens. */}
        {(profileType || location || user.companyName || user.website) && (
          <div className="pf-fade-up mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-neutral-600" style={{ '--pf-i': 6 }}>
            {profileType && <DetailChip icon={Tag}><span className="capitalize">{profileType}</span></DetailChip>}
            {location && <DetailChip icon={MapPin}>{location}</DetailChip>}
            {user.companyName && <DetailChip icon={Building2}>{user.companyName}</DetailChip>}
            {user.website && <DetailChip icon={Globe} href={user.website}>{user.website.replace(/^https?:\/\//, '')}</DetailChip>}
          </div>
        )}
      </div>
    </section>
  )
}
