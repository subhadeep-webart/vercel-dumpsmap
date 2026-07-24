'use client'

import { HOME_FACILITY_CATEGORIES } from '@/constants/home_constants'
import { ChevronRight, Recycle } from 'lucide-react'

// Split the categories into two belts that scroll in opposite directions.
const MID = Math.ceil(HOME_FACILITY_CATEGORIES.length / 2)
const ROW_TOP = HOME_FACILITY_CATEGORIES.slice(0, MID)
const ROW_BOTTOM = HOME_FACILITY_CATEGORIES.slice(MID)

function CategoryChip({ c, onClick }) {
  const Icon = c.icon
  return (
    <button
      onClick={onClick}
      className="group relative flex w-[212px] shrink-0 items-center gap-2.5 overflow-hidden rounded-xl border border-neutral-200/80 bg-white p-3 text-left shadow-sm sm:w-[268px] sm:gap-3 sm:rounded-2xl sm:p-4 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-200/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
    >
      {/* wash that slides in from the left */}
      <span
        className="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-gradient-to-r from-emerald-50 to-transparent transition-transform duration-500 ease-out group-hover:scale-x-100"
        aria-hidden="true"
      />
      <span
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 sm:h-11 sm:w-11 sm:rounded-xl text-emerald-700 ring-1 ring-inset ring-emerald-100 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-emerald-400 group-hover:to-teal-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-emerald-500/40 group-hover:ring-transparent"
      >
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </span>
      <span className="relative min-w-0">
        <span className="block truncate text-[13px] font-bold tracking-tight text-neutral-900 sm:text-base">{c.name}</span>
        <span
          className="block truncate text-[11px] text-neutral-500 sm:text-[12px]"
          dangerouslySetInnerHTML={{ __html: c.desc }}
        />
      </span>
      <ChevronRight className="relative ml-auto h-4 w-4 shrink-0 text-neutral-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-emerald-600" />
    </button>
  )
}

// One belt. The row is duplicated so the translate loop is seamless; the
// duplicate is aria-hidden so screen readers only announce each category once.
function Belt({ items, reverse, duration, onCategoryClick }) {
  return (
    <div className="dm-belt group/belt relative flex overflow-hidden py-2">
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1 ? 'true' : undefined}
          className={`dm-belt-track flex shrink-0 gap-3 pr-3 sm:gap-4 sm:pr-4 ${reverse ? 'dm-belt-rev' : ''}`}
          style={{ animationDuration: `${duration}s` }}
        >
          {items.map((c) => (
            <CategoryChip key={`${copy}-${c.name}`} c={c} onClick={onCategoryClick} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function HomeFacilityCategories({ onCategoryClick }) {
  return (
    <section
      id="categories"
      className="relative overflow-hidden border-b border-neutral-100 bg-gradient-to-b from-white via-emerald-50/40 to-white py-16 md:py-24"
    >
      {/* ── ambient atmosphere ─────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="dm-float-slow absolute -right-32 top-8 h-96 w-96 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="dm-float absolute -left-28 bottom-0 h-80 w-80 rounded-full bg-teal-200/30 blur-3xl" />
      </div>

      <div className="relative">
        {/* ── heading ──────────────────────────────────────────────────── */}
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <span className="dm-reveal inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[10px] font-bold sm:gap-2 sm:px-4 sm:py-1.5 sm:text-[12px] uppercase tracking-wider text-emerald-700 shadow-sm backdrop-blur">
              <Recycle className="dm-spin h-3 w-3 sm:h-3.5 sm:w-3.5" />
              {HOME_FACILITY_CATEGORIES.length} drop-off types
            </span>

            <h2
              className="dm-reveal mt-4 text-2xl font-bold tracking-tight sm:mt-5 sm:text-3xl md:text-4xl"
              style={{ animationDelay: '80ms' }}
            >
              Every kind of drop-off, in{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                one map.
              </span>
            </h2>

            <p className="dm-reveal mt-3 text-[13px] text-neutral-600 sm:mt-4 sm:text-base" style={{ animationDelay: '160ms' }}>
              Whether you&apos;re recycling, donating, or disposing — we cover it.
            </p>
          </div>
        </div>

        {/* ── sorting belts ────────────────────────────────────────────── */}
        <div
          className="dm-reveal relative mt-8 sm:mt-12 [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)]"
          style={{ animationDelay: '220ms' }}
        >
          <Belt items={ROW_TOP} duration={38} onCategoryClick={onCategoryClick} />
          <Belt items={ROW_BOTTOM} duration={46} reverse onCategoryClick={onCategoryClick} />
        </div>

        <p className="mt-5 text-center text-[11px] text-neutral-400 sm:mt-6 sm:text-[12px]">Hover to pause · tap any category to explore the map</p>
      </div>
    </section>
  )
}
