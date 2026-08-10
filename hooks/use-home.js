'use client'

// useHome — data reads + top-level state for the public home/landing page ("/").
//
// The page ("/") used to inline three raw fetches: /auth/me on mount,
// /users/me/contributions to seed the favorited-facility ids, and (in the
// actions hook) a favorites toggle. It also owned the deep-link auth popup,
// the "logged-in users landing on / get swept to /dashboard" redirect, and the
// global dm:teaser listener. All of that data/session logic lives here so the
// page component stays a thin view/router.
//
// The current user rides an httpOnly cookie, so we can't gate the read on a
// JS-readable token — we always ask the server via SWR and treat "200 with a
// null user" as logged-out. The result seeds a *local* user state so the page's
// dialogs (auth/profile/logout) can update it in memory without a refetch.

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { api } from '@/lib/api-client'

const fetcher = (path) => api.get(path)

// Don't re-fetch the session on window focus or retry-loop a failed request;
// the page renders a logged-out view instead.
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useHome() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Local, mutable session state. Seeded from the /auth/me read below, but the
  // page's auth/profile/logout flows setUser() directly, so it can't be a bare
  // derivation of the SWR data.
  const [user, setUser] = useState(null)
  const [favoriteIds, setFavoriteIds] = useState([])

  // Which tab the auth dialog opens on ('login' | 'signup'). Register buttons
  // set 'signup'; plain Log In leaves it 'login'.
  const [authMode, setAuthMode] = useState('login')
  const [authOpen, setAuthOpen] = useState(false)
  // Teaser dialog feature key (null = closed).
  const [teaserKey, setTeaserKey] = useState(null)

  // Where to send the user after a successful sign-in. Defaults to /dashboard
  // so logged-in users never get bounced back to the marketing landing.
  const returnTo = (searchParams?.get('returnTo') || '/dashboard')

  // Auth now rides in an httpOnly cookie (attached automatically by the api
  // client), so we can't gate on a JS-readable token — just ask the server.
  // A 200 with a null user simply means "not logged in".
  const { data: me } = useSWR('/auth/me', fetcher, SWR_OPTS)
  const { data: contributions } = useSWR(
    me?.user ? '/users/me/contributions' : null,
    fetcher,
    SWR_OPTS,
  )

  // Seed local user + favorites from the reads, then run the landing → dashboard
  // sweep for logged-in visitors. We use replace so the back button doesn't
  // bounce them back to the brochure.
  useEffect(() => {
    if (!me?.user) return
    setUser(me.user)
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      // Respect ?returnTo when present (e.g. came from a protected page).
      const target = searchParams?.get('returnTo') || '/dashboard'
      router.replace(target)
    }
  }, [me, router, searchParams])

  useEffect(() => {
    if (contributions) setFavoriteIds(contributions.favoriteIds || [])
  }, [contributions])

  // Auto-pop the auth dialog when the URL says ?login=1 (deep-linked from
  // protected pages like /dashboard).
  useEffect(() => {
    if (searchParams?.get('login') === '1') {
      setAuthMode(searchParams?.get('mode') === 'signup' ? 'signup' : 'login')
      setAuthOpen(true)
    }
  }, [searchParams])

  // Global teaser listener (for owner claim button etc.)
  useEffect(() => {
    const h = (e) => setTeaserKey(e.detail || 'community_board')
    window.addEventListener('dm:teaser', h)
    return () => window.removeEventListener('dm:teaser', h)
  }, [])

  return {
    router,
    returnTo,
    user, setUser,
    favoriteIds, setFavoriteIds,
    authOpen, setAuthOpen,
    authMode, setAuthMode,
    teaserKey, setTeaserKey,
  }
}
