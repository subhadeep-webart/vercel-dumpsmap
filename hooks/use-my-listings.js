'use client'

// useMyListings — data read for the buyer dashboard (marketplace "me" page).
//
// The page (app/(app)/marketplace/me/page.js) inlined a /auth/me fetch plus a
// fetch('/api/marketplace/me') into useState/useEffect load()s with their own
// loading flag and a 1s countdown tick. This hook owns all of that:
//   • the current user comes from the shared useCurrentUser hook,
//   • /marketplace/me is a cached SWR read (deduped, single reload()),
//   • a 1s tick (only while the caller is on the reserved tab) drives the live
//     countdown, derived — not stored — via withLiveReservations().
//
// Auth gating (redirect to login when logged out / 401) stays in the page,
// which owns the router; this hook just surfaces `isLoggedOut` and the raw
// error so the page can react.

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api-client'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { withLiveReservations } from '@/lib/marketplace-helpers'

const fetcher = (path) => api.get(path)

const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useMyListings({ tab } = {}) {
  const { user, isLoading: userLoading, isLoggedOut } = useCurrentUser()

  // Only fetch the dashboard once we have a signed-in user (null key = no fetch).
  const key = user ? '/marketplace/me' : null
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, SWR_OPTS)

  // Live countdown refresh once per second, only while on the reserved tab.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (tab !== 'reserved') return
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [tab])

  const reservedWithLive = useMemo(
    () => withLiveReservations(data?.reserved || []),
    // tick is intentionally a dependency so the countdown re-derives each second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.reserved, tick],
  )

  return {
    user,
    isLoggedOut,
    data: data || null,
    // Match the old flag: show the spinner until the dashboard payload arrives.
    // True while the user is still resolving, or while the /marketplace/me read
    // is in flight — but never once we know we're logged out (the page redirects
    // then, and the old code's guards did the same).
    loading: !isLoggedOut && !data && (userLoading || !user || isLoading),
    error: error || null,
    reservedWithLive,
    reload: () => mutate(),
  }
}
