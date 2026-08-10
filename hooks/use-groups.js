'use client'

// useGroups / useCities — data reads for the community Groups list page
// (app/community/groups/page.js).
//
// The page inlined two effect-driven fetches: a filter-dependent GET against
// /community/groups (re-run whenever a filter changed) and a one-shot GET of
// /community/cities for the sidebar. Both now go through the central api client
// as SWR keys, so the filter query is just a cache key (no manual loading flag,
// no re-fetch on tab return) and a single reload() revalidates the list after a
// join/create mutation.

import useSWR from 'swr'
import { api } from '@/lib/api-client'
import { buildGroupsQuery } from '@/lib/groups-helpers'

const fetcher = (path) => api.get(path)
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

// Groups list, keyed by the current filter. Changing any filter changes the
// key, which SWR fetches (and caches) automatically.
export function useGroups(filter) {
  const key = `/community/groups?${buildGroupsQuery(filter)}`
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, SWR_OPTS)
  return {
    groups: data?.groups || [],
    loading: isLoading && !data,
    error: error || null,
    reload: () => mutate(),
  }
}

// Sidebar city list (group + post counts). Loaded once, cached for the session.
export function useCities() {
  const { data } = useSWR('/community/cities', fetcher, SWR_OPTS)
  return { cities: data?.cities || [] }
}
