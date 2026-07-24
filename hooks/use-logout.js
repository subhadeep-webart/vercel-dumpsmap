'use client'

// useLogout — centralized logout for the whole app.
//
// Every logout site used to inline `localStorage.removeItem('dm_token')` plus
// an ad-hoc redirect/reload, so the token key and post-logout behavior drifted
// across ~40 files. This hook is the single source of truth.
//
// It intentionally does NOT depend on AuthContext, so it works in any client
// component — including ones rendered outside <AuthProvider>. If you are inside
// the provider and want auth state cleared in memory too, prefer
// useAuth().logout(); that now delegates here for the storage clear.
//
// Usage:
//   const logout = useLogout()
//   <button onClick={() => logout()}>Sign out</button>          // clears + goes to '/'
//   <button onClick={() => logout({ redirectTo: '/goodbye' })}> // custom destination
//   <button onClick={() => logout({ reload: true })}>           // clear + reload in place
//   logout({ redirectTo: null })                                // clear only; caller navigates
//
// Or, when you only need to drop the token (e.g. an expired-session cleanup
// where you already handle navigation), import { clearAuthToken }.

import { useCallback } from 'react'
import { AUTH_TOKEN_KEY } from '@/constants/app_constants'

// Remove the auth token from localStorage. Safe to call on the server (no-op)
// and never throws.
export function clearAuthToken() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(AUTH_TOKEN_KEY) } catch { /* storage unavailable — noop */ }
}

export function useLogout() {
  return useCallback((options = {}) => {
    const { redirectTo = '/', reload = false } = options
    clearAuthToken()
    if (typeof window === 'undefined') return
    if (reload) { window.location.reload(); return }
    if (redirectTo) { window.location.href = redirectTo }
    // redirectTo === null → caller is responsible for navigation
  }, [])
}
