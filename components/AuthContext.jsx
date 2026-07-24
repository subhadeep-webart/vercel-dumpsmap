'use client'

// AuthContext — global auth state for the whole app. Fetches /api/auth/me once
// on mount using the stored dm_token and exposes the current user to any client
// component via useAuth(), so components like AppHeader no longer each fetch it.

import React, { createContext, useContext, useEffect, useState } from 'react'
import { clearAuthToken } from '@/hooks/use-logout'
import { api } from '@/lib/api-client'

const AuthCtx = createContext(null)

export const STAFF_ROLES = ['super_admin', 'admin', 'moderator']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!t) { setLoading(false); return }
    setToken(t)
    api.get('/api/auth/me')
      .then((j) => setUser(j?.user || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const logout = () => {
    clearAuthToken()
    setToken(null)
    setUser(null)
    window.location.href = '/'
  }

  const value = {
    user,
    token,
    loading,
    loggedIn: !!user,
    isStaff: STAFF_ROLES.includes(user?.role),
    logout,
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
