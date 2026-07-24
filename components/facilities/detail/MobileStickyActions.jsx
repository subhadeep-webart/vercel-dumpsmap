'use client'

// Mobile-only sticky action bar pinned above the bottom nav — Directions, Call,
// and Earn/Review. Extracted from app/facilities/[id]/page.js.

import { Navigation, Phone, Gift, Star } from 'lucide-react'

export default function MobileStickyActions({ facility, directionsUrl }) {
  return (
    <div
      className="fixed inset-x-0 z-30 border-t border-neutral-200 bg-white shadow-[0_-6px_18px_rgba(0,0,0,0.06)] md:hidden"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}
    >
      <div className="container mx-auto grid grid-cols-3 gap-2 px-3 py-2">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-green-700 px-3 py-2.5 text-sm font-bold text-white shadow hover:bg-green-800"
        >
          <Navigation className="h-4 w-4" /> Directions
        </a>
        {facility.phone ? (
          <a
            href={`tel:${facility.phone}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-green-300 bg-green-50 px-3 py-2.5 text-sm font-bold text-green-800 hover:bg-green-100"
          >
            <Phone className="h-4 w-4" /> Call
          </a>
        ) : (
          <span className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-bold text-neutral-400">
            <Phone className="h-4 w-4" /> No phone
          </span>
        )}
        {facility.rewardsPartner ? (
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-green-600 px-3 py-2.5 text-sm font-bold text-white shadow hover:bg-green-700"
          >
            <Gift className="h-4 w-4" /> Earn
          </button>
        ) : (
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
          >
            <Star className="h-4 w-4" /> Review
          </button>
        )}
      </div>
    </div>
  )
}
