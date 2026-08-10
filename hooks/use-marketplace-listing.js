'use client'

// useMarketplaceListing — data read for a single marketplace listing.
//
// The detail page (app/(app)/marketplace/[id]/page.js) used to inline a
// fetch(`/api/marketplace/${id}`) into a useState/useEffect load() with its own
// loading + error flags. This hook owns that read via SWR: the request is
// cached + deduped, and a single `reload()` revalidates after a mutation.
//
// It also exposes `setListing`, which patches the SWR cache in place (no
// refetch) — the reserve/cancel/complete/quick-status mutations return the
// updated listing, and the page writes it straight back through this so the UI
// updates instantly, matching the old setListing(j.listing) behaviour.
//
// All requests go through the central api client (lib/api-client).

import useSWR from 'swr'
import { api } from '@/lib/api-client'

const fetcher = (path) => api.get(path)

const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useMarketplaceListing(id) {
  const key = id ? `/marketplace/${id}` : null // null key = no fetch
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, SWR_OPTS)

  // The endpoint may return { listing } or the listing object directly; support
  // both (matches the old `const data = j.listing || j`).
  const listing = data ? (data.listing || data) : null

  return {
    listing,
    loading: isLoading && !data,
    // Preserve the old behaviour: a load error message, else "Not found" once a
    // load has resolved with no listing.
    error: error ? (error.data?.error || error.message || 'Not found') : null,
    reload: () => mutate(),
    // Patch the cache in place with a fresh listing from a mutation response.
    setListing: (l) => mutate(l ? { listing: l } : l, { revalidate: false }),
  }
}
