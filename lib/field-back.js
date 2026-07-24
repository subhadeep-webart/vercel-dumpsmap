'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

/**
 * Smart back navigation for Field Mode.
 *
 * Strategy:
 *   - We CANNOT inspect history entries from the browser, so we use two signals:
 *     1) Did we navigate *inside* this app? We track that via a session-storage
 *        flag set on each internal client-side route change.
 *     2) Same-origin document.referrer (covers the case where the user came
 *        from another page on the site via a hard navigation).
 *   - If neither signal is positive, we treat the current page as the "first"
 *     page in this tab and route to the explicit fallback (or a sensible
 *     route-aware default) — instead of letting router.back() bounce the
 *     user to about:blank / the landing page.
 */

const NAV_KEY = 'dm_field_back_nav'

// Module-level guard so the listener attaches only once per tab.
let listenerAttached = false
function attachNavListener() {
  if (listenerAttached) return
  if (typeof window === 'undefined') return
  listenerAttached = true
  const mark = () => {
    try { sessionStorage.setItem(NAV_KEY, '1') } catch {}
  }
  // popstate = browser navigation event (forward/back). Treat as safe history exists.
  window.addEventListener('popstate', mark)
  // Patch pushState only — replaceState is fired by Next.js during initial hydration
  // and is NOT user-initiated navigation, so we deliberately do not track it.
  const _push = window.history.pushState
  if (typeof _push === 'function') {
    window.history.pushState = function (...args) { const r = _push.apply(this, args); mark(); return r }
  }
}

export function useFieldBack(explicitFallback = null) {
  const router = useRouter()
  const pathname = usePathname()
  const hadHistoryRef = useRef(false)

  useEffect(() => { attachNavListener() }, [])

  // Re-evaluate the "do we have safe history?" signal on every route change.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let internalNav = false
    try { internalNav = sessionStorage.getItem(NAV_KEY) === '1' } catch {}
    hadHistoryRef.current = internalNav
  }, [pathname])

  const computeFallback = useCallback(() => {
    if (explicitFallback) return explicitFallback
    const p = pathname || '/'
    if (p.startsWith('/community/posts/')) return '/community'
    if (p.startsWith('/community/groups/')) return '/community/groups'
    if (p.startsWith('/community')) return '/'
    if (p.startsWith('/facilities/')) return '/'
    if (p.startsWith('/inbox/')) return '/inbox'
    if (p.startsWith('/inbox')) return '/'
    if (p.startsWith('/admin/')) return '/admin'
    if (p.startsWith('/admin')) return '/'
    if (p.startsWith('/recommendations/')) return '/recommendations'
    if (p.startsWith('/jobs/')) return '/'
    if (p.startsWith('/marketplace/')) return '/'
    if (p.startsWith('/donate/') || p.startsWith('/settings/')) return '/'
    return '/'
  }, [explicitFallback, pathname])

  return useCallback(() => {
    if (typeof window === 'undefined') {
      router.push(computeFallback())
      return
    }
    if (hadHistoryRef.current) {
      try {
        router.back()
        return
      } catch {}
    }
    router.push(computeFallback())
  }, [router, computeFallback])
}

export default useFieldBack
