// middleware.js — edge-level CSRF guard for the API.
// ---------------------------------------------------------------------------
// This is the single, prominent place the API's cross-site-request-forgery
// protection lives. It runs at the edge BEFORE the /api route handler (and
// before that handler opens a DB connection), so a forged request is rejected
// as cheaply as possible.
//
// It deliberately does NOT do authentication or authorization. Verifying the
// JWT and every role/ownership check stays in the route handler's getAuth()
// and requireStaff() — that logic is intertwined with DB lookups and can't
// (and shouldn't) move to the edge. Middleware handles the one cross-cutting
// concern that is pure header/cookie comparison: the CSRF double-submit check.
//
// Double-submit model (mirrors the cookies the route sets on login):
//   • dm_token  — httpOnly session JWT (unreadable by JS)
//   • dm_csrf   — readable, non-secret token the client echoes back in the
//                 X-CSRF-Token header on every mutating request
// A request that authenticates via the session cookie must present a matching
// pair. Requests that carry no session cookie (unauthenticated, or the legacy
// Authorization: Bearer path) are not ambient-credential requests, so CSRF
// does not apply and they pass through untouched.
//
// Runtime: this file uses only Headers/cookies string comparison — no Node
// crypto, no jsonwebtoken, no DB — so it runs on the default Edge runtime.

import { NextResponse } from 'next/server'

const AUTH_COOKIE = 'dm_token'
const CSRF_COOKIE = 'dm_csrf'
const CSRF_HEADER = 'x-csrf-token'

// Safe (non-mutating) HTTP methods never need a CSRF token.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// Auth-bootstrap routes: the client has no dm_csrf cookie yet when it calls
// these, so they can't satisfy the double-submit check. They are safe to exempt
// because they don't act on an existing ambient session — they establish one.
// Matched against the /api-prefixed pathname.
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/signup'])

export function middleware(request) {
  const { pathname } = request.nextUrl
  const method = request.method.toUpperCase()

  // Only guard mutating /api requests; everything else passes straight through.
  if (SAFE_METHODS.has(method)) return NextResponse.next()
  if (CSRF_EXEMPT_PATHS.has(pathname)) return NextResponse.next()

  // Not authenticated by the session cookie → not a CSRF-relevant request
  // (unauthenticated, or legacy Bearer-header auth). Let the route decide.
  const hasSessionCookie = !!request.cookies.get(AUTH_COOKIE)?.value
  if (!hasSessionCookie) return NextResponse.next()

  // Double-submit: the readable cookie value must equal the echoed header.
  const cookieVal = request.cookies.get(CSRF_COOKIE)?.value || ''
  const headerVal = request.headers.get(CSRF_HEADER) || ''
  if (!cookieVal || cookieVal !== headerVal) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  return NextResponse.next()
}

// Scope the middleware to the API only — pages, static assets, and images never
// run it. (The catch-all API route is /api/[[...path]], so every API call is
// under /api/.)
export const config = {
  matcher: '/api/:path*',
}
