'use client'

import { BENEFITS } from '@/constants/business_constants'

export default function BusinessBenefits() {
  return (
    <section className="border-b border-neutral-100 bg-white py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Why partner with DumpMaps?</h2>
          <p className="mt-3 text-neutral-600">A platform built to grow your facility and your impact.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b) => {
            const Icon = b.icon
            return (
              <div key={b.t} className="rounded-2xl border border-neutral-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="mt-4 font-bold">{b.t}</div>
                <div className="mt-1 text-[13px] leading-relaxed text-neutral-600">{b.d}</div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
