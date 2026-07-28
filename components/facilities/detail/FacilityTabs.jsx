'use client'

// Sticky tab navigation for the facility detail page. Reads the tab list from
// constants/facility_detail_constants. Extracted from
// app/facilities/[id]/page.js.

import { TABS } from '@/constants/facility_detail_constants'

export default function FacilityTabs({ active, onChange }) {
  // Left/Right arrow keys move between tabs (roving focus), matching the WAI
  // tabs pattern. Home/End jump to first/last.
  const onKeyDown = (e) => {
    const idx = TABS.findIndex((t) => t.key === active)
    let next = null
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    if (next != null) {
      e.preventDefault()
      onChange(TABS[next].key)
    }
  }

  return (
    <nav>
      <div role="tablist" aria-label="Facility sections" onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto px-2 sm:px-3">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = t.key === active
          return (
            <button
              key={t.key}
              role="tab"
              id={`facility-tab-${t.key}`}
              aria-selected={isActive}
              aria-controls="facility-tabpanel"
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(t.key)}
              className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3.5 text-sm font-semibold transition sm:px-4 ${
                isActive ? 'text-brand-700' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {/* Active underline pinned to the card's inner bottom edge. */}
              {isActive && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-600" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
