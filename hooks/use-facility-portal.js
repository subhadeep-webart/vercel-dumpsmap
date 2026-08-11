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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { clearAuthToken } from '@/hooks/use-logout'

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

  // The portal is the profile/dashboard for EVERY user — it always renders, even
  // when the account manages no facility. In that case we synthesize a lightweight
  // "facility" from the user's own record so the layout + cards show (empty/
  // editable) instead of a "claim a facility" gate. Ownership just means there's a
  // real facility to bind to.
  const effectiveFacility =
    facility || (user
      ? {
          id: user.id,
          name: user.name || user.companyName || user.email || 'Your facility',
          verified: !!user.verified,
          phone: user.phone || '',
          website: user.website || '',
          address: user.address || [user.city, user.state, user.zip].filter(Boolean).join(', '),
          city: user.city || '',
          state: user.state || '',
          createdAt: user.createdAt,
          photos: [],
          accepted: [],
          pricing: {},
          activeAlerts: [],
          _placeholder: true,
        }
      : null)

  // Status machine: loading → error → ready. There is NO "no-facility" gate — an
  // account without a facility still gets the portal (with the placeholder above).
  let status
  if (isAuthFailure) status = 'redirecting'
  else if (profileError || facilitiesError) status = 'error'
  else if (profileLoading || facilitiesLoading || !facilities) status = 'loading'
  else status = 'ready'

  return {
    status,
    user,
    facilities: facilities || [],
    facility: effectiveFacility,
    hasFacility: !!facility,
    selectedId: facility?.id || null,
    selectFacility: setSelectedId,
    savingKey,
    saveOwnerUpdate,
    savePricing,
    postAnnouncement,
    retry: () => mutateFacilities(),
  }
}
