// recommendations-helpers.js
// ---------------------------------------------------------------------------
// Pure, React-free helpers for the Recommendations pages. These were inlined in
// the page components (the client-side facility name/city filter, the derived
// city-chip list, and the verified-level check). Hoisted here so the pages stay
// presentational and the logic is testable in isolation.

import { CITY_CHIP_LIMIT, VERIFIED_LEVELS } from '@/constants/recommendations_constants'

// Client-side facility filter: matches the search term against name or city.
// The API already type-filters; this narrows the returned list as the user
// types without an extra round trip. Empty query returns the list unchanged.
export function filterFacilitiesByQuery(list, q) {
  if (!q) return list
  const t = q.toLowerCase()
  return (list || []).filter(
    (f) => (f.name || '').toLowerCase().includes(t) || (f.city || '').toLowerCase().includes(t),
  )
}

// Distinct, capped list of contractor cities used to build the filter chips.
export function deriveCities(contractors) {
  const set = new Set()
  ;(contractors || []).forEach((c) => c.city && set.add(c.city))
  return Array.from(set).slice(0, CITY_CHIP_LIMIT)
}

// True when a contractor's verificationLevel earns the blue verified badge.
export function isVerified(level) {
  return VERIFIED_LEVELS.includes(level)
}
