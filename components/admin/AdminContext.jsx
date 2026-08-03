'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearAuthToken } from '@/hooks/use-logout'

const AdminCtx = createContext(null)

export const STAFF_ROLES = ['super_admin', 'admin', 'moderator']

export function AdminProvider({ children }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loginError, setLoginError] = useState('')

  // Auth rides in the httpOnly cookie (attached automatically by the global
  // fetch shim); resolve the session by asking the server.
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => { if (j.user) setUser(j.user) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    setLoginError('')
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const j = await r.json()
    if (!r.ok || !j.user) { setLoginError(j.error || 'Login failed'); return false }
    if (!STAFF_ROLES.includes(j.user?.role)) {
      setLoginError('Account does not have admin access')
      return false
    }
    // Server set the session cookie on this response — nothing to store in JS.
    setUser(j.user)
    return true
  }

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* best-effort */ }
    clearAuthToken()
    setUser(null)
    router.push('/admin')
  }

  // authFetch is kept for callers' convenience; the cookie + CSRF header are
  // attached automatically by the global fetch shim, so this is now just fetch
  // with a JSON content-type default.
  const authFetch = async (url, opts = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    return fetch(url, { ...opts, headers })
  }

  const value = { user, loading, loginError, login, logout, authFetch, isStaff: STAFF_ROLES.includes(user?.role), isSuperAdmin: user?.role === 'super_admin' }
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminCtx)
  if (!ctx) throw new Error('useAdmin must be inside AdminProvider')
  return ctx
}
