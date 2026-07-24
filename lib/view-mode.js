'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

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
    const token = localStorage.getItem('dm_token')
    if (token) {
      fetch('/api/users/me/preferences', { headers: { Authorization: `Bearer ${token}` } })
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
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
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
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('dm_token')
      if (token) {
        try {
          await fetch('/api/users/me/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ viewMode: next, fieldModeOnboarded: true }),
          })
        } catch {}
      }
    }
  }, [])

  const dismissOnboarding = useCallback(async () => {
    setOnboarded(true)
    if (typeof window !== 'undefined') localStorage.setItem(ONBOARD_KEY, '1')
    const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (token) {
      try {
        await fetch('/api/users/me/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
