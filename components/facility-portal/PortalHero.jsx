'use client'

// PortalHero — the facility identity header: photo, name + Verified pill, contact
// rows (address / phone / website), Facility ID + "Member since", and the
// View Public Profile link that deep-links to the consumer-facing /facilities/[id].
// Presentational only; all data comes from the selected facility.

import Link from 'next/link'
import { MapPin, Phone, Globe, ShieldCheck, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deriveInitials } from '@/components/profile/primitives'
import { memberSince } from './portal-helpers'

export default function PortalHero({ facility }) {
  if (!facility) return null
  const photo = facility.photos?.[0] || facility.images?.[0] || ''
  const location =
    facility.address || [facility.city, facility.state, facility.zip].filter(Boolean).join(', ')
  const since = memberSince(facility.createdAt)

  return (
    <section id="hero" className="dm-rise-in scroll-mt-20 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {/* Photo */}
        <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200 sm:h-28 sm:w-40">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={facility.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-neutral-400">
              {deriveInitials(facility.name)}
            </div>
          )}
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">{facility.name}</h1>
            {facility.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified Facility
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1 text-sm text-neutral-600">
            {location && (
              <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0 text-neutral-400" /> {location}</div>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {facility.phone && (
                <a href={`tel:${facility.phone}`} className="flex items-center gap-1.5 hover:text-emerald-700">
                  <Phone className="h-4 w-4 shrink-0 text-neutral-400" /> {facility.phone}
                </a>
              )}
              {facility.website && (
                <a href={facility.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-emerald-700">
                  <Globe className="h-4 w-4 shrink-0 text-neutral-400" /> Website
                </a>
              )}
            </div>
          </div>

          <div className="mt-2 text-xs text-neutral-400">
            Facility ID: {facility.id}
            {since && <span> · Member since {since}</span>}
          </div>
        </div>

        {/* View Public Profile */}
        <div className="shrink-0">
          <Link href={`/facilities/${facility.id}`}>
            <Button variant="outline" className="gap-1.5">
              <ExternalLink className="h-4 w-4" /> View Public Profile
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
