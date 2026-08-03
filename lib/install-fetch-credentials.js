'use client'

// install-fetch-credentials — one-time global fetch shim.
//
// The auth token now lives in an httpOnly cookie (see AuthContext / the API
// route's cookie handling). For the browser to send that cookie, every request
// to our own /api must use `credentials: 'include'`, and every *mutating* /api
// request must echo the CSRF token (double-submit protection).
//
// The app has ~70 call sites that use raw `fetch('/api/…')` with hand-built
// headers rather than the central api-client. Rather than edit each one, we
// wrap window.fetch once so ALL same-origin /api calls automatically get:
//   • credentials: 'include'  (so the httpOnly session cookie rides along)
//   • X-CSRF-Token header      (on POST/PUT/PATCH/DELETE)
//
// It is deliberately conservative: it only touches requests to our own /api,
// never overrides values a caller set explicitly, and is idempotent so React
// StrictMode's double-invoke can't wrap fetch twice.

import { getCsrfToken } from '@/lib/api-client'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// Is this request aimed at our own /api? Handles string URLs, Request objects,
// and both absolute (same-origin) and relative forms.
function isOwnApi(input) {
  try {
    const raw = typeof input === 'string' ? input : (input?.url || '')
    if (raw.startsWith('/api')) return true
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw)
      return u.origin === window.location.origin && u.pathname.startsWith('/api')
    }
    return false
  } catch {
    return false
  }
}

export function installFetchCredentials() {
  if (typeof window === 'undefined') return
  if (window.__dmFetchPatched) return // idempotent
  const orig = window.fetch.bind(window)

  window.fetch = (input, init = {}) => {
    if (!isOwnApi(input)) return orig(input, init)

    const method = (init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase()
    const next = { ...init }

    // Attach the session cookie unless the caller explicitly opted out.
    if (next.credentials === undefined) next.credentials = 'include'

    // Echo the CSRF token on mutating requests, without clobbering an
    // explicit one the caller already set.
    if (!SAFE_METHODS.has(method)) {
      const csrf = getCsrfToken()
      if (csrf) {
        const h = new Headers(next.headers || (typeof input !== 'string' ? input?.headers : undefined) || {})
        if (!h.has('X-CSRF-Token')) h.set('X-CSRF-Token', csrf)
        next.headers = h
      }
    }

    return orig(input, next)
  }
  window.__dmFetchPatched = true
}
