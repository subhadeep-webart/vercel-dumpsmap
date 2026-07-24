'use client'

import { FACILITY_CATEGORIES } from '@/constants/business_constants'

export default function BusinessFacilityCategories() {
  return (
    <section className="border-b border-neutral-100 bg-neutral-50 py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Facilities we partner with</h2>
          <p className="mt-3 text-neutral-600">DumpMaps supports every kind of drop-off — from transfer stations to buy-back centers.</p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {FACILITY_CATEGORIES.map((c) => {
            const Icon = c.i
            return (
              <div key={c.n} className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white p-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-2 text-[13px] font-semibold">{c.n}</div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
