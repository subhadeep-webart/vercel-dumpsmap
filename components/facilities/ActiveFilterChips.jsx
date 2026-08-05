'use client'

// Active-filter chip row for the facilities directory (feed + map views).
//
// Shows the currently-applied filters as removable pills so users can see what's
// active at a glance and delete any single filter with its ✕ — the standard
// "search results" UX. Purely presentational: the parent builds the `chips`
// array from its own filter state and supplies each chip's onRemove handler.
//
// chips: Array<{ key: string, label: string, onRemove: () => void }>
// onClearAll?: () => void   — when provided (and there are chips), shows a
//                             "Clear all" action at the end of the row.
// sortLabel?: string        — active sort option label (e.g. "Nearest"). When
//                             set, renders a non-removable "Sorted by" pill so
//                             the user can see the current sort at a glance.

import { X, ArrowUpDown } from 'lucide-react'

export default function ActiveFilterChips({ chips = [], onClearAll, sortLabel, className = '' }) {
  // Render nothing only when there are neither filter chips nor a sort to show.
  if (!chips.length && !sortLabel) return null
  return (
    // On mobile we keep everything on ONE line and let it scroll sideways so the
    // "Sorted by" pill sits inline with the filter chips instead of wrapping to
    // its own row. From sm+ we allow normal wrapping.
    <div
      className={`-mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 ${className}`}
    >
      {sortLabel && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 py-1 pl-2 pr-2.5 text-xs font-medium text-neutral-600">
          <ArrowUpDown className="h-3 w-3 text-emerald-600" />
          <span className="text-neutral-400">Sorted by</span>
          <span className="font-semibold text-neutral-700">{sortLabel}</span>
        </span>
      )}
      {chips.length > 0 && (
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          Filters
        </span>
      )}
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.onRemove}
          className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-brand-800 transition hover:border-brand-300 hover:bg-brand-100"
          aria-label={`Remove filter ${c.label}`}
        >
          <span className="max-w-[160px] truncate">{c.label}</span>
          <span className="flex h-4 w-4 items-center justify-center rounded-full text-brand-500 transition group-hover:bg-brand-200 group-hover:text-brand-900">
            <X className="h-3 w-3" />
          </span>
        </button>
      ))}
      {onClearAll && chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-0.5 shrink-0 text-xs font-semibold text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
