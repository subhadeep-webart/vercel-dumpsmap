'use client'

// AuthContext — global auth state for the whole app. It resolves the current
// user via /api/auth/me (authenticated by the httpOnly session cookie) and
// exposes that user to any client component through useAuth(), so surfaces like
// AppHeader never each re-fetch it.
//
// Token storage: the JWT lives in an httpOnly cookie the browser attaches
// automatically — JavaScript can neither read nor forge it, so an XSS can't
// steal the session. Because the token is not JS-readable, "are we logged in?"
// is answered by whether /auth/me returns a user, NOT by inspecting a token.
//
// Login flow: AuthDialog POSTs /auth/login|signup; the server sets the cookie
// on that response. AuthDialog then calls login(user) here so the in-memory
// state (and therefore the header) updates immediately — no refresh required.
//
// Session persistence: the cookie is a 30-day JWT. The user stays logged in
// until it actually expires. A *network* failure while calling /auth/me must
// NOT log anyone out — only a genuine auth rejection (401/403) does.
//
// Logout: JS can't delete an httpOnly cookie, so logout() calls POST
// /auth/logout (which expires the cookie server-side) before clearing memory.

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { clearAuthToken } from '@/hooks/use-logout'
import { api, ApiError } from '@/lib/api-client'
import { installFetchCredentials } from '@/lib/install-fetch-credentials'

// Install the global fetch shim as early as possible (module load, before the
// provider even mounts) so every /api call — including raw-fetch call sites
// that bypass api-client — sends the httpOnly session cookie and CSRF header.
installFetchCredentials()

const AuthCtx = createContext(null)

export const STAFF_ROLES = ['super_admin', 'admin', 'moderator']

// Cross-tab auth signal. We can't watch the httpOnly cookie from JS, so login
// and logout bump this localStorage key; other tabs hear the `storage` event
// and re-resolve. It holds no secret — just a changing timestamp.
const AUTH_PING_KEY = 'dm_auth_ping'
function pingOtherTabs() {
  try { localStorage.setItem(AUTH_PING_KEY, String(Date.now())) } catch { /* storage unavailable */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Guards against a resolve() that finishes after the component unmounted or
  // after a newer resolve() superseded it (avoids clobbering fresh state).
  const reqIdRef = useRef(0)

  // Resolve the current user from the session cookie via /auth/me. A 200 with a
  // user → logged in. A 200 with an empty body, or a 401/403 → logged out
  // (cookie missing/expired/revoked; server already declines to renew it). A
  // network/timeout error leaves the current user untouched — a blip must not
  // flip the header to logged-out.
  const resolve = useCallback(async () => {
    const myReq = ++reqIdRef.current
    try {
      const j = await api.get('/api/auth/me')
      if (reqIdRef.current !== myReq) return null // superseded
      const u = j?.user || null
      setUser(u)
      return u
    } catch (e) {
      if (reqIdRef.current !== myReq) return null // superseded
      // Only a real auth rejection clears the session. Network/timeout errors
      // keep whatever user we already had so the user stays logged in.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setUser(null)
      }
      return null
    } finally {
      if (reqIdRef.current === myReq) setLoading(false)
    }
  }, [])

  // Initial bootstrap on mount.
  useEffect(() => {
    resolve()
  }, [resolve])

  // Cross-tab sync: a login/logout in another tab bumps AUTH_PING_KEY; re-resolve.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e) => {
      if (e.key === AUTH_PING_KEY) resolve()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [resolve])

  // Called by AuthDialog right after a successful login/signup (the server set
  // the cookie on that response). Sets the user in memory immediately so the
  // header updates without a refresh, then reconciles against the server.
  const login = useCallback((u) => {
    setUser(u || null)
    setLoading(false)
    pingOtherTabs()
    resolve()
  }, [resolve])

  const logout = useCallback(async () => {
    // Ask the server to expire the httpOnly cookie (JS can't do it itself).
    try { await api.post('/api/auth/logout') } catch { /* best-effort */ }
    clearAuthToken() // drop any legacy localStorage token from before the migration
    setUser(null)
    pingOtherTabs()
    if (typeof window !== 'undefined') window.location.href = '/'
  }, [])

  const value = {
    user,
    loading,
    loggedIn: !!user,
    isStaff: STAFF_ROLES.includes(user?.role),
    login,
    logout,
    refresh: resolve,
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
