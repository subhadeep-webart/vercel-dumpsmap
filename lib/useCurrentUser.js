'use client'

// useCurrentUser
// ---------------------------------------------------------------------------
// Loads the authoritative signed-in user from /api/auth/me via SWR, so any
// component can read the current user without inlining fetch + useEffect.
//
//   const { user, isLoading, isLoggedOut, error } = useCurrentUser()
//
// `isLikelyLoggedIn()` is only a client hint (see api-client): when it's false
// we skip the request entirely (null key → SWR no-ops) and report isLoggedOut,
// letting the caller redirect to login. When the request returns without a
// user, that's also treated as logged out.

import useSWR from 'swr'
import { api, isLikelyLoggedIn } from '@/lib/api-client'

const KEY = '/auth/me'

const fetcher = (path) => api.get(path)

export function useCurrentUser() {
  // Null key tells SWR not to fetch when we already know there's no session.
  const likely = isLikelyLoggedIn()
  const { data, error, isLoading } = useSWR(likely ? KEY : null, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  const user = data?.user || null
  // Logged out when we never had a token, or the server confirmed no user.
  const isLoggedOut = !likely || (!isLoading && !error && !user)

  return { user, isLoading: likely && isLoading, isLoggedOut, error }
}
