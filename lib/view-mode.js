'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { isLikelyLoggedIn } from '@/lib/api-client'

const STORAGE_KEY = 'dm_view_mode'
const ONBOARD_KEY = 'dm_field_mode_onboarded'

const ViewModeContext = createContext(null)

export function ViewModeProvider({ children }) {
  const [viewMode, setViewModeState] = useState('standard') // 'standard' | 'field'
  const [isMobile, setIsMobile] = useState(false)
  const [onboarded, setOnboarded] = useState(true)
  const [user, setUser] = useState(null)
  const initRef = useRef(false)

  // Detect mobile width
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Load initial preference: server (when logged in) > localStorage > device default
  useEffect(() => {
    if (typeof window === 'undefined' || initRef.current) return
    initRef.current = true
    const localMode = localStorage.getItem(STORAGE_KEY)
    const localOnboard = localStorage.getItem(ONBOARD_KEY) === '1'
    if (isLikelyLoggedIn()) {
      fetch('/api/users/me/preferences')
        .then((r) => r.ok ? r.json() : null)
        .then((j) => {
          if (j?.preferences?.viewMode) {
            setViewModeState(j.preferences.viewMode)
            localStorage.setItem(STORAGE_KEY, j.preferences.viewMode)
          } else if (localMode) {
            setViewModeState(localMode)
          }
          if (j?.preferences?.fieldModeOnboarded) {
            setOnboarded(true)
            localStorage.setItem(ONBOARD_KEY, '1')
          } else {
            setOnboarded(localOnboard)
          }
        })
        .catch(() => {
          if (localMode) setViewModeState(localMode)
          setOnboarded(localOnboard)
        })
      // also fetch the user for badge/profile bits
      fetch('/api/auth/me')
        .then((r) => r.ok ? r.json() : null)
        .then((j) => setUser(j?.user || null))
        .catch(() => {})
    } else {
      if (localMode) setViewModeState(localMode)
      setOnboarded(localOnboard)
    }
  }, [])

  const setViewMode = useCallback(async (next, opts = {}) => {
    if (next !== 'standard' && next !== 'field') return
    setViewModeState(next)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next)
    if (opts.markOnboarded !== false) {
      setOnboarded(true)
      if (typeof window !== 'undefined') localStorage.setItem(ONBOARD_KEY, '1')
    }
    if (isLikelyLoggedIn()) {
      try {
        await fetch('/api/users/me/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ viewMode: next, fieldModeOnboarded: true }),
        })
      } catch {}
    }
  }, [])

  const dismissOnboarding = useCallback(async () => {
    setOnboarded(true)
    if (typeof window !== 'undefined') localStorage.setItem(ONBOARD_KEY, '1')
    if (isLikelyLoggedIn()) {
      try {
        await fetch('/api/users/me/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldModeOnboarded: true }),
        })
      } catch {}
    }
  }, [])

  // Should we show onboarding? Only on mobile, only if not yet onboarded
  const showOnboarding = isMobile && !onboarded

  const value = useMemo(() => ({
    viewMode,
    setViewMode,
    isMobile,
    onboarded,
    dismissOnboarding,
    showOnboarding,
    user,
    setUser,
  }), [viewMode, setViewMode, isMobile, onboarded, dismissOnboarding, showOnboarding, user])

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext)
  if (!ctx) return { viewMode: 'standard', setViewMode: () => {}, isMobile: false, onboarded: true, showOnboarding: false, dismissOnboarding: () => {} }
  return ctx
}
