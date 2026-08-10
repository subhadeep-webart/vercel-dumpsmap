'use client'

// useDisposalIntelligence — the single data read for the Disposal Intelligence
// page.
//
// The page component used to inline a raw fetch('/api/receipts/stats') in a
// useEffect with its own loading flag and error swallowing. This hook owns that
// read: the request goes through the central api client (lib/api-client), so
// auth, headers, JSON parsing, and timeout are handled in one place, and SWR
// caches/dedupes it so re-mounts and tab switches don't re-fetch.
//
// The API returns { error } on failure rather than a non-2xx in some cases; we
// treat any stats payload carrying an `error` field as "no data" so the page
// falls back to its empty state exactly as before.

import useSWR from 'swr'
import { api } from '@/lib/api-client'

const fetcher = (path) => api.get(path)

// Don't hammer the API on window focus, and don't retry a failed request in a
// loop — the page shows an empty state when there's nothing to show.
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useDisposalIntelligence() {
  const { data, error, isLoading, mutate } = useSWR('/receipts/stats', fetcher, SWR_OPTS)

  // Preserve the original behaviour: a payload with an `error` field is not a
  // usable stats object, and any fetch failure is swallowed into "no data".
  const stats = data && !data.error ? data : null

  return {
    stats,
    loading: isLoading && !data,
    error: error || null,
    reload: () => mutate(),
  }
}
