'use client'

// NearbyFacilitiesCard — "Facilities Near You" in the Activity Hub right rail.
//
// Each row: thumbnail, facility name, live wait band, distance. Rows link to
// the facility detail page.
//
// The wait line only renders when an active alert reports one (see
// lib/facility-wait); facilities with no live wait fall back to their type, so
// a row never collapses to just a name.

import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { useNearbyFacilities } from '@/hooks/use-nearby-facilities'
import { getWaitBand, formatDistanceMi } from '@/lib/facility-wait'

export default function NearbyFacilitiesCard({ limit = 4 }) {
  const { facilities, loading } = useNearbyFacilities({ limit })

  // Nothing nearby and nothing loading — drop the card rather than show an
  // empty shell in the rail.
  if (!loading && facilities.length === 0) return null

  return (
    <section>
      <h2 className="mb-2.5 px-0.5 text-[16px] font-semibold text-neutral-900">
        Facilities Near You
      </h2>
      <ul className="space-y-2.5">
        {loading
          ? Array.from({ length: limit }).map((_, i) => <SkeletonRow key={i} />)
          : facilities.map((f) => <FacilityRow key={f.id} facility={f} />)}
      </ul>
    </section>
  )
}

function FacilityRow({ facility }) {
  const wait = getWaitBand(facility)
  const distance = formatDistanceMi(facility.distanceKm)
  const thumb = facility.images?.[0]

  return (
    <li>
      <Link
        href={`/facilities/${facility.id}`}
        className="flex items-center gap-3 rounded-[16px] border border-[#E0EBE2] bg-white px-3 py-2.5 transition hover:border-green-300"
      >
        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-neutral-400">
              <Building2 className="h-5 w-5" />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-neutral-900">
            {facility.name}
          </span>
          {wait ? (
            <span className={`block text-[14px] font-medium ${wait.tone}`}>{wait.label}</span>
          ) : (
            <span className="block truncate text-[13px] text-neutral-500">{facility.type}</span>
          )}
        </span>

        {distance && (
          <span className="shrink-0 text-[13px] text-neutral-500">{distance}</span>
        )}
      </Link>
    </li>
  )
}

function SkeletonRow() {
  return (
    <li className="flex animate-pulse items-center gap-3 rounded-[16px] border border-[#E0EBE2] bg-white px-3 py-2.5">
      <span className="h-11 w-11 shrink-0 rounded-lg bg-neutral-100" />
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="block h-3 w-3/4 rounded bg-neutral-100" />
        <span className="block h-3 w-1/2 rounded bg-neutral-100" />
      </span>
    </li>
  )
}
