'use client'

// Sticky tab navigation for the facility detail page. Reads the tab list from
// constants/facility_detail_constants. Extracted from
// app/facilities/[id]/page.js.

import { TABS } from '@/constants/facility_detail_constants'

export default function FacilityTabs({ active, onChange }) {
  return (
    <nav className="sticky top-14 z-10 border-b border-neutral-200 bg-white shadow-sm">
      <div className="container mx-auto flex gap-0 overflow-x-auto px-2 sm:px-4">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = t.key === active
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-semibold transition sm:px-4 ${
                isActive ? 'text-green-700' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {isActive && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-green-600" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
