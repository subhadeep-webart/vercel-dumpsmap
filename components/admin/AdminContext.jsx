'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearAuthToken } from '@/hooks/use-logout'

const AdminCtx = createContext(null)

export const STAFF_ROLES = ['super_admin', 'admin', 'moderator']

export function AdminProvider({ children }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!t) { setLoading(false); return }
    setToken(t)
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((j) => { if (j.user) setUser(j.user) })
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
    if (!r.ok || !j.token) { setLoginError(j.error || 'Login failed'); return false }
    if (!STAFF_ROLES.includes(j.user?.role)) {
      setLoginError('Account does not have admin access')
      return false
    }
    localStorage.setItem('dm_token', j.token)
    setToken(j.token)
    setUser(j.user)
    return true
  }

  const logout = () => {
    clearAuthToken()
    setToken(null)
    setUser(null)
    router.push('/admin')
  }

  const authFetch = async (url, opts = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    if (token) headers.Authorization = `Bearer ${token}`
    const r = await fetch(url, { ...opts, headers })
    if (r.status === 401 || r.status === 403) {
      // surface but do not auto-logout (might just be a non-super endpoint)
    }
    return r
  }

  const value = { user, token, loading, loginError, login, logout, authFetch, isStaff: STAFF_ROLES.includes(user?.role), isSuperAdmin: user?.role === 'super_admin' }
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminCtx)
  if (!ctx) throw new Error('useAdmin must be inside AdminProvider')
  return ctx
}
