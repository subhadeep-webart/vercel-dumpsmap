'use client'

// Hero section for the /facilities directory page.
//
// Extracted from app/facilities/page.js so the heading/intro copy and the
// "Map view" toggle live in one reusable, self-contained unit. The map toggle
// is delegated to the parent via onOpenMap so this component stays free of
// routing concerns.

import { MapPin } from 'lucide-react'

export default function FacilitiesHero({ onOpenMap }) {
  return (
    <section className="border-b border-neutral-200 bg-white">
      <div className="container mx-auto flex flex-wrap items-end justify-between gap-3 px-4 py-6 sm:py-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Facilities Directory</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">Find recycling centers, transfer stations, donation drop-offs, and material yards near you. Search by city, name, or material — then tap any facility for live wait time, hours, and accepted items.</p>
        </div>
        <button
          onClick={onOpenMap}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          aria-label="Open map view"
        >
          <MapPin className="h-4 w-4 text-emerald-600" /> Map view
        </button>
      </div>
    </section>
  )
}
