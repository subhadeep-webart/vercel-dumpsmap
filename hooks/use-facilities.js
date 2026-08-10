'use client'

// useFacilitiesDirectory — read-side container for the /facilities LIST page.
//
// The facilities directory bootstraps two pieces of signed-in state: the
// current user (for the map header / account menu) and the set of favorited
// facility ids (so saved facilities light up). The page used to inline a
// /api/auth/me fetch + useEffect plus a /api/users/me/contributions fetch; both
// now route through the central api client via SWR here.
//
// The current user comes from the shared useCurrentUser() hook. Favorites are
// fetched lazily — the SWR key stays null until we know there's a session, so a
// logged-out visitor never pays for the request. `setFavoriteIds` is exposed so
// the actions hook can optimistically patch the list after a toggle without a
// round-trip.
//
// NOTE: distinct from hooks/use-facility-detail.js — that serves the facility
// DETAIL page. This one is the directory/list read.

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api-client'
import { useCurrentUser } from '@/lib/useCurrentUser'

const fetcher = (path) => api.get(path)
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useFacilitiesDirectory() {
  const { user: currentUser } = useCurrentUser()

  // Adopt the SWR user as local state so an in-place AuthDialog login (which
  // yields a user object directly) can override it without a refetch, and
  // logout can clear it.
  const [user, setUser] = useState(null)
  useEffect(() => {
    if (currentUser) setUser(currentUser)
  }, [currentUser])

  // Favorites — only fetched once we have a signed-in user (null key = no fetch).
  const favKey = user ? '/users/me/contributions' : null
  const { data: contributions } = useSWR(favKey, fetcher, SWR_OPTS)

  const [favoriteIds, setFavoriteIds] = useState([])
  useEffect(() => {
    setFavoriteIds(contributions?.favoriteIds || [])
  }, [contributions])

  return { user, setUser, favoriteIds, setFavoriteIds }
}
