'use client'

// useNearbyFacilities — read-side for the Activity Hub's "Facilities Near You"
// right-rail card.
//
// Geolocates the browser once, then asks the facilities list endpoint for the
// closest few. The API already does the distance work: given lat/lng it
// enriches every doc with `distanceKm`, filters by `maxKm`, and sorts nearest
// first — so this hook just supplies coordinates and slices the head.
//
// Permission denied / unsupported / timed out all fall back to the San Jose
// pilot centre (the same default FacilitiesTab uses) rather than rendering
// nothing: a signed-out or location-blocked visitor still sees the pilot area's
// facilities, which is more useful than an empty card.

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api-client'
import { SAN_JOSE_DEFAULT } from '@/components/MapSafety'

const fetcher = (path) => api.get(path)
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

const DEFAULT_LIMIT = 4
const MAX_KM = 50

export function useNearbyFacilities({ limit = DEFAULT_LIMIT } = {}) {
  // null until geolocation resolves one way or the other, which keeps the SWR
  // key null and stops us firing a request against the wrong coordinates first.
  const [coords, setCoords] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      setCoords(SAN_JOSE_DEFAULT)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setCoords(SAN_JOSE_DEFAULT),
      { timeout: 5000 },
    )
  }, [])

  const key = coords
    ? `/facilities?lat=${coords.lat}&lng=${coords.lng}&maxKm=${MAX_KM}`
    : null
  const { data, error, isLoading } = useSWR(key, fetcher, SWR_OPTS)

  return {
    facilities: (data?.facilities || []).slice(0, limit),
    // `coords === null` means geolocation hasn't answered yet — still loading
    // from the card's point of view, even though no request is in flight.
    loading: !coords || isLoading,
    error,
  }
}
