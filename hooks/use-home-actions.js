'use client'

// useHomeActions — write/session actions for the public home page ("/").
//
// The page inlined two mutations: logout (expire the httpOnly session cookie
// server-side, then clear local state) and the favorites toggle (POST
// /favorites/:id, then reconcile the local id list + toast). Both route through
// the central api client — no raw fetch, no hand-built auth headers — and mutate
// the local session state the page owns (passed in from useHome).
//
// Usage:
//   const { logout, toggleFavorite } = useHomeActions({
//     user, setUser, setFavoriteIds, setAuthOpen, setProfileOpen,
//   })

import { useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { clearAuthToken } from '@/hooks/use-logout'

export function useHomeActions({
  user,
  setUser,
  setFavoriteIds,
  setAuthOpen,
  setProfileOpen,
} = {}) {
  const logout = useCallback(async () => {
    // Expire the httpOnly session cookie server-side (JS can't delete it),
    // then clear any legacy localStorage token and local state.
    try { await api.post('/auth/logout') } catch { /* best-effort */ }
    clearAuthToken()
    setUser?.(null)
    setFavoriteIds?.([])
    setProfileOpen?.(false)
    toast.success('Logged out')
  }, [setUser, setFavoriteIds, setProfileOpen])

  const toggleFavorite = useCallback(async (facilityId) => {
    if (!user) {
      toast('Log in to save favorites')
      setAuthOpen?.(true)
      return
    }
    // Cookie + CSRF header are attached automatically by the api client.
    const j = await api.post(`/favorites/${facilityId}`)
    if (j?.favorited) {
      setFavoriteIds?.((arr) => [...arr, facilityId])
      toast.success('Saved to favorites')
    } else {
      setFavoriteIds?.((arr) => arr.filter((x) => x !== facilityId))
      toast('Removed from favorites')
    }
  }, [user, setFavoriteIds, setAuthOpen])

  return { logout, toggleFavorite }
}
