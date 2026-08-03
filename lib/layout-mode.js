'use client'

// LayoutModeProvider
// ---------------------------------------------------------------------------
// P4 — Mobile/Desktop Rendering Override (independent of Field/Standard).
//
// Three-state preference: 'auto' | 'mobile' | 'desktop'
//   • auto    — pass-through, respects device width (default)
//   • mobile  — force a mobile-sized canvas, even on big screens
//   • desktop — force the page to render at desktop width, even on small phones
//                 (overrides the viewport <meta> tag so the layout uses the
//                  lg/xl Tailwind breakpoints)
//
// Persistence:
//   • localStorage (key: dm_view_preference)
//   • Server: PATCH /api/users/me/preferences  { viewPreference }
//             so logged-in users sync across devices
//
// Effect application:
//   • Sets <html data-forced-layout="mobile|desktop|auto">  so CSS can target it
//   • For 'desktop': dynamically replaces <meta name="viewport"> with width=1280
//   • For 'mobile':  body is constrained via globals.css (max-width 480px + frame)
//
// Independent of ViewModeProvider (standard|field). A user can be
//   Field Mode + Desktop Layout, etc. They are orthogonal axes.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { isLikelyLoggedIn } from '@/lib/api-client'

const STORAGE_KEY = 'dm_view_preference'
const VALID = new Set(['auto', 'mobile', 'desktop'])

const LayoutModeContext = createContext(null)

const DEFAULT_VIEWPORT = 'width=device-width, initial-scale=1'
const DESKTOP_VIEWPORT = 'width=1280'
const MOBILE_VIEWPORT  = 'width=device-width, initial-scale=1'

function readStored() {
  if (typeof window === 'undefined') return 'auto'
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return VALID.has(v) ? v : 'auto'
  } catch { return 'auto' }
}

function ensureViewportMeta() {
  if (typeof document === 'undefined') return null
  let meta = document.querySelector('meta[name="viewport"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'viewport')
    document.head.appendChild(meta)
  }
  if (!meta.dataset.dmOriginal) {
    meta.dataset.dmOriginal = meta.getAttribute('content') || DEFAULT_VIEWPORT
  }
  return meta
}

function applyEffect(preference, deviceIsNarrow) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  html.setAttribute('data-forced-layout', preference || 'auto')
  const meta = ensureViewportMeta()

  if (preference === 'desktop') {
    // Force a desktop-width canvas. Critical on mobile devices.
    if (meta) meta.setAttribute('content', DESKTOP_VIEWPORT)
    return
  }
  if (preference === 'mobile') {
    // Keep responsive viewport; CSS handles framing on desktop
    if (meta) meta.setAttribute('content', MOBILE_VIEWPORT)
    return
  }
  // auto — restore original (or device-width default)
  if (meta) {
    const original = meta.dataset.dmOriginal || DEFAULT_VIEWPORT
    meta.setAttribute('content', original)
  }
}

export function LayoutModeProvider({ children }) {
  // Initialize from localStorage immediately so SSR-render mismatch is minimized
  const [viewPreference, setViewPreferenceState] = useState('auto')
  const [deviceIsNarrow, setDeviceIsNarrow] = useState(false)
  const hydratedRef = useRef(false)

  // Hydrate from localStorage on mount + watch device width
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const stored = readStored()
    setViewPreferenceState(stored)

    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(max-width: 768px)')
      const update = () => setDeviceIsNarrow(mq.matches)
      update()
      mq.addEventListener('change', update)
      return () => mq.removeEventListener('change', update)
    }
  }, [])

  // Apply effect whenever preference changes
  useEffect(() => {
    applyEffect(viewPreference, deviceIsNarrow)
  }, [viewPreference, deviceIsNarrow])

  // Server sync: when logged in, fetch saved preference (overrides local if set)
  useEffect(() => {
    if (!isLikelyLoggedIn()) return
    let cancelled = false
    fetch('/api/users/me/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.preferences) return
        const server = j.preferences.viewPreference
        if (server && VALID.has(server)) {
          setViewPreferenceState(server)
          try { localStorage.setItem(STORAGE_KEY, server) } catch {}
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const setViewPreference = useCallback(async (next) => {
    if (!VALID.has(next)) return
    setViewPreferenceState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    if (isLikelyLoggedIn()) {
      try {
        await fetch('/api/users/me/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ viewPreference: next }),
        })
      } catch {}
    }
  }, [])

  // Convenience: effective layout (what's actually being rendered)
  const effectiveLayout = useMemo(() => {
    if (viewPreference === 'desktop') return 'desktop'
    if (viewPreference === 'mobile')  return 'mobile'
    return deviceIsNarrow ? 'mobile' : 'desktop'
  }, [viewPreference, deviceIsNarrow])

  const value = useMemo(() => ({
    viewPreference,
    setViewPreference,
    effectiveLayout,
    deviceIsNarrow,
    isForced: viewPreference !== 'auto',
  }), [viewPreference, setViewPreference, effectiveLayout, deviceIsNarrow])

  return <LayoutModeContext.Provider value={value}>{children}</LayoutModeContext.Provider>
}

export function useLayoutMode() {
  const ctx = useContext(LayoutModeContext)
  if (!ctx) {
    return {
      viewPreference: 'auto',
      setViewPreference: () => {},
      effectiveLayout: 'desktop',
      deviceIsNarrow: false,
      isForced: false,
    }
  }
  return ctx
}
