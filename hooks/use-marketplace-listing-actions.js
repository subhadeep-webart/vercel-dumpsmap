'use client'

// useMarketplaceListingActions — write/mutation service for the marketplace
// detail page and buyer dashboard.
//
// Both pages inlined their mutations (save/wishlist, reserve, cancel hold,
// complete pickup, seller quick-status, and the buyer dashboard's saved-search
// create/update/delete/toggle) each with its own fetch, toast, and follow-up.
// That's reusable service logic, not view logic, so it lives here; the pages
// just call the handlers and render.
//
// Every action routes through the central api client. The reserve-family
// actions return the fresh listing from the server so the caller can patch its
// SWR cache in place (matching the old setListing(j.listing)); the saved-search
// actions call the caller's onMutated() reload. A single `busy` flag guards
// against double-submits.
//
// Usage:
//   const actions = useMarketplaceListingActions({ onMutated: reload })
//   const l = await actions.reserve(id)         // → updated listing or null
//   await actions.saveSearch(form)              // → reloads via onMutated

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'

// Pull a human message off an ApiError (the client puts the server's `error`
// field on err.data.error and also on err.message).
function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return fallback
}

export function useMarketplaceListingActions({ onMutated } = {}) {
  const [busy, setBusy] = useState(false)

  const withBusy = useCallback(async (fn) => {
    setBusy(true)
    try {
      return await fn()
    } finally {
      setBusy(false)
    }
  }, [])

  // ---- Wishlist / save toggle (detail page) ----
  // The page toggles the icon optimistically, so this just POSTs and returns the
  // server's authoritative { saved } boolean (or throws on failure so the page
  // can revert). It does NOT toast — the page owns the save/remove copy.
  const toggleSave = useCallback(async (id) => {
    const j = await api.post(`/marketplace/${id}/save`)
    return !!j?.saved
  }, [])

  // ---- Reserve flow (detail page). Each returns the updated listing or null. ----
  const reserve = useCallback((id) => withBusy(async () => {
    try {
      const j = await api.post(`/marketplace/${id}/reserve`)
      toast.success('Reserved! You have 15 minutes to coordinate pickup.')
      return j?.listing || null
    } catch (e) {
      toast.error(errMsg(e, 'Could not reserve'))
      return null
    }
  }), [withBusy])

  const cancelReserve = useCallback((id) => withBusy(async () => {
    try {
      const j = await api.post(`/marketplace/${id}/reserve/cancel`)
      toast.success('Reservation cancelled')
      return j?.listing || null
    } catch (e) {
      toast.error(errMsg(e, 'Could not cancel'))
      return null
    }
  }), [withBusy])

  const completePickup = useCallback((id, finalStatus = 'claimed') => withBusy(async () => {
    try {
      const j = await api.post(`/marketplace/${id}/reserve/complete`, { finalStatus })
      toast.success('Pickup completed')
      return j?.listing || null
    } catch (e) {
      toast.error(errMsg(e, 'Could not complete'))
      return null
    }
  }), [withBusy])

  // Seller one-tap status change (mobile-friendly field action).
  const quickStatus = useCallback((id, itemStatus) => withBusy(async () => {
    try {
      const j = await api.post(`/marketplace/${id}/quick-status`, { itemStatus })
      toast.success(`Status: ${itemStatus.replace('_', ' ')}`)
      return j?.listing || null
    } catch (e) {
      toast.error(errMsg(e, 'Failed'))
      return null
    }
  }), [])

  // ---- Saved searches (buyer dashboard). These reload via onMutated. ----
  const saveSearch = useCallback(async (form) => {
    try {
      const path = form.id ? `/marketplace/saved-searches/${form.id}` : '/marketplace/saved-searches'
      if (form.id) await api.patch(path, form)
      else await api.post(path, form)
      toast.success(form.id ? 'Saved search updated' : 'Saved search created')
      onMutated?.()
      return true
    } catch (e) {
      toast.error(errMsg(e, 'Failed'))
      return false
    }
  }, [onMutated])

  const deleteSearch = useCallback(async (id) => {
    if (!confirm('Delete this saved search?')) return
    try {
      await api.del(`/marketplace/saved-searches/${id}`)
      toast.success('Deleted')
      onMutated?.()
    } catch {
      // Old behaviour: silently no-op on failure (only reloaded when r.ok).
    }
  }, [onMutated])

  const toggleSearch = useCallback(async (s) => {
    try {
      await api.patch(`/marketplace/saved-searches/${s.id}`, { enabled: !s.enabled })
      onMutated?.()
    } catch {
      // Old behaviour: only reloaded on success; no toast.
    }
  }, [onMutated])

  return {
    busy,
    toggleSave,
    reserve, cancelReserve, completePickup, quickStatus,
    saveSearch, deleteSearch, toggleSearch,
  }
}
