'use client'

// Facilities directory container.
//
// Owns all state (query, filters, sort, geolocation, loaded facilities) and the
// data fetch, then composes the presentational pieces:
//   • FacilitiesToolbar     — view toggle, search, Near Me / Filters / Sort
//   • FacilityRow           — desktop/tablet (≥ md) rows
//   • MobileFacilityCard    — mobile (< md) cards
//   • FacilitiesFilterSheet — bottom filter sheet
//   • QuickCheckInModal     — quick check-in flow
//
// Extracted from HomeShell.jsx (which now re-exports this) so the standalone
// /facilities page and the in-app feed share one implementation.

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout, SAMPLE_FALLBACK_FACILITIES, SAN_JOSE_DEFAULT } from '@/components/MapSafety'
import MobileFacilityCard from '@/components/facilities/MobileFacilityCard'
import QuickCheckInModal from '@/components/QuickCheckInModal'
import FacilityRow from '@/components/facilities/FacilityRow'
import FacilitiesToolbar from '@/components/facilities/FacilitiesToolbar'
import FacilitiesFilterSheet from '@/components/facilities/FacilitiesFilterSheet'
import ActiveFilterChips from '@/components/facilities/ActiveFilterChips'
import { FACILITY_TYPES, MATERIALS, FACILITY_SORT_OPTIONS } from '@/constants/facility_constants'

export default function FacilitiesTab({ onFacilityOpen, onOpenMap, onRequireLogin }) {
  const [facilities, setFacilities] = useState(SAMPLE_FALLBACK_FACILITIES)
  const [loading, setLoading] = useState(true)
  const [usedFallback, setUsedFallback] = useState(false)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [materialFilter, setMaterialFilter] = useState('all')
  const [maxKm, setMaxKm] = useState('any')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [hasAlertsOnly, setHasAlertsOnly] = useState(false)
  const [userLoc, setUserLoc] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [checkinFacility, setCheckinFacility] = useState(null)
  const [sortBy, setSortBy] = useState('distance')  // distance | rating | recent | name
  const [sortOpen, setSortOpen] = useState(false)

  const nearMe = () => {
    if (!navigator?.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setUserLoc(SAN_JOSE_DEFAULT),
      { timeout: 5000 },
    )
  }
  useEffect(() => { nearMe() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (typeFilter !== 'all') p.set('types', typeFilter)
      if (materialFilter !== 'all') p.set('materials', materialFilter)
      if (verifiedOnly) p.set('verified', 'true')
      if (q) p.set('q', q)
      if (userLoc) {
        p.set('lat', userLoc.lat)
        p.set('lng', userLoc.lng)
        if (maxKm !== 'any') p.set('maxKm', maxKm)
      }
      const j = await fetchWithTimeout(`/api/facilities?${p.toString()}`, { timeoutMs: 8000 })
      let docs = j.facilities || []
      if (hasAlertsOnly) docs = docs.filter((f) => f.activeAlertCount > 0)
      // Client-side sort (respects live user selection without server round-trip).
      docs = [...docs].sort((a, b) => {
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
        if (sortBy === 'name')   return String(a.name || '').localeCompare(String(b.name || ''))
        if (sortBy === 'recent') {
          const ta = new Date(a.liveStatusUpdatedAt || a.currentStatusUpdatedAt || a.updatedAt || 0).getTime()
          const tb = new Date(b.liveStatusUpdatedAt || b.currentStatusUpdatedAt || b.updatedAt || 0).getTime()
          return tb - ta
        }
        // default: distance (nulls last)
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY
        const db2 = b.distanceKm ?? Number.POSITIVE_INFINITY
        return da - db2
      })
      setFacilities(docs)
      setUsedFallback(false)
    } catch {
      setFacilities(SAMPLE_FALLBACK_FACILITIES)
      setUsedFallback(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [typeFilter, materialFilter, verifiedOnly, hasAlertsOnly, maxKm, userLoc, refreshKey, sortBy])

  const resetFilters = () => {
    setTypeFilter('all'); setMaterialFilter('all'); setMaxKm('any')
    setVerifiedOnly(false); setHasAlertsOnly(false)
  }

  // Active-filter chips — one entry per applied filter, each with its own remover.
  const activeChips = [
    typeFilter !== 'all' && { key: 'type', label: `Type: ${typeFilter}`, onRemove: () => setTypeFilter('all') },
    materialFilter !== 'all' && { key: 'material', label: `Material: ${materialFilter}`, onRemove: () => setMaterialFilter('all') },
    maxKm !== 'any' && { key: 'distance', label: `Within ${maxKm} km`, onRemove: () => setMaxKm('any') },
    verifiedOnly && { key: 'verified', label: 'Verified only', onRemove: () => setVerifiedOnly(false) },
    hasAlertsOnly && { key: 'alerts', label: 'Has live alerts', onRemove: () => setHasAlertsOnly(false) },
  ].filter(Boolean)

  const sortLabel = FACILITY_SORT_OPTIONS.find((o) => o.k === sortBy)?.label

  return (
    <div className="space-y-3">
      <FacilitiesToolbar
        q={q}
        onQChange={setQ}
        onSearchSubmit={() => setRefreshKey((k) => k + 1)}
        onNearMe={nearMe}
        onOpenFilters={() => setFiltersOpen(true)}
        onOpenMap={onOpenMap}
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortOpen={sortOpen}
        onSortOpenChange={setSortOpen}
      />

      <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} sortLabel={sortLabel} />

      {usedFallback && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-neutral-400" /> Demo facilities — couldn't reach the live server.
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{loading ? 'Loading…' : `${facilities.length} facilities`}</span>
        <Button variant="ghost" size="sm" onClick={() => setRefreshKey((k) => k + 1)} className="h-6 px-2 text-xs">
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>

      <div className="space-y-2">
        {!loading && facilities.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No facilities match. Adjust filters or expand distance.
          </div>
        )}
        {/* Mobile-only cards (< md) — dedicated vertical layout per P0 rebuild */}
        <div className="space-y-3 md:hidden">
          {facilities.map((f) => (
            <MobileFacilityCard
              key={`m-${f.id}`}
              f={f}
              onQuickCheckIn={(facility) => setCheckinFacility(facility)}
            />
          ))}
        </div>
        {/* Desktop/tablet rows (≥ md) — existing horizontal layout preserved */}
        <div className="hidden space-y-2 md:block">
          {facilities.map((f) => (
            <FacilityRow key={f.id} f={f} onOpen={() => onFacilityOpen?.(f.id)} onOpenMap={onOpenMap} onQuickCheckIn={(facility) => setCheckinFacility(facility)} />
          ))}
        </div>
      </div>

      <FacilitiesFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        facilityTypes={FACILITY_TYPES}
        materials={MATERIALS}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        materialFilter={materialFilter}
        onMaterialFilterChange={setMaterialFilter}
        maxKm={maxKm}
        onMaxKmChange={setMaxKm}
        verifiedOnly={verifiedOnly}
        onVerifiedOnlyChange={setVerifiedOnly}
        hasAlertsOnly={hasAlertsOnly}
        onHasAlertsOnlyChange={setHasAlertsOnly}
        resultCount={facilities.length}
        onReset={resetFilters}
      />

      <QuickCheckInModal
        open={!!checkinFacility}
        facility={checkinFacility}
        onClose={() => setCheckinFacility(null)}
        onSubmitted={() => setCheckinFacility(null)}
        onRequireLogin={onRequireLogin}
      />
    </div>
  )
}
