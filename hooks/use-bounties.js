'use client'

// useBounties — data reads for the Bounties page.
//
// The page component used to inline an /auth/me fetch (guarded by
// isLikelyLoggedIn) and an /api/bounties fetch in a useEffect, plus a bespoke
// `reload()` that re-fetched the list after a mutation. This hook owns that:
// the bounty list is a cached, deduped SWR key so re-mounts don't re-fetch, and
// `reload()` revalidates it after any write.
//
// All requests go through the central api client (lib/api-client), so auth,
// headers, JSON parsing, and timeout live in one place. The signed-in user
// comes from the shared useCurrentUser hook rather than a bespoke /auth/me
// fetch.

import { useCurrentUser } from '@/lib/useCurrentUser'
import useSWR from 'swr'
import { api } from '@/lib/api-client'

const fetcher = (path) => api.get(path)

// Don't hammer the API on window focus, and don't retry a failed request in a
// loop (the page shows a loading skeleton / empty state).
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useBounties() {
  const { user } = useCurrentUser()

  const { data, isLoading, mutate } = useSWR('/bounties', fetcher, SWR_OPTS)

  return {
    user: user || null,
    bounties: data?.bounties || [],
    // Match the old flag: true until the first list response lands.
    loading: isLoading && !data,
    // Revalidate the list — call after any mutation.
    reload: () => mutate(),
  }
}
