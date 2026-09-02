'use client'

// Central API client for all /api calls.
// ---------------------------------------------------------------------------
//    Across the app, ~290 call sites each inlined `fetch('/api/…')`, a manual
// `localStorage.getItem('dm_token')` read, hand-built `Authorization` headers,
// and their own `.json()` + error handling. That duplication is a reuse and
// consistency problem: the token key, error shape, and timeout behavior drifted
// per file, and every page paid to re-implement the same plumbing.
//
// This module is the single source of truth for talking to the API. It:
//   • attaches the auth token automatically (opt out with { auth: false }),
//   • JSON-encodes bodies and sets Content-Type,
//   • parses JSON responses (tolerating empty / non-JSON bodies),
//   • enforces a default timeout and supports caller AbortSignals,
//   • throws a typed ApiError on non-2xx so callers can branch on status.
//
// Usage:
//   import { api } from '@/lib/api-client'
//   const { facility } = await api.get(`/facilities/${id}`)
//   await api.post('/facilities/x/watch')
//   await api.patch(`/facilities/${id}/owner-update`, payload)
//
// For React data loading prefer the useApi hook (hooks/use-api.js), which wraps
// this with loading/error state and abort-on-unmount.

import { AUTH_TOKEN_KEY } from '@/constants/app_constants'

const DEFAULT_TIMEOUT_MS = 15_000
const API_PREFIX = '/api'

export class ApiError extends Error {
  constructor(message, { status, data, code } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.code = code // 'timeout' | 'network' | 'not_found' | undefined
  }
}

export function getAuthToken() {
  return typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null
}

// Build the Authorization header when a legacy token exists. The session now
// travels in an httpOnly cookie (attached automatically via credentials:
// 'include'), so this is normally empty — it only fires for any client that
// still has a token in localStorage from before the cookie migration.
export function authHeader(token = getAuthToken()) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Read the readable CSRF token the server set in the dm_csrf cookie. The server
// runs a double-submit check on mutating requests: it compares this value
// against the X-CSRF-Token header we echo below.
export function getCsrfToken() {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)dm_csrf=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

// Cheap, synchronous "is the user logged in?" hint for UI decisions that used
// to read the JS-visible token (logo href, gates, showing an auth prompt). The
// real session token is an httpOnly cookie JS can't see, but the server sets a
// readable, NON-SECRET dm_csrf cookie alongside it on login and clears it on
// logout — so its presence is a reliable client-side login signal. This is a
// hint only: anything that must be authoritative should call /api/auth/me (or
// use useAuth()), since the server always re-validates.
export function isLikelyLoggedIn() {
  return !!getCsrfToken()
}

// Normalize a path: callers pass '/facilities/1' and get '/api/facilities/1';
// absolute URLs and already-prefixed paths pass through untouched.
function toUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith(API_PREFIX)) return path
  return API_PREFIX + (path.startsWith('/') ? path : `/${path}`)
}

/**
 * Core request. Returns parsed JSON (or null for empty responses).
 *
 * @param {string} path      e.g. '/facilities/123' (leading /api optional)
 * @param {object} opts
 * @param {string} [opts.method='GET']
 * @param {any}    [opts.body]           object → JSON-encoded; other → passed as-is
 * @param {object} [opts.headers]
 * @param {boolean}[opts.auth=true]      attach the bearer token
 * @param {AbortSignal}[opts.signal]     caller cancellation
 * @param {number} [opts.timeout=15000]  ms; 0 disables
 * @param {boolean}[opts.raw=false]      resolve the Response instead of parsed JSON
 */
export async function apiFetch(path, opts = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    auth = true,
    signal: callerSignal,
    timeout = DEFAULT_TIMEOUT_MS,
    raw = false,
  } = opts

  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  callerSignal?.addEventListener('abort', onAbort)
  const timeoutId = timeout ? setTimeout(() => ctrl.abort('timeout'), timeout) : null

  // Only JSON-encode plain objects; leave FormData / Blob / strings alone.
  const isPlainBody =
    body != null &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer)

  // Echo the CSRF token on state-changing requests so the server's
  // double-submit check passes (no-op for GET/HEAD).
  const isMutating = !['GET', 'HEAD'].includes(method.toUpperCase())
  const csrf = auth && isMutating ? getCsrfToken() : null

  const finalHeaders = {
    ...(isPlainBody ? { 'Content-Type': 'application/json' } : {}),
    ...(auth ? authHeader() : {}),
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...headers,
  }

  try {
    const res = await fetch(toUrl(path), {
      method,
      headers: finalHeaders,
      body: isPlainBody ? JSON.stringify(body) : body,
      signal: ctrl.signal,
      // Send the httpOnly session cookie with every same-origin API call.
      credentials: 'include',
    })

    if (raw) return res

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new ApiError(data?.error || `HTTP ${res.status}`, {
        status: res.status,
        data,
        code: res.status === 404 ? 'not_found' : undefined,
      })
    }
    return data
  } catch (e) {
    if (e instanceof ApiError) throw e
    if (e?.name === 'AbortError') {
      // Distinguish our timeout abort from a caller-initiated cancel.
      const timedOut = ctrl.signal.reason === 'timeout' && !callerSignal?.aborted
      throw new ApiError(timedOut ? 'Request timed out' : 'Request aborted', {
        code: timedOut ? 'timeout' : 'aborted',
      })
    }
    throw new ApiError(e?.message || 'Network error', { code: 'network' })
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    callerSignal?.removeEventListener('abort', onAbort)
  }
}

// Verb helpers — the common case.
export const api = {
  get: (path, opts) => apiFetch(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiFetch(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => apiFetch(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => apiFetch(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => apiFetch(path, { ...opts, method: 'DELETE' }),
  raw: (path, opts) => apiFetch(path, { ...opts, raw: true }),
}
