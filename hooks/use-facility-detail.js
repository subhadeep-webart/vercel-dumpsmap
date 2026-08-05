'use client'

// useFacilityDetail — all data fetching for the facility detail page.
//
// The page component used to inline four network calls (facility, impact,
// auth/me, my-claim), the 10s-timeout + sample-fallback logic, and the
// loading/error/fallback state machine. That kept a lot of heavy async work in
// the render path and made the component hard to read. This hook owns all of
// it and hands the page back a flat, ready-to-render result.
//
// All requests go through the central api client (lib/api-client), so the auth
// token, headers, JSON parsing, and timeout are handled in one place instead of
// re-implemented here.
//
// Perf notes:
//   • The four requests fire in parallel — the slow impact aggregation never
//     blocks the main facility fetch, and the auth-gated calls run alongside.
//   • The effect keys on `id` only, so it does not re-run on unrelated renders.
//   • Every fetch is abortable and ignored after unmount / id change, so a fast
//     back-navigation can't stomp fresh state with a stale response.

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, isLikelyLoggedIn, ApiError } from '@/lib/api-client'
import { SAMPLE_FALLBACK_FACILITIES } from '@/components/MapSafety'
import { canShowSampleFallback } from '@/lib/env-detect'

const INITIAL_DATA = { phase: 'loading', facility: null, reviews: [], error: '', usedFallback: false }

export function useFacilityDetail(id) {
  const [data, setData] = useState(INITIAL_DATA)
  const [impact, setImpact] = useState(null)
  const [user, setUser] = useState(null)
  const [myClaim, setMyClaim] = useState(null)
  // Whether this facility is in the logged-in user's saved (favorites) list —
  // drives the Save button's filled/active state.
  const [saved, setSaved] = useState(false)

  // Guards state writes against stale responses after the id changes / unmount.
  const activeId = useRef(id)

  const loadCore = useCallback(async (facilityId, signal) => {
    setData((d) => ({ ...d, phase: 'loading', error: '', usedFallback: false }))

    const useSample = () => {
      const sample = SAMPLE_FALLBACK_FACILITIES.find((f) => f.id === facilityId)
      if (sample && canShowSampleFallback(facilityId)) {
        if (activeId.current === facilityId) {
          setData({ phase: 'ready', facility: sample, reviews: [], error: '', usedFallback: true })
        }
        return true
      }
      return false
    }

    try {
      // Warm requests resolve in ~0.5s; the generous ceiling only covers a cold
      // process start (first request triggers a one-time DB seed).
      const j = await api.get(`/facilities/${facilityId}`, { signal, timeout: 20_000 })
      if (activeId.current !== facilityId) return
      if (!j?.facility) {
        if (useSample()) return
        setData({ phase: 'error', facility: null, reviews: [], error: 'not_found', usedFallback: false })
        return
      }
      setData({ phase: 'ready', facility: j.facility, reviews: j.reviews || [], error: '', usedFallback: false })
    } catch (e) {
      if (activeId.current !== facilityId || e?.code === 'aborted') return
      if (e instanceof ApiError && e.code === 'not_found') {
        if (useSample()) return
        setData({ phase: 'error', facility: null, reviews: [], error: 'not_found', usedFallback: false })
        return
      }
      if (useSample()) return
      const error = e?.code === 'timeout' ? 'timeout' : (e?.message || 'load_failed')
      setData({ phase: 'error', facility: null, reviews: [], error, usedFallback: false })
    }
  }, [])

  // Reloads facility data on demand (owner edits, check-ins, retry). Does not
  // re-fetch user/claim, which don't change from those actions.
  const reload = useCallback(() => loadCore(id), [id, loadCore])

  useEffect(() => {
    if (!id) return
    activeId.current = id
    const ctrl = new AbortController()
    const { signal } = ctrl
    const alive = () => activeId.current === id && !signal.aborted

    // Main facility fetch.
    loadCore(id, signal)

    // Impact score — slow aggregation, kept fully independent so it never
    // delays the primary content. Non-fatal on failure.
    api.get(`/facilities/${id}/impact`, { signal })
      .then((j) => { if (j && alive()) setImpact(j) })
      .catch(() => {})

    // Auth-gated calls run in parallel with the above.
    if (isLikelyLoggedIn()) {
      api.get('/auth/me', { signal })
        .then((j) => { if (alive()) setUser(j?.user || null) })
        .catch(() => {})
      api.get(`/facility-claims/mine?facilityId=${id}`, { signal })
        .then((j) => { if (alive()) setMyClaim((j?.claims || [])[0] || null) })
        .catch(() => {})
      // Is this facility already saved? Seeds the Save button's filled state.
      api.get('/favorites', { signal })
        .then((j) => {
          if (!alive()) return
          const ids = (j?.favorites || []).map((f) => f.id || f.facilityId)
          setSaved(ids.includes(id))
        })
        .catch(() => {})
    }

    return () => { ctrl.abort() }
  }, [id, loadCore])

  return {
    ...data, // phase, facility, reviews, error, usedFallback
    loading: data.phase === 'loading',
    impact,
    user,
    myClaim,
    setMyClaim,
    saved,
    setSaved,
    reload,
  }
}
