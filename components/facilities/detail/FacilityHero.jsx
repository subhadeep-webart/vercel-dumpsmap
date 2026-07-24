'use client'

// Hero banner for the facility detail page — banner image with a gradient
// overlay, back button, logo/name/address block, badges, and a status pill.
// Extracted from app/facilities/[id]/page.js.

import SafeImage from '@/components/SafeImage'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, MapPin, BadgeCheck, Gift, KeyRound } from 'lucide-react'

export default function FacilityHero({ facility, heroImg, typeCfg, statusMeta, isClaimed, onBack }) {
  const colorMap = {
    green: 'bg-green-100 text-green-800 border-green-300',
    red:   'bg-red-100 text-red-800 border-red-300',
    amber: 'bg-amber-100 text-amber-900 border-amber-300',
    blue:  'bg-blue-100 text-blue-800 border-blue-300',
  }
  return (
    <section className="relative">
      {/* Banner image */}
      <div className="relative h-48 w-full overflow-hidden bg-neutral-200 sm:h-64 md:h-80">
        <SafeImage
          src={heroImg}
          alt={facility.name}
          kind="facility"
          className="h-full w-full object-cover"
        />
        {/* Dark gradient overlay for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        {/* Back button overlay */}
        <button
          onClick={onBack}
          className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow backdrop-blur hover:bg-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        {/* Title block overlay (bottom-left) */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="container mx-auto">
            <div className="flex flex-wrap items-end gap-3">
              {/* Logo / icon tile */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-white bg-white text-3xl shadow-lg sm:h-16 sm:w-16 sm:text-4xl">
                {typeCfg?.icon || '📍'}
              </div>
              <div className="min-w-0 flex-1 text-white">
                <div className="flex flex-wrap items-center gap-1.5">
                  {typeCfg?.label && (
                    <Badge variant="outline" className="border-white/40 bg-white/15 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
                      {typeCfg.label}
                    </Badge>
                  )}
                  {facility.verified && (
                    <Badge variant="outline" className="border-green-300/70 bg-green-500/90 text-[10px] font-bold uppercase tracking-wider text-white">
                      <BadgeCheck className="mr-0.5 h-3 w-3" /> Verified
                    </Badge>
                  )}
                  {facility.rewardsPartner && (
                    <Badge variant="outline" className="border-amber-300/70 bg-amber-500/90 text-[10px] font-bold uppercase tracking-wider text-white">
                      <Gift className="mr-0.5 h-3 w-3" /> Rewards Partner
                    </Badge>
                  )}
                  {isClaimed && (
                    <Badge variant="outline" className="border-blue-300/70 bg-blue-500/90 text-[10px] font-bold uppercase tracking-wider text-white">
                      <KeyRound className="mr-0.5 h-3 w-3" /> Claimed
                    </Badge>
                  )}
                </div>
                <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight drop-shadow sm:text-3xl md:text-4xl">
                  {facility.name}
                </h1>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-white/90 sm:text-sm">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{facility.address}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status pill (top-right) */}
        {statusMeta && (
          <div className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold shadow ${colorMap[statusMeta.color] || colorMap.amber}`}>
            <span>{statusMeta.icon}</span>
            <span>{statusMeta.label}</span>
          </div>
        )}
      </div>
    </section>
  )
}
