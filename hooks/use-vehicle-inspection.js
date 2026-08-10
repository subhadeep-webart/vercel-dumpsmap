'use client'

// useVehicleInspection — read a single inspection by id for the detail page
// (app/(app)/vehicle-inspections/[id]/page.js).
//
// Replaces the page's inlined fetch + manual loading/error state. Goes through
// the central api client (lib/api-client). A null id yields a null SWR key, so
// no request fires until the route param is present. setInspection lets the
// caller patch the cache after an edit without a full reload.

import useSWR from 'swr'
import { api } from '@/lib/api-client'

const fetcher = (path) => api.get(path)
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useVehicleInspection(id) {
  const key = id ? `/vehicle-inspections/${id}` : null
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, SWR_OPTS)

  return {
    inspection: data?.inspection || null,
    loading: isLoading && !data,
    error: error || null,
    reload: () => mutate(),
    // Patch the SWR cache with an updated inspection (no revalidation).
    setInspection: (inspection) => mutate({ inspection }, { revalidate: false }),
  }
}
