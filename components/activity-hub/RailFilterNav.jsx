'use client'

// RailFilterNav — the Activity Hub's post-type filter, rendered as the vertical
// nav in the left rail (replacing the old horizontal FilterBar chips).
//
// Two groups, matching the design:
//   1. Category filters (All Updates → Government) from FILTERS
//   2. "Updates & Community" — personal views (My Posts, Saved) from
//      PERSONAL_FILTERS, shown only to signed-in users
//
// Controlled: the active key and the change handler come from the page, exactly
// like FilterBar did, so switching the presentation changed no behaviour.
//
// Props:
//   counts — optional { [filterKey]: number } badge map, e.g. { alerts: 2 }.
//            Keys with no entry (or 0) render no badge.

import { FILTERS, PERSONAL_FILTERS } from '@/constants/activity_hub_constants'

export default function RailFilterNav({ user, filter, onChange, counts = {} }) {
  return (
    <nav aria-label="Filter feed by type" className="rounded-[16px] border border-[#E0EBE2] bg-white p-2">
      <ul className="space-y-0.5">
        {FILTERS.map((f) => (
          <li key={f.key}>
            <RailItem item={f} active={filter === f.key} count={counts[f.key]} onClick={() => onChange(f.key)} />
          </li>
        ))}
      </ul>

      {user && (
        <>
          <h2 className="px-3 pb-1 pt-4 text-[13px] font-semibold text-neutral-800">
            Updates &amp; Community
          </h2>
          <ul className="space-y-0.5">
            {PERSONAL_FILTERS.map((f) => (
              <li key={f.key}>
                <RailItem item={f} active={filter === f.key} count={counts[f.key]} onClick={() => onChange(f.key)} muted />
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  )
}

// A single nav row. The active row gets the tinted pill + the green left bar
// from the design; `muted` renders the personal-view icons in plain neutral
// (they are not post-type categories, so they carry no category colour).
function RailItem({ item, active, count, onClick, muted = false }) {
  const Icon = item.icon
  const label = item.railLabel || item.label
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative flex w-full items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
        active ? 'bg-green-50' : 'hover:bg-neutral-50'
      }`}
    >
      {active && (
        <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-green-700" />
      )}
      <Icon className={`h-5 w-5 shrink-0 ${muted ? 'text-neutral-600' : item.tone.split(' ')[0]}`} strokeWidth={1.8} />
      <span className={`flex-1 truncate text-[14px] ${active ? 'font-bold text-green-800' : 'font-normal text-neutral-700'}`}>
        {label}
      </span>
      {count > 0 && (
        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
          {count}
        </span>
      )}
    </button>
  )
}
