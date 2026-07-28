'use client'

// Desktop/tablet (≥ md) facility row for the facilities directory.
//
// Clean, minimal layout: type icon, name + live/verified badges, category,
// address, and a compact meta line (rating · reviews · distance). Heavy detail
// (full accepted/not-accepted lists, pricing chips, contractor notes, tags)
// lives on the facility detail page — the row stays scannable. The mobile
// (< md) layout is handled separately by MobileFacilityCard.

import Link from 'next/link'
import {
  Star,
  BadgeCheck,
  MapPin,
  Activity,
  Navigation,
  Eye,
} from 'lucide-react'
import { FACILITY_TYPE_CONFIG, getStatusMeta } from '@/lib/facility-types'
import { TypeIcon, StatusIcon } from '@/lib/facility-icons'
import FacilityLiveStatusBadge from '@/components/FacilityLiveStatusBadge'

// Resolve the first usable photo for a facility — mirrors MobileFacilityCard so
// the desktop row shows the same image the mobile card does.
function firstPhoto(f) {
  const candidates = [
    f?.imageUrl,
    f?.heroImageUrl,
    f?.photoUrl,
    ...(Array.isArray(f?.photos) ? f.photos : []),
    ...(Array.isArray(f?.images) ? f.images : []),
  ].filter(Boolean)
  const raw = candidates[0]
  if (!raw) return null
  if (typeof raw !== 'string') return null
  if (raw.startsWith('/uploads/')) return `/api/files/${raw.slice('/uploads/'.length)}`
  return raw
}

export default function FacilityRow({ f, onOpen, onQuickCheckIn }) {
  // Derive type config — prefer typeKey (new submissions) else best-effort label match
  const typeKey = f.typeKey || Object.keys(FACILITY_TYPE_CONFIG).find((k) => FACILITY_TYPE_CONFIG[k].label === f.type) || null
  const cfg = typeKey ? FACILITY_TYPE_CONFIG[typeKey] : null

  const photo = firstPhoto(f)

  const statusMeta = f.currentStatus ? getStatusMeta(f.currentStatus) : null
  const statusColor = {
    green: 'border-brand-300 bg-brand-50 text-brand-800',
    red:   'border-red-300 bg-red-50 text-red-800',
    amber: 'border-amber-300 bg-amber-50 text-amber-800',
    blue:  'border-blue-300 bg-blue-50 text-blue-800',
  }

  return (
    <div className="group relative flex w-full items-center gap-4 overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 transition-[border-color,box-shadow] duration-300 ease-out hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-100/50">
      {/* Accent bar — fades/slides in on hover */}
      <span className="absolute inset-y-0 left-0 w-1 origin-top scale-y-0 bg-emerald-500 transition-transform duration-300 ease-out group-hover:scale-y-100" />

      {/* Facility photo (falls back to the type icon) */}
      <button
        onClick={onOpen}
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-xl text-brand-700 transition-colors duration-300 ease-out group-hover:bg-emerald-50 group-hover:text-emerald-700 active:scale-95"
        aria-label={`Open ${f.name}`}
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <TypeIcon typeKey={typeKey} className="h-5 w-5" />
        )}
      </button>

      {/* Main content */}
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold text-neutral-900 transition-colors duration-300 group-hover:text-emerald-700">{f.name}</span>
          {f.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" aria-label="Verified" />}
          <FacilityLiveStatusBadge facility={f} />
          {statusMeta && (
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${statusColor[statusMeta.color]}`}>
              <StatusIcon status={f.currentStatus} className="h-3 w-3" /> {statusMeta.label}
            </span>
          )}
        </div>

        <div className="mt-0.5 truncate text-xs text-neutral-500">{cfg?.label || f.type}</div>

        {f.address && (
          <div className="mt-1.5 flex items-center gap-1 text-sm text-neutral-600">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span className="truncate">{f.address}</span>
          </div>
        )}

        <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-neutral-700">{f.rating?.toFixed?.(1) || '—'}</span>
          </span>
          <span>·</span>
          <span>{f.reviewsCount || 0} reviews</span>
          {f.distanceKm != null && (
            <>
              <span>·</span>
              <span>{f.distanceKm.toFixed(1)} km</span>
            </>
          )}
        </div>
      </button>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onQuickCheckIn?.(f)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          title="Quick check-in"
        >
          <Activity className="h-3.5 w-3.5" /> Check In
        </button>
        <Link
          href={`/facilities/${f.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600 bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
        >
          <Eye className="h-3.5 w-3.5" /> View
        </Link>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(f.address || f.name)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
          title="Directions"
        >
          <Navigation className="h-3.5 w-3.5" /> Directions
        </a>
      </div>
    </div>
  )
}
