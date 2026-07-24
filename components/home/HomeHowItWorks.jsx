'use client'

import { HOME_HOW_IT_WORKS } from '@/constants/home_constants'

export default function HomeHowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden border-b border-neutral-100 bg-neutral-50 py-12 md:py-24">
      {/* subtle emerald glow accents */}
      <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 -translate-y-1/2 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-emerald-100/40 blur-3xl" />

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-4xl">How it works</h2>
          <p className="mt-2 text-sm text-neutral-600 md:mt-3 md:text-base">Three steps. Zero wasted trips.</p>
        </div>

        <div className="relative mt-10 md:mt-16">
          {/* dashed connector line running behind the step badges (desktop) */}
          <div className="absolute left-0 right-0 top-8 hidden md:block" aria-hidden="true">
            <div className="mx-auto h-px w-[70%] border-t-2 border-dashed border-emerald-300/70" />
          </div>

          <div className="grid gap-6 md:grid-cols-3 md:gap-6">
            {HOME_HOW_IT_WORKS.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.n} className="group relative flex flex-col items-center text-center">
                  {/* numbered badge — sits on the connector line */}
                  <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-base font-extrabold text-white shadow-lg shadow-emerald-600/25 ring-4 ring-neutral-50 transition-all duration-300 group-hover:-translate-y-1 group-hover:rotate-3 group-hover:shadow-xl group-hover:shadow-emerald-600/40 md:h-16 md:w-16 md:rounded-2xl md:text-xl">
                    {Icon ? <Icon className="h-5 w-5 md:h-7 md:w-7" /> : s.n}
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-600 bg-white text-[10px] font-extrabold text-emerald-700 shadow-sm md:-right-2 md:-top-2 md:h-6 md:w-6 md:text-[11px]">
                      {s.n}
                    </span>
                  </div>

                  {/* card */}
                  <div className="mt-3 w-full rounded-xl border border-neutral-100 bg-white p-3.5 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-emerald-200 group-hover:shadow-lg group-hover:shadow-emerald-100/60 md:mt-5 md:rounded-2xl md:p-5">
                    <div className="text-sm font-bold text-neutral-900 md:text-lg">{s.t}</div>
                    <div className="mt-1 text-xs leading-relaxed text-neutral-600 md:mt-2 md:text-[13px]">{s.d}</div>
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
