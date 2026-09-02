'use client'

// FilterBar — the story-style horizontal filter chips. Logged-in users get an
// extra "My Posts" chip appended. Controlled: the active key + change handler
// come from the page.

import { FILTERS, PERSONAL_FILTERS } from '@/constants/activity_hub_constants'

export default function FilterBar({ user, filter, onChange }) {
  const chips = user ? [...FILTERS, ...PERSONAL_FILTERS] : FILTERS
  return (
    <div className="mb-4 -mx-4 flex gap-2.5 overflow-x-auto scroll-smooth px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-3 sm:px-0">
      {chips.map((f) => {
        const Icon = f.icon
        const isActive = filter === f.key
        return (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            aria-pressed={isActive}
            className="group flex shrink-0 flex-col items-center gap-1.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            <span
              className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full transition-all duration-200 group-hover:scale-105 sm:h-14 sm:w-14 ${
                isActive ? 'shadow-md ring-2 ring-green-500 ring-offset-2' : 'group-hover:shadow-sm'
              } ${f.tone}`}
            >
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <span className={`text-[11px] font-bold transition-colors ${isActive ? 'text-green-700' : 'text-neutral-600 group-hover:text-neutral-900'}`}>
              {f.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
