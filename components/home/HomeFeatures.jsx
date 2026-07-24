'use client'

import { FEATURES } from '@/constants/home_constants'

// Per-feature palette: icon tile gradient, glow, hover border + accent bar.
const FEATURE_THEMES = {
  emerald: {
    tile:   'from-emerald-400 to-emerald-600 shadow-emerald-500/30',
    glow:   'bg-emerald-400/25',
    border: 'group-hover:border-emerald-300',
    bar:    'from-emerald-400 to-emerald-600',
    ring:   'group-hover:shadow-emerald-200/70',
  },
  orange: {
    tile:   'from-amber-400 to-orange-500 shadow-orange-500/30',
    glow:   'bg-orange-400/25',
    border: 'group-hover:border-orange-300',
    bar:    'from-amber-400 to-orange-500',
    ring:   'group-hover:shadow-orange-200/70',
  },
  sky: {
    tile:   'from-sky-400 to-cyan-600 shadow-sky-500/30',
    glow:   'bg-sky-400/25',
    border: 'group-hover:border-sky-300',
    bar:    'from-sky-400 to-cyan-600',
    ring:   'group-hover:shadow-sky-200/70',
  },
  rose: {
    tile:   'from-rose-400 to-pink-600 shadow-rose-500/30',
    glow:   'bg-rose-400/25',
    border: 'group-hover:border-rose-300',
    bar:    'from-rose-400 to-pink-600',
    ring:   'group-hover:shadow-rose-200/70',
  },
}

export default function HomeFeatures() {
  return (
    <section
      id="features"
      className="relative overflow-hidden border-b border-neutral-100 bg-gradient-to-b from-white via-emerald-50/40 to-white py-16 md:py-24"
    >
      {/* ── ambient recycling-green atmosphere ─────────────────────────── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* soft blurred blobs */}
        <div className="dm-float absolute -left-32 top-10 h-80 w-80 rounded-full bg-emerald-300/25 blur-3xl" />
        <div className="dm-float-slow absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-teal-200/30 blur-3xl" />
        {/* faint dotted eco-grid */}
        <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle,theme(colors.emerald.300)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      <div className="container relative mx-auto px-4">
        {/* ── heading ──────────────────────────────────────────────────── */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="dm-reveal inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[10px] sm:px-4 sm:py-1.5 sm:text-[12px] font-bold uppercase tracking-wider text-emerald-700 shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            Why DumpMaps
          </span>

          <h2 className="dm-reveal mt-4 text-2xl sm:mt-5 sm:text-3xl font-bold tracking-tight md:text-4xl" style={{ animationDelay: '80ms' }}>
            Everything you need in{' '}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                one place.
              </span>
              <svg
                className="absolute -bottom-1 left-0 h-3 w-full text-emerald-400/70"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M2 8 C 50 2, 150 2, 198 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="dm-draw"
                />
              </svg>
            </span>
          </h2>

          <p className="dm-reveal mt-3 text-[13px] sm:mt-4 sm:text-base text-neutral-600" style={{ animationDelay: '160ms' }}>
            Fast, community-powered, and free. Built for haulers, homeowners, and everyone who recycles.
          </p>
        </div>

        {/* ── feature cards ────────────────────────────────────────────── */}
        <div className="mt-10 grid gap-4 sm:mt-14 sm:gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            const t = FEATURE_THEMES[f.color] ?? FEATURE_THEMES.emerald
            return (
              <div
                key={f.title}
                className="dm-reveal group relative"
                style={{ animationDelay: `${220 + i * 90}ms` }}
              >
                {/* colour glow that blooms on hover */}
                <div
                  className={`pointer-events-none absolute -inset-2 rounded-[26px] ${t.glow} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100`}
                  aria-hidden="true"
                />

                <div
                  className={`relative flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200/80 bg-white/90 p-4 sm:rounded-2xl sm:p-5 shadow-sm backdrop-blur transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-xl ${t.border} ${t.ring}`}
                >
                  {/* accent bar that wipes across the top on hover */}
                  <span
                    className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r ${t.bar} transition-transform duration-500 group-hover:scale-x-100`}
                    aria-hidden="true"
                  />
                  {/* watermark icon */}
                  <Icon
                    className="pointer-events-none absolute -bottom-4 -right-3 h-20 w-20 sm:h-24 sm:w-24 text-neutral-900/[0.03] transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110"
                    aria-hidden="true"
                  />

                  {/* icon tile */}
                  <div
                    className={`relative flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br text-white shadow-lg ${t.tile} transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110`}
                  >
                    <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
                    {/* shine sweep */}
                    <span
                      className="dm-shine pointer-events-none absolute inset-0 overflow-hidden rounded-xl sm:rounded-2xl"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="relative mt-4 text-[13px] sm:mt-5 sm:text-[15px] font-extrabold tracking-tight text-neutral-900">
                    {f.title}
                  </div>
                  <div className="relative mt-1 text-[11px] sm:mt-1.5 sm:text-[13px] leading-relaxed text-neutral-600">
                    {f.desc}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
