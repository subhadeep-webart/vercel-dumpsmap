'use client'

// useFacilitiesActions — write/mutation service for the /facilities LIST page.
//
// The directory has one mutation: toggling a facility favorite. The page used to
// inline `fetch('/api/favorites/:id', { method: 'POST' })` with its own toast +
// optimistic id update. That reusable service logic lives here so the page stays
// presentational; the read hook (use-facilities.js) owns favoriteIds and passes
// its setter in so this hook can patch the list from the server's response.
//
// NOTE: distinct from hooks/use-facility-actions.js — that serves the facility
// DETAIL page. This one is the directory/list favorite toggle.

import { useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

export function useFacilitiesActions({ user, setFavoriteIds } = {}) {
  const toggleFavorite = useCallback(async (facilityId) => {
    if (!user) {
      toast('Log in to save favorites')
      return
    }
    const j = await api.post(`/favorites/${facilityId}`)
    if (j.favorited) {
      setFavoriteIds((arr) => [...arr, facilityId])
      toast.success('Saved to favorites')
    } else {
      setFavoriteIds((arr) => arr.filter((x) => x !== facilityId))
      toast('Removed from favorites')
    }
  }, [user, setFavoriteIds])

  return { toggleFavorite }
}
