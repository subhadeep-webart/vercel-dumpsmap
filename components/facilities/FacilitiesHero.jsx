'use client'

// Hero section for the /facilities directory page.
//
// Extracted from app/facilities/page.js so the heading/intro copy lives in one
// reusable, self-contained unit. The Feed / Map view toggle lives in the
// directory toolbar (FacilitiesToolbar) — not here — so there's a single,
// unambiguous place to switch views.

export default function FacilitiesHero() {
  return (
    <section className="border-b border-neutral-200 bg-white">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Facilities Directory</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">Find recycling centers, transfer stations, donation drop-offs, and material yards near you. Search by city, name, or material — then tap any facility for live wait time, hours, and accepted items.</p>
      </div>
    </section>
  )
}
