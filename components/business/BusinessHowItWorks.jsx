'use client'

import { HOW_IT_WORKS } from '@/constants/business_constants'

export default function BusinessHowItWorks() {
  return (
    <section className="relative overflow-hidden border-b border-neutral-100 bg-neutral-50 py-16 md:py-24">
      {/* subtle emerald glow accents */}
      <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 -translate-y-1/2 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-emerald-100/40 blur-3xl" />

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">How it works</h2>
          <p className="mt-3 text-neutral-600">Four steps to launch your DumpMaps partnership.</p>
        </div>

        <div className="relative mt-16">
          {/* dashed connector line running behind the step badges (desktop) */}
          <div className="absolute left-0 right-0 top-8 hidden md:block" aria-hidden="true">
            <div className="mx-auto h-px w-[78%] border-t-2 border-dashed border-emerald-300/70" />
          </div>

          <div className="grid gap-10 md:grid-cols-4 md:gap-6">
            {HOW_IT_WORKS.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.n} className="group relative flex flex-col items-center text-center">
                  {/* numbered badge — sits on the connector line */}
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 ring-4 ring-neutral-50 transition-all duration-300 group-hover:-translate-y-1 group-hover:rotate-3 group-hover:shadow-xl group-hover:shadow-emerald-600/40">
                    {Icon && <Icon className="h-7 w-7" />}
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-600 bg-white text-[11px] font-extrabold text-emerald-700 shadow-sm">
                      {s.n}
                    </span>
                  </div>

                  {/* card */}
                  <div className="mt-5 w-full rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-emerald-200 group-hover:shadow-lg group-hover:shadow-emerald-100/60">
                    <div className="text-lg font-bold text-neutral-900">{s.t}</div>{/* step number shown on the badge chip above */}
                    <div className="mt-2 text-[13px] leading-relaxed text-neutral-600">{s.d}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
