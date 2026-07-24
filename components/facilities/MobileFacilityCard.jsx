'use client'

// MobileFacilityCard \u2014 dedicated mobile card layout for the Facilities Directory.
// Rendered by <FacilitiesTab /> ONLY at < md: (< 768px). Above 768px the existing
// horizontal FacilityRow (desktop layout) remains untouched.
//
// Structure (top \u2192 bottom):
//   [image | category badge]
//   [full facility name (max 2 lines) + verified badge]
//   [address (max 2 lines)]
//   [open/closed \u00b7 next change]
//   [rating \u00b7 review count \u00b7 distance] (all on one line)
//   [live condition badge + \"Updated N min ago\"]
//   [CHECK IN (primary)] [Directions] [View]
//
// Design invariants (per P0 spec):
//   \u2022 Never truncate a name to a single character. Use line-clamp-2.
//   \u2022 Never place all CTAs on a single row that shears at narrow widths.
//   \u2022 Keep the card readable at 320px width.
//   \u2022 Old community reports look stale.
//   \u2022 Only 3 primary actions on the card. Claim/Report/Share move to detail page.

import Link from 'next/link'
import { useMemo } from 'react'
import {
  BadgeCheck, Star, MapPin, Navigation, Eye, Activity, Circle,
  Ban, PauseCircle, DollarSign, ImageIcon,
} from 'lucide-react'
import { getOpenStatusLine } from '@/lib/facility-hours'

// Category \u2192 icon + tint pill config. Kept intentionally small \u2014
// the desktop FacilityRow uses a richer config; here we only need enough
// to render a placeholder chip and image tint.
const CATEGORY_STYLE = {
  'Transfer Station':             { tint: 'bg-slate-100 text-slate-800',      chip: 'bg-slate-500' },
  'Recycling Center':             { tint: 'bg-emerald-100 text-emerald-800',  chip: 'bg-emerald-500' },
  'Buy-Back Center':              { tint: 'bg-emerald-100 text-emerald-800',  chip: 'bg-emerald-500' },
  'Donation Center':              { tint: 'bg-sky-100 text-sky-800',          chip: 'bg-sky-500' },
  'Tire Disposal':                { tint: 'bg-orange-100 text-orange-800',    chip: 'bg-orange-500' },
  'Hazardous Waste':              { tint: 'bg-red-100 text-red-800',          chip: 'bg-red-500' },
  'HHW Drop-off':                 { tint: 'bg-red-100 text-red-800',          chip: 'bg-red-500' },
  'Scrap Metal':                  { tint: 'bg-amber-100 text-amber-800',      chip: 'bg-amber-500' },
  'Green Waste':                  { tint: 'bg-lime-100 text-lime-800',        chip: 'bg-lime-500' },
  'Compost':                      { tint: 'bg-lime-100 text-lime-800',        chip: 'bg-lime-500' },
  'Construction Recycling':       { tint: 'bg-slate-100 text-slate-800',      chip: 'bg-slate-500' },
  'Construction Debris Facility': { tint: 'bg-slate-100 text-slate-800',      chip: 'bg-slate-500' },
  'E-Waste':                      { tint: 'bg-purple-100 text-purple-800',    chip: 'bg-purple-500' },
  'E-Waste Center':               { tint: 'bg-purple-100 text-purple-800',    chip: 'bg-purple-500' },
  'CRV Redemption':               { tint: 'bg-emerald-100 text-emerald-800',  chip: 'bg-emerald-500' },
  'CRV Center':                   { tint: 'bg-emerald-100 text-emerald-800',  chip: 'bg-emerald-500' },
  'Landfill':                     { tint: 'bg-neutral-200 text-neutral-800',  chip: 'bg-neutral-500' },
  'Reuse Center':                 { tint: 'bg-neutral-200 text-neutral-800',  chip: 'bg-neutral-500' },
  'Scrap Yard':                   { tint: 'bg-amber-100 text-amber-800',      chip: 'bg-amber-500' },
  'Other':                        { tint: 'bg-neutral-100 text-neutral-700',  chip: 'bg-neutral-400' },
}

// Live status color config \u2014 mirrors the desktop badge, kept local.
const LIVE_STATUS = {
  no_wait:            { label: 'No Wait',           color: 'bg-emerald-500',  text: 'text-emerald-800',  bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  light:              { label: 'Light Wait',        color: 'bg-emerald-400',  text: 'text-emerald-800',  bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  moderate:           { label: 'Moderate Wait',     color: 'bg-amber-500',    text: 'text-amber-800',    bg: 'bg-amber-50',    border: 'border-amber-200' },
  heavy:              { label: 'Heavy Wait',        color: 'bg-orange-500',   text: 'text-orange-800',   bg: 'bg-orange-50',   border: 'border-orange-200' },
  very_heavy:         { label: 'Very Heavy Wait',   color: 'bg-red-500',      text: 'text-red-800',      bg: 'bg-red-50',      border: 'border-red-200' },
  scale_closed:       { label: 'Scale Closed',      color: 'bg-neutral-800',  text: 'text-neutral-800',  bg: 'bg-neutral-100', border: 'border-neutral-300' },
  gate_closed:        { label: 'Gate Closed',       color: 'bg-neutral-800',  text: 'text-neutral-800',  bg: 'bg-neutral-100', border: 'border-neutral-300' },
  material_restrict:  { label: 'Material Restriction', color: 'bg-purple-500', text: 'text-purple-800', bg: 'bg-purple-50', border: 'border-purple-200' },
  price_update:       { label: 'Price Update',      color: 'bg-blue-500',     text: 'text-blue-800',     bg: 'bg-blue-50',     border: 'border-blue-200' },
}

function pickLiveStatus(f) {
  // Accepts either `liveStatus` (canonical) or `currentStatus` (legacy).
  const k = f?.liveStatus || f?.currentStatus
  if (!k) return null
  return LIVE_STATUS[k] || null
}

function relativeTime(ts) {
  if (!ts) return ''
  const t = new Date(ts).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = (Date.now() - t) / 1000
  if (diff < 60)         return 'just now'
  if (diff < 3600)       return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400)      return `${Math.floor(diff / 3600)} hr ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} d ago`
  return new Date(ts).toLocaleDateString()
}

// Community info is \"stale\" if last update is older than 6 hours.
function isStale(ts) {
  if (!ts) return true
  const t = new Date(ts).getTime()
  if (!Number.isFinite(t)) return true
  return (Date.now() - t) > 6 * 3600 * 1000
}

function distanceLine(distanceKm) {
  if (distanceKm == null) return null
  const mi = distanceKm * 0.621371
  if (mi < 0.1)  return '< 0.1 mi'
  if (mi < 10)   return `${mi.toFixed(1)} mi`
  return `${Math.round(mi)} mi`
}

function firstPhoto(f) {
  const candidates = [
    f?.imageUrl,
    f?.heroImageUrl,
    f?.photoUrl,
    ...(Array.isArray(f?.photos) ? f.photos : []),
  ].filter(Boolean)
  const raw = candidates[0]
  if (!raw) return null
  if (typeof raw !== 'string') return null
  if (raw.startsWith('/uploads/')) return `/api/files/${raw.slice('/uploads/'.length)}`
  return raw
}

export default function MobileFacilityCard({ f, onQuickCheckIn }) {
  const style   = CATEGORY_STYLE[f.type] || CATEGORY_STYLE.Other
  const status  = pickLiveStatus(f)
  const hours   = getOpenStatusLine(f.hours)
  const distance = distanceLine(f.distanceKm)
  const photo   = firstPhoto(f)
  const stale   = isStale(f.liveStatusUpdatedAt || f.currentStatusUpdatedAt)
  const rating  = typeof f.rating === 'number' ? f.rating.toFixed(1) : null

  // Compose \"Community verified N min ago\" line \u2014 only shown when there IS a live status.
  const liveTimestamp = f.liveStatusUpdatedAt || f.currentStatusUpdatedAt
  const liveWhen      = relativeTime(liveTimestamp)

  const detailHref = `/facilities/${f.id}`
  const dirHref    = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(f.address || f.name)}`

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* Photo / placeholder banner */}
      <Link href={detailHref} className="relative block aspect-[16/9] w-full overflow-hidden bg-neutral-100" aria-label={`Open ${f.name}`}>
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        ) : (
          <div className={`grid h-full w-full place-items-center ${style.tint}`}>
            <ImageIcon className="h-8 w-8 opacity-40" />
          </div>
        )}
        {/* Category badge, top-left */}
        <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${style.chip}`}>
          {f.type || 'Facility'}
        </span>
        {/* Distance chip, top-right */}
        {distance && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-neutral-800 shadow-sm">
            <MapPin className="h-3 w-3" /> {distance}
          </span>
        )}
      </Link>

      {/* Body */}
      <div className="p-3.5">
        {/* Name row */}
        <div className="flex items-start gap-1.5">
          <h3 className="line-clamp-2 flex-1 text-[16px] font-extrabold leading-tight tracking-tight text-neutral-900">
            {f.name || 'Unnamed facility'}
          </h3>
          {f.verified && <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Verified" />}
        </div>

        {/* Address (2 lines max) */}
        {f.address && (
          <p className="mt-1 line-clamp-2 flex items-start gap-1 text-[13px] leading-snug text-neutral-600">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span>{f.address}</span>
          </p>
        )}

        {/* Hours line */}
        {hours.label !== '\u2014' && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold">
            {hours.tone === 'open' ? (
              <><Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" /><span className="text-emerald-700">Open</span></>
            ) : hours.tone === 'closed' ? (
              <><Circle className="h-2.5 w-2.5 fill-red-500 text-red-500" /><span className="text-red-700">Closed</span></>
            ) : (
              <><Circle className="h-2.5 w-2.5 fill-neutral-400 text-neutral-400" /><span className="text-neutral-600">Hours</span></>
            )}
            <span className="truncate text-neutral-700">
              {hours.tone === 'open'   ? ` \u00b7 Closes ${hours.label.replace(/^Open \u00b7 Closes /, '')}`
              : hours.tone === 'closed' ? ` \u00b7 ${hours.label.replace(/^Closed \u00b7 /, 'Opens ')}`
              : ` \u00b7 ${hours.label}`}
            </span>
          </p>
        )}

        {/* Rating + reviews (single line, wraps as needed) */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-neutral-600">
          {rating && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold text-neutral-900">{rating}</span>
              {f.reviewsCount != null && <span className="text-neutral-500">({f.reviewsCount} review{f.reviewsCount === 1 ? '' : 's'})</span>}
            </span>
          )}
          {f.activeAlertCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-orange-800">
              \ud83d\udd25 {f.activeAlertCount} live report{f.activeAlertCount === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {/* Live condition + freshness */}
        {status && (
          <div className={`mt-2.5 flex items-center gap-2 rounded-lg border ${status.border} ${status.bg} px-2.5 py-1.5 ${stale ? 'opacity-70' : ''}`}>
            <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${status.color} ${stale ? '' : 'animate-pulse'}`} />
            <div className="min-w-0 flex-1">
              <div className={`text-[13px] font-bold ${status.text}`}>{status.label}</div>
              {liveWhen && (
                <div className={`text-[10.5px] ${stale ? 'italic text-neutral-500' : 'text-neutral-500'}`}>
                  {stale ? `Last verified ${liveWhen}` : `Updated ${liveWhen}`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTAs \u2014 vertically stacked hierarchy, never all-on-one-row */}
        <div className="mt-3 grid grid-cols-1 gap-2">
          {/* Primary */}
          <button
            type="button"
            onClick={() => onQuickCheckIn?.(f)}
            className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[14px] font-bold text-white shadow-sm transition active:scale-[.98] hover:bg-emerald-700"
          >
            <Activity className="h-4 w-4" /> Check In
          </button>
          {/* Secondary row \u2014 two equal-width buttons */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={dirHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13.5px] font-semibold text-neutral-800 shadow-sm active:scale-[.98] hover:bg-neutral-50"
            >
              <Navigation className="h-4 w-4 text-emerald-600" /> Directions
            </a>
            <Link
              href={detailHref}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[13.5px] font-semibold text-emerald-700 shadow-sm active:scale-[.98] hover:bg-emerald-100"
            >
              <Eye className="h-4 w-4" /> View
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
