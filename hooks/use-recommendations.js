'use client'

// use-recommendations — data reads for the Recommendations pages.
//
// Three distinct hooks, one per page, each replacing an inline fetch +
// useState/useEffect load cycle:
//   • useFacilityRecommendations(typeKey) — top-rated facilities directory.
//   • useContractorRecommendations(q, city) — contractor directory (server-side
//     search + city filter).
//   • useContractor(id) — a single contractor profile with its reviews.
//
// All requests go through the central api client (lib/api-client): auth, CSRF,
// JSON parsing, and timeouts are handled there. Each hook exposes a `reload()`
// so the pages can revalidate after a mutation (e.g. leaving a review).

import useSWR from 'swr'
import { api } from '@/lib/api-client'
import { FACILITY_LIMIT } from '@/constants/recommendations_constants'

const fetcher = (path) => api.get(path)

// Don't refetch on window focus, and don't retry a failed request in a loop —
// the pages render an empty state on error.
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

// Top-rated facilities. Only `typeKey` is part of the request; the free-text
// search is applied client-side by the page (see filterFacilitiesByQuery), so
// it isn't part of the SWR key.
export function useFacilityRecommendations(typeKey) {
  const params = new URLSearchParams()
  if (typeKey) params.set('typeKey', typeKey)
  params.set('limit', String(FACILITY_LIMIT))
  const { data, isLoading, mutate } = useSWR(
    `/recommendations/facilities?${params.toString()}`,
    fetcher,
    SWR_OPTS,
  )
  return {
    facilities: data?.facilities || [],
    loading: isLoading && !data,
    reload: () => mutate(),
  }
}

// Contractor directory. Both the search term and city filter are server-side,
// so they're part of the SWR key. The page debounces its inputs before they
// reach this hook.
export function useContractorRecommendations(q, city) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (city) params.set('city', city)
  const qs = params.toString()
  const { data, isLoading, mutate } = useSWR(
    `/recommendations/contractors${qs ? `?${qs}` : ''}`,
    fetcher,
    SWR_OPTS,
  )
  return {
    contractors: data?.contractors || [],
    loading: isLoading && !data,
    reload: () => mutate(),
  }
}

// A single contractor profile with reviews + aggregate. Null key (no id) means
// no fetch. `notFound` mirrors the page's old 404 branch; the api client throws
// an ApiError with code 'not_found' on a 404.
export function useContractor(id) {
  const key = id ? `/recommendations/contractors/${id}` : null
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, SWR_OPTS)
  return {
    data: data || null,
    notFound: error?.code === 'not_found' || error?.status === 404,
    loading: isLoading && !data && !error,
    reload: () => mutate(),
  }
}
