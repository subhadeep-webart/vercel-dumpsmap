'use client'

// Hero banner for the facility detail page — banner image with a gradient
// overlay, back button, logo/name/address block, badges, and a status pill.
// Extracted from app/facilities/[id]/page.js.

import SafeImage from '@/components/SafeImage'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, MapPin, BadgeCheck, Gift, KeyRound } from 'lucide-react'
import { TypeIcon, StatusIcon } from '@/lib/facility-icons'
import { STATUS_PILL_COLORS } from '@/constants/facility_detail_constants'

export default function FacilityHero({ facility, heroImg, typeCfg, statusMeta, isClaimed, onBack }) {
  return (
    <section className="relative">
      {/* Banner image */}
      <div className="relative h-56 w-full overflow-hidden bg-neutral-200 sm:h-72 md:h-96">
        <SafeImage
          src={heroImg}
          alt={facility.name}
          kind="facility"
          className="h-full w-full scale-105 object-cover"
        />
        {/* Gradient overlays: strong bottom-up for text legibility, plus a
            subtle top vignette so the back button / status pill stay readable. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />
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
            <div className="flex flex-wrap items-end gap-3 sm:gap-4">
              {/* Logo / icon tile */}
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/95 text-neutral-800 shadow-xl ring-1 ring-black/5 backdrop-blur-sm sm:h-20 sm:w-20">
                <TypeIcon typeKey={facility.typeKey} className="h-8 w-8 sm:h-9 sm:w-9" />
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
          <div className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold shadow ${STATUS_PILL_COLORS[statusMeta.color] || STATUS_PILL_COLORS.amber}`}>
            <StatusIcon status={statusMeta.value} className="h-3.5 w-3.5" />
            <span>{statusMeta.label}</span>
          </div>
        )}
      </div>
    </section>
  )
}
