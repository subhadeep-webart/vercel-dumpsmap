'use client'

// useReceipts — all data reads for the Receipt Center page.
//
// The page component used to inline a two-way Promise.all against
// /api/receipts/stats and /api/receipts?limit=50 with its own loading flag and a
// manual loadAll() re-fetch after every mutation. This hook owns that: each
// endpoint is a cached, deduped SWR key, so tab switches and re-mounts don't
// re-fetch, and a single reload() revalidates both after a mutation.
//
// All requests go through the central api client (lib/api-client), so auth,
// headers, JSON parsing, and timeout are handled in one place. The stats
// endpoint may legitimately return an { error } body (e.g. no data yet); we
// treat that like the old code did and expose null stats in that case.

import useSWR from 'swr'
import { api } from '@/lib/api-client'
import { RECEIPTS_LIMIT } from '@/constants/receipts_constants'

const fetcher = (path) => api.get(path)

// Don't hammer the API on window focus, and don't retry a failed request in a
// loop (the page shows an empty state / em dashes instead).
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useReceipts() {
  const stats = useSWR('/receipts/stats', fetcher, SWR_OPTS)
  const list = useSWR(`/receipts?limit=${RECEIPTS_LIMIT}`, fetcher, SWR_OPTS)

  const loading = stats.isLoading || list.isLoading

  // Revalidate both reads at once — call after any mutation.
  const reload = () => {
    stats.mutate()
    list.mutate()
  }

  return {
    // The old code ignored a stats body carrying an `error` field.
    stats: stats.data && !stats.data.error ? stats.data : null,
    receipts: list.data?.receipts || [],
    loading,
    reload,
  }
}

// Facility typeahead search used by the receipt form. Not a hook — a plain
// async lookup so the form keeps its debounce/abort logic. Returns up to 6
// facilities, or [] on any error (matches the old inline behaviour).
export async function searchFacilities(q) {
  try {
    const j = await api.get(`/facilities?q=${encodeURIComponent(q)}`)
    return (j.facilities || []).slice(0, 6)
  } catch {
    return []
  }
}
