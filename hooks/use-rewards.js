'use client'

// useRewards — all data reads for the Rewards page.
//
// The page component used to inline a four-way Promise.all against /auth/me and
// the three authenticated rewards endpoints (balance, history, redemptions),
// plus its own `bootstrapping` flag. This hook owns that: the signed-in user
// comes from the shared useCurrentUser hook, and each rewards endpoint is a
// cached, deduped SWR key so tab switches and re-mounts don't re-fetch. A single
// `reload()` revalidates everything after a redemption.
//
// All reads are gated on being (likely) logged in: when logged out we pass a
// null SWR key so nothing is fetched — matching the original page, which
// short-circuited on !isLikelyLoggedIn(). SWR errors fall back to empty/default
// data (the original used `.catch(() => null)` per request), so a failed read
// never breaks the page.

import useSWR from 'swr'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { isLikelyLoggedIn, api } from '@/lib/api-client'
import { HISTORY_LIMIT } from '@/constants/rewards_constants'

const fetcher = (path) => api.get(path)

// Don't hammer the API on window focus, and don't retry a failed request in a
// loop — the page renders an empty/logged-out state on error.
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useRewards() {
  const { user, isLoading: userLoading } = useCurrentUser()

  // Only fetch the authenticated rewards data when we (likely) have a session.
  // Null key = SWR no-op, mirroring the page's original !isLikelyLoggedIn()
  // short-circuit.
  const authed = isLikelyLoggedIn()

  const balance = useSWR(authed ? '/users/me/rewards/balance' : null, fetcher, SWR_OPTS)
  const history = useSWR(authed ? `/users/me/rewards/history?limit=${HISTORY_LIMIT}` : null, fetcher, SWR_OPTS)
  const redemptions = useSWR(authed ? '/users/me/rewards/redemptions' : null, fetcher, SWR_OPTS)

  // `bootstrapping` matches the page's original flag: true only while we're
  // still resolving the initial logged-in state / first reads. When logged out
  // it resolves immediately (no reads are in flight).
  const bootstrapping = authed
    ? (userLoading || balance.isLoading || history.isLoading || redemptions.isLoading)
    : false

  // Revalidate every read at once — call after a redemption.
  const reload = () => {
    balance.mutate()
    history.mutate()
    redemptions.mutate()
  }

  return {
    user: user || null,
    bootstrapping,
    // On error, SWR data is undefined → fall back to the same defaults the page
    // used (null balance, empty arrays).
    balance: balance.data || null,
    history: history.data?.entries || [],
    redemptions: redemptions.data?.redemptions || [],
    reload,
  }
}
