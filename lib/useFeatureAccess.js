'use client'

// useFeatureAccess
// ---------------------------------------------------------------------------
// Thin React hook for Phase D wire-up: every gated page calls this with a
// featureKey and gets back the effective access for the current user.
//
// Backed by /api/me/feature-access (Phase A endpoint). Result is cached at
// module scope for 30s to avoid re-fetching on every navigation, and
// invalidated on logout (localStorage 'dm_token' change).
//
// Usage:
//   const { loading, allowed, status, reason, lockedState, isExpired,
//           requiresUpgrade, requiresApply, feature } = useFeatureAccess('timeClock')
//
// The shape matches lib/feature-control.js → canAccessFeature output.

import { useEffect, useState, useCallback } from 'react'

const CACHE_TTL_MS = 30 * 1000
let cache = { at: 0, data: null, token: null }
const subscribers = new Set()

function tokenNow() {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem('dm_token') } catch { return null }
}

async function fetchAccess() {
  const tok = tokenNow()
  const headers = tok ? { Authorization: `Bearer ${tok}` } : {}
  const res = await fetch('/api/me/feature-access', { headers }).catch(() => null)
  if (!res || !res.ok) return null
  return await res.json().catch(() => null)
}

async function ensureCache(force = false) {
  const now = Date.now()
  const tok = tokenNow()
  const fresh = !force && cache.data && (now - cache.at) < CACHE_TTL_MS && cache.token === tok
  if (fresh) return cache.data
  const data = await fetchAccess()
  cache = { at: now, data, token: tok }
  // Notify subscribers
  for (const cb of subscribers) {
    try { cb(data) } catch (_) {}
  }
  return data
}

export function invalidateFeatureAccessCache() {
  cache = { at: 0, data: null, token: null }
}

export function useFeatureAccess(featureKey) {
  const [data, setData] = useState(cache.data)
  const [loading, setLoading] = useState(!cache.data)

  useEffect(() => {
    let cancelled = false
    const sub = (d) => { if (!cancelled) setData(d) }
    subscribers.add(sub)
    ensureCache().then((d) => {
      if (!cancelled) { setData(d); setLoading(false) }
    })
    return () => { cancelled = true; subscribers.delete(sub) }
  }, [])

  const refresh = useCallback(() => ensureCache(true), [])

  const entry = data?.access?.[featureKey] || null
  return {
    loading,
    authenticated: !!data?.authenticated,
    allowed: !!entry?.allowed,
    status: entry?.status || 'unknown',
    reason: entry?.reason || null,
    lockedState: entry?.lockedState || null,
    isExpired: !!entry?.isExpired,
    requiresUpgrade: !!entry?.requiresUpgrade,
    requiresApply: !!entry?.requiresApply,
    feature: entry?.feature || null,
    grant: entry?.grant || null,
    refresh,
  }
}
