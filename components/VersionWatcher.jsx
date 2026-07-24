'use client'

// VersionWatcher
// ---------------------------------------------------------------------------
// Detects deployed-build changes and prompts the user to refresh, eliminating
// the "I need to clear my cache to see updates" problem on mobile.
//
// How it works:
//   1. On mount, hits /api/version to record the build id the user is on.
//   2. Polls every 60s, on `visibilitychange` (when tab refocuses), and on
//      `focus`/`online` events.
//   3. When the server reports a NEW buildId, fires a sticky sonner toast:
//        "New version available — Refresh"
//      Clicking the action button does a hard reload (cache-busting query +
//      browser cache clear + location.reload).
//   4. Also unregisters any stray service workers if present (defensive —
//      we don't ship one, but old/cached SWs from PWA experiments can still
//      hold pages hostage on mobile).
//
// Tuning knobs (env or props):
//   • pollIntervalMs (default 60000)
//   • silentInitialSettle (default true) — first ping is silent

import { useEffect, useRef, useCallback, useState } from 'react'
import { toast } from 'sonner'

const DEFAULT_POLL_MS = 60_000     // 60s
const DEFAULT_BACKOFF_MS = 30_000  // when a fetch fails, retry in 30s

async function fetchVersion(signal) {
  try {
    const r = await fetch('/api/version', {
      cache: 'no-store',
      signal,
      headers: { 'Accept': 'application/json', 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' },
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

async function unregisterStaleServiceWorkers() {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const regs = await navigator.serviceWorker.getRegistrations()
    for (const r of regs) {
      try { await r.unregister() } catch {}
    }
    // Best-effort clear of all caches (only matters if a SW ever populated them)
    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      } catch {}
    }
  } catch {}
}

function hardReload() {
  try {
    // 1) Clear caches API (defensive)
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {})
    }
    // 2) Cache-busting query param
    const url = new URL(window.location.href)
    url.searchParams.set('_v', String(Date.now()))
    window.location.replace(url.toString())
  } catch {
    window.location.reload()
  }
}

export default function VersionWatcher({ pollIntervalMs = DEFAULT_POLL_MS }) {
  const initialBuildIdRef = useRef(null)
  const latestBuildIdRef  = useRef(null)
  const promptedRef       = useRef(false)
  const timerRef          = useRef(null)
  const abortRef          = useRef(null)
  const [hasNewVersion, setHasNewVersion] = useState(false)

  const showRefreshToast = useCallback((newBuildId) => {
    if (promptedRef.current) return
    promptedRef.current = true
    setHasNewVersion(true)
    toast.message('New version available', {
      description: 'A newer version of DumpMaps has been deployed. Refresh now to get the latest fixes and features.',
      duration: Infinity,
      action: {
        label: 'Refresh now',
        onClick: () => hardReload(),
      },
      cancel: {
        label: 'Later',
        onClick: () => { /* user dismisses; we'll re-prompt only after another version bump */
          promptedRef.current = false
        },
      },
      id: `new-version-${newBuildId}`,
    })
  }, [])

  const checkOnce = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    const data = await fetchVersion(abortRef.current.signal)
    if (!data) return null
    latestBuildIdRef.current = data.buildId
    if (initialBuildIdRef.current == null) {
      initialBuildIdRef.current = data.buildId
      // Initial settle — silent. Don't prompt on first load.
      return data
    }
    if (data.buildId && data.buildId !== initialBuildIdRef.current) {
      showRefreshToast(data.buildId)
    }
    return data
  }, [showRefreshToast])

  useEffect(() => {
    // Defensive: kill any stale service workers from prior PWA experiments
    unregisterStaleServiceWorkers()

    let cancelled = false

    async function loop() {
      if (cancelled) return
      const visible = typeof document === 'undefined' || document.visibilityState === 'visible'
      const online = typeof navigator === 'undefined' || navigator.onLine !== false
      if (visible && online) {
        const result = await checkOnce()
        if (!cancelled) {
          const delay = result ? pollIntervalMs : DEFAULT_BACKOFF_MS
          timerRef.current = setTimeout(loop, delay)
        }
      } else if (!cancelled) {
        timerRef.current = setTimeout(loop, pollIntervalMs)
      }
    }

    // Kick first check immediately so we record the initial build id
    loop()

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        if (timerRef.current) clearTimeout(timerRef.current)
        loop()
      }
    }
    function onFocus()  { if (timerRef.current) clearTimeout(timerRef.current); loop() }
    function onOnline() { if (timerRef.current) clearTimeout(timerRef.current); loop() }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      if (abortRef.current) abortRef.current.abort()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [checkOnce, pollIntervalMs])

  return null
}
