'use client'

// useVehicleInspections — data reads for the Vehicle Inspections list/dashboard
// page (app/(app)/vehicle-inspections/page.js).
//
// The page used to inline a two-way Promise.all against the stats + list
// endpoints with its own loading flag. This hook owns that: each endpoint is a
// cached, deduped SWR key, and a single reload() revalidates both after a
// mutation. All requests go through the central api client (lib/api-client).

import useSWR from 'swr'
import { api } from '@/lib/api-client'

const fetcher = (path) => api.get(path)
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useVehicleInspections(limit = 30) {
  const stats = useSWR('/vehicle-inspections/stats', fetcher, SWR_OPTS)
  const list = useSWR(`/vehicle-inspections?limit=${limit}`, fetcher, SWR_OPTS)

  const statsData = stats.data && !stats.data.error ? stats.data : null

  const reload = () => {
    stats.mutate()
    list.mutate()
  }

  return {
    stats: statsData,
    inspections: list.data?.inspections || [],
    loading: stats.isLoading || list.isLoading,
    reload,
  }
}
