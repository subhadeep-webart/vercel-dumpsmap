# ROUTING_QA_REPORT — P0 Stability Sprint
Date: 2026-06-03
Owner: main agent
Environment: preview (`http://localhost:3000` mirrors `https://dumpmaps-pilot.preview.emergentagent.com`)

## Scope
Audit routing, transitions, and load reliability per the user's P0 acceptance criteria.

## Route smoke test (anonymous, no token)

| Route | Expected | Actual | Pass |
|---|---|---|---|
| `/` | 200 — landing | 200 | ✅ |
| `/dashboard` | 200 — auth-gated shell, redirects to `/?login=1&returnTo=/dashboard` client-side | 200 | ✅ |
| `/facilities` | 200 — directory | 200 | ✅ |
| `/facilities/fb-1` | 200 — fallback sample (preview) / NotFound card (prod) | 200, renders sample | ✅ |
| `/facilities/fb-3` | 200 — same as above | 200, renders sample | ✅ |
| `/facilities/does-not-exist` | 200 — pretty NotFound card with Browse + Retry | 200, NotFound card shown | ✅ |
| `/marketplace` | 200 | 200 | ✅ |
| `/marketplace/:id` | 200 / 404 detail | 200 | ✅ |
| `/community` | 200 | 200 | ✅ |
| `/jobs` | 200 | 200 | ✅ |
| `/receipts` | 200 — contractor gate UI | 200 | ✅ |
| `/disposal-intelligence` | 200 — contractor gate UI | 200 | ✅ |
| `/login` | 200 — alias → redirects to `/?login=1` | 200 | ✅ |
| `/signup` | 200 — alias → redirects to `/?login=1&mode=signup` | 200 | ✅ |
| `/profile` | 200 — alias → `/settings` | 200 | ✅ |
| `/settings` | 200 | 200 | ✅ |
| `/messages` | 200 — alias to inbox | 200 | ✅ |
| `/admin/users` | 200 — staff-gated | 200 | ✅ |
| `/forgot-password` | 404 — deferred to next sprint | 404 | ⏳ next sprint |
| `/reset-password` | 404 — deferred to next sprint | 404 | ⏳ next sprint |

**Outcome: 18/18 P0 routes pass. Forgot-password routes are explicitly out-of-scope this sprint.**

## Auth + redirect rules

| Rule | Source location | Status |
|---|---|---|
| After successful login → push `returnTo \|\| /dashboard` | `/app/app/page.js:2998-3004` (AuthDialog.onAuth) | ✅ |
| After successful signup → same auth callback as login | `/app/app/page.js:2998-3004` | ✅ |
| Logo click while logged in → `/dashboard` | `components/HomeBrandLink.jsx` (existing) | ✅ |
| Logo click while logged out → `/` | `components/HomeBrandLink.jsx` (existing) | ✅ |
| Visiting `/` while logged in → `router.replace('/dashboard')` (does NOT add history entry) | `/app/app/page.js:2865-2868` | ✅ |
| Logout → `/` | `/app/app/settings/page.js:49`, `/app/components/HomeShell.jsx:138` | ✅ |
| `/dashboard` without token → redirect to `/?login=1&returnTo=/dashboard` | `/app/app/dashboard/page.js:58,68` | ✅ |
| `/login` (alias) → `/?login=1&returnTo=<x>` | `/app/app/login/page.js` | ✅ |
| `/signup` (alias) → `/?login=1&mode=signup&returnTo=<x>` | `/app/app/signup/page.js` | ✅ |
| `/profile` (alias) → `/settings` (token present) or login | `/app/app/profile/page.js` | ✅ |

## Back / refresh behaviour

| Scenario | Status | Notes |
|---|---|---|
| Marketplace card → detail → browser back | ✅ | `useFieldBack('/marketplace')` pre-seeds correct fallback |
| Facility card → detail → browser back | ✅ | `useFieldBack('/')` falls back to `/facilities` via the field-back helper |
| Community post → detail → browser back | ✅ | Same pattern |
| Browser refresh on any deep route | ✅ | All routes are real pages, no client-only modal flips |
| Browser refresh on `/dashboard` while logged in | ✅ | useEffect re-fetches auth/me, redirects to login if token invalid |

## Critical fix landed this sprint

**Facility detail stuck-loading bug** (`/facilities/fb-1`, `/facilities/fb-3`):
- Root cause: API returned 404 for ids in the `SAMPLE_FALLBACK_FACILITIES` seed list (these ids only exist in the directory's fallback array, not in the DB). The detail page treated 404 as a generic error but the previous error UI ("err — go home") was confusing and easy to misread as still loading.
- Fix: detail page now (a) tries the SAMPLE_FALLBACK list on 404 in preview/dev, (b) shows a proper "Facility not found" card with Browse + Retry CTAs on prod, (c) has a 10s AbortController timeout to prevent any future infinite-load.
- Verified: screenshot at `/tmp/fb1_fallback.png` shows full facility shell for `fb-1`; `/tmp/fac_notfound.png` shows the new NotFound card.

## Sample-data fallback policy

| Surface | Old behaviour | New behaviour |
|---|---|---|
| `/` (landing map) | Pulled `SAMPLE_FALLBACK_FACILITIES` whenever API fails, shows amber "Showing sample data" pill | Preview: pulls fallback, shows discreet dark-grey "Demo facilities" pill. Production hostname (`dumpmaps.org`): empty state with retry, no fallback. |
| HomeShell facilities tab | Amber "Showing sample data — couldn't reach server." banner | Neutral grey "Demo facilities — couldn't reach the live server." banner |
| `/facilities/[id]` | None — 404 → ugly error | Preview: tries SAMPLE list with thin dark banner. Production: pretty NotFound card. |

Helper: `/app/lib/env-detect.js` — `isProductionHost()` & `canShowSampleFallback()`.

## Outstanding (next sprint)

- Forgot Password flow (`/forgot-password`, `/reset-password?token=`)
- Admin User Management modal (send password reset, suspend, ban, role assign, audit log)
- Unified UI design system + Facility "Option 1" full redesign
- Role-based dashboard variants
