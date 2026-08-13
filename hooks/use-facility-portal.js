'use client'

// useFacilityPortal — all data loading + mutations for the Facility Portal
// (app/facility-owner/portal/page.js). Mirrors the useProfile / facility-detail
// pattern: the page and its regions stay presentational; every read goes through
// the central api-client via SWR, and every write folds the server response back
// into the cache so the UI stays in lock-step without a manual reload.
//
// Ownership model (see route.js): a user record carries `ownedFacilities: []`
// (facility ids). There is no /facilities/mine endpoint, so we read the profile,
// then fetch each owned facility. The portal renders ONE facility at a time; the
// selected id is state, seeded to the first owned facility (or a ?facility= param).
//
// ROLE-BASED (client answers, docs/FACILITY_PORTAL_DEV.md §6): only facility
// owners get the facility management console. Residents get the resident view and
// a "Claim Your Facility" prompt. This hook exposes `isOwner` / `canEdit` so every
// write affordance downstream can be gated to match the server's authorization.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { clearAuthToken } from '@/hooks/use-logout'
import { isFacilityOwner, isStaffUser } from '@/lib/dashboard-routing'

const PROFILE_KEY = '/api/users/me/profile'
const LOGIN_REDIRECT = '/?login=1&returnTo=/profile'

const fetcher = (path) => api.get(path)

export function useFacilityPortal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const wantedId = searchParams?.get('facility') || null

  // 1) Who is the owner? The session is an httpOnly cookie, so we can't pre-check
  //    a token — ask the server; a 401/403 (below) bounces an unauthenticated
  //    visitor to login.
  const {
    data: profileData,
    error: profileError,
    isLoading: profileLoading,
  } = useSWR(PROFILE_KEY, fetcher, { revalidateOnFocus: false, shouldRetryOnError: false })

  const user = profileData?.user || null
  const ownedIds = useMemo(
    () => (Array.isArray(user?.ownedFacilities) ? user.ownedFacilities : []),
    [user],
  )

  // 2) Load every owned facility. SWR keys on the id list so it refetches when
  //    ownership changes. Null key while unknown so we don't fire prematurely.
  const facilitiesKey = user ? ['portal-facilities', ownedIds.join(',')] : null
  const {
    data: facilities,
    error: facilitiesError,
    isLoading: facilitiesLoading,
    mutate: mutateFacilities,
  } = useSWR(
    facilitiesKey,
    async () => {
      if (!ownedIds.length) return []
      const results = await Promise.all(
        ownedIds.map((id) => api.get(`/facilities/${id}`).then((r) => r?.facility).catch(() => null)),
      )
      return results.filter(Boolean)
    },
    { revalidateOnFocus: false },
  )

  // 3) Selected facility. Seed from ?facility= (if owned) else the first owned
  //    one. User-owned after the first paint via setSelectedId (the switcher).
  const [selectedId, setSelectedId] = useState(null)
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current || !facilities) return
    if (!facilities.length) { seededRef.current = true; return }
    const initial =
      (wantedId && facilities.find((f) => f.id === wantedId)?.id) || facilities[0].id
    setSelectedId(initial)
    seededRef.current = true
  }, [facilities, wantedId])

  const facility = useMemo(
    () => (facilities || []).find((f) => f.id === selectedId) || (facilities || [])[0] || null,
    [facilities, selectedId],
  )

  // Auth failure → clear token + bounce to login (mirrors useProfile).
  const isAuthFailure =
    (profileError?.name === 'ApiError' && !!profileError.status) ||
    (!!profileData && !profileData.user)
  useEffect(() => {
    if (isAuthFailure) {
      clearAuthToken()
      router.replace(LOGIN_REDIRECT)
    }
  }, [isAuthFailure, router])

  // Track which field/section is currently saving, for inline "Saving…" + confirm
  // checks. A string label so multiple cards can show independent state via ===.
  const [savingKey, setSavingKey] = useState(null)

  // Fold a fresh facility record (returned by every owner-write endpoint) back
  // into the SWR cache without a refetch.
  const applyFacility = useCallback(
    (fresh) => {
      if (!fresh?.id) return
      mutateFacilities(
        (list) => (list || []).map((f) => (f.id === fresh.id ? fresh : f)),
        { revalidate: false },
      )
    },
    [mutateFacilities],
  )

  // Owner edit → PATCH /facilities/:id/owner-update. Accepts any allowed subset
  // (hours, phone, website, accepted, pricing, currentStatus, photos, …). Toasts
  // + returns true/false so callers can drive optimistic UI.
  const saveOwnerUpdate = useCallback(
    async (patch, { label = 'Facility', key } = {}) => {
      if (!facility?.id) return false
      setSavingKey(key || label)
      try {
        const j = await api.patch(`/facilities/${facility.id}/owner-update`, patch)
        if (j?.facility) applyFacility(j.facility)
        toast.success(`${label} updated`)
        return true
      } catch (e) {
        toast.error(e.message || 'Save failed')
        return false
      } finally {
        setSavingKey(null)
      }
    },
    [facility, applyFacility],
  )

  // Pricing has its own endpoint (verifiedBy stamping) — PATCH /facilities/:id/pricing.
  const savePricing = useCallback(
    async (pricingPatch, { key = 'pricing' } = {}) => {
      if (!facility?.id) return false
      setSavingKey(key)
      try {
        const j = await api.patch(`/facilities/${facility.id}/pricing`, pricingPatch)
        if (j?.facility) applyFacility(j.facility)
        toast.success('Pricing updated')
        return true
      } catch (e) {
        toast.error(e.message || 'Save failed')
        return false
      } finally {
        setSavingKey(null)
      }
    },
    [facility, applyFacility],
  )

  // Post an official announcement / owner update → POST /facilities/:id/owner-updates.
  // Returns the created alert (or null). Revalidates the facility so its alerts refresh.
  const postAnnouncement = useCallback(
    async ({ text, type, pinned } = {}) => {
      if (!facility?.id || !text?.trim()) return null
      setSavingKey('announcement')
      try {
        const j = await api.post(`/facilities/${facility.id}/owner-updates`, { text, type, pinned })
        toast.success('Announcement posted')
        mutateFacilities()
        return j?.alert || null
      } catch (e) {
        toast.error(e.message || 'Could not post')
        return null
      } finally {
        setSavingKey(null)
      }
    },
    [facility, mutateFacilities],
  )

  // Ownership (client answers, docs/FACILITY_PORTAL_DEV.md §6 Q1/Q6): the facility
  // backend is role-based. A user who owns no facility is a resident — they get the
  // resident view + a "Claim Your Facility" prompt, NOT a synthesized facility with
  // live edit buttons.
  //
  // `isOwner` is a ROLE, derived from the user record alone — deliberately NOT
  // `&& facility`. If an owner's facility fetch comes back empty (deleted record,
  // or the per-facility catch above swallowing a transient failure) they must not
  // be silently demoted into the resident view and told to claim a facility they
  // already own; they stay an owner and see the empty/error state instead.
  const isStaff = isStaffUser(user)
  const isOwner = isFacilityOwner(user) || isStaff
  // `canEdit` additionally requires a real facility to write to, and mirrors the
  // server-side authorization so the UI hides exactly what the API rejects.
  const canEdit = isOwner && !!facility

  // Pending/​rejected claims for this user, so the claim prompt can show status
  // instead of re-offering a claim that's already under admin review. Only fetched
  // for non-owners — owners have nothing to claim.
  const claimsKey = user && !isOwner ? '/facility-claims/mine' : null
  const { data: claimsData, mutate: mutateClaims } = useSWR(
    claimsKey,
    () => api.get('/facility-claims/mine'),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )
  const claims = claimsData?.claims || []
  const pendingClaim = useMemo(
    () => claims.find((c) => c.status === 'pending' || c.status === 'needs_more_info') || null,
    [claims],
  )

  // Status machine: loading → error → ready. A non-owner is still 'ready' — the
  // portal renders the resident view for them, gated by isOwner downstream.
  let status
  if (isAuthFailure) status = 'redirecting'
  else if (profileError || facilitiesError) status = 'error'
  else if (profileLoading || facilitiesLoading || !facilities) status = 'loading'
  else status = 'ready'

  return {
    status,
    user,
    facilities: facilities || [],
    facility,
    hasFacility: !!facility,
    isOwner,
    isStaff,
    canEdit,
    claims,
    pendingClaim,
    refreshClaims: mutateClaims,
    selectedId: facility?.id || null,
    selectFacility: setSelectedId,
    savingKey,
    saveOwnerUpdate,
    savePricing,
    postAnnouncement,
    retry: () => mutateFacilities(),
  }
}
