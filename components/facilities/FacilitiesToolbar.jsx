'use client'

// Toolbar for the facilities directory: feed/map view toggle, search input,
// and the Near Me / Filters / Sort action row (with the sort dropdown).
//
// Extracted from HomeShell.jsx. Purely presentational — all state lives in the
// parent FacilitiesTab and is threaded through props.

import {
  Search,
  Locate,
  Map as MapIcon,
  Filter as FilterIcon,
  Activity,
  ArrowUpDown,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FACILITY_SORT_OPTIONS } from '@/constants/facility_constants'

export default function FacilitiesToolbar({
  q,
  onQChange,
  onSearchSubmit,
  onNearMe,
  onOpenFilters,
  onOpenMap,
  sortBy,
  onSortChange,
  sortOpen,
  onSortOpenChange,
}) {
  return (
    <>
      {/* View mode toggle — feed-first; map is optional */}
      <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-1">
        <div className="inline-flex">
          <button
            className="rounded-md bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-800 ring-1 ring-brand-200"
            aria-pressed="true"
          >
            <Activity className="mr-1 inline h-3.5 w-3.5" /> Feed view
          </button>
          <button
            onClick={() => { try { localStorage.setItem('dm_view_mode', 'map') } catch {}; onOpenMap?.() }}
            className="ml-1 rounded-md px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
            aria-pressed="false"
          >
            <MapIcon className="mr-1 inline h-3.5 w-3.5" /> Map view
          </button>
        </div>
        <span className="hidden text-[10px] uppercase tracking-wide text-neutral-400 sm:inline">Feed-first · Map optional</span>
      </div>

      {/* Search & action row */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
            placeholder="Search city, facility, or material…"
            className="h-11 pl-9 text-[15px]"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 md:flex md:gap-2">
          <Button variant="outline" onClick={onNearMe} className="h-10 justify-center md:flex-none">
            <Locate className="mr-1 h-4 w-4 text-emerald-600" /> Near Me
          </Button>
          <Button variant="outline" onClick={onOpenFilters} className="h-10 justify-center">
            <FilterIcon className="mr-1 h-4 w-4 text-emerald-600" /> Filters
          </Button>
          <div className="relative">
            <Button variant="outline" onClick={() => onSortOpenChange(!sortOpen)} className="h-10 w-full justify-center">
              <ArrowUpDown className="mr-1 h-4 w-4 text-emerald-600" /> Sort
            </Button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => onSortOpenChange(false)} aria-hidden="true" />
                <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
                  {FACILITY_SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.k}
                      onClick={() => { onSortChange(opt.k); onSortOpenChange(false) }}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-neutral-50 ${sortBy === opt.k ? 'font-bold text-emerald-700' : 'text-neutral-800'}`}
                    >
                      {opt.label}
                      {sortBy === opt.k && <Check className="h-4 w-4 text-emerald-600" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
