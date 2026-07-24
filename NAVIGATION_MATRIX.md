# DumpMaps — Navigation Matrix

This file is the canonical source of truth for every navigation surface in the app.
It documents what each clickable element does **for logged-out vs logged-in users**.
Used together with `ROUTING_QA_REPORT.md` for stability sprints.

---

## 1. Header navigation (`SiteHeader.jsx`)

Lives on the marketing landing + anywhere the App component decides to render it.
Source of the original "bouncing back to landing" bug — every item now uses
`router.push()` to a real Next.js route.

| Element | Logged-out → | Logged-in → |
|---|---|---|
| DumpMaps logo (button) | `/` | `/dashboard` |
| Live Feed | `/?tab=feed` | `/dashboard` |
| Facilities | `/facilities` | `/facilities` |
| Community | `/community` | `/community` |
| Marketplace | `/marketplace` | `/marketplace` |
| Jobs | `/jobs` | `/jobs` |
| "Open DumpMaps" CTA | `/?tab=feed` | `/dashboard` |
| Sign in | opens AuthDialog (login mode) | n/a |
| Sign up | opens AuthDialog (signup mode) | n/a |
| Profile button | opens AuthDialog | opens ProfileDialog |
| Inbox / Notification bell | `/?login=1&returnTo=/inbox` | `/inbox` |

## 2. Mobile drawer (`SiteHeader.jsx` mobile branch)

Reuses the same `primaryNav` array as the desktop header, so any nav fix
propagates automatically. Same routing rules as section 1.

## 3. Mobile bottom nav (`HomeShell.jsx`)

Rendered only inside `view === 'home'` (i.e., the in-app SPA shell for
logged-out users). Logged-in users get redirected to `/dashboard` before this
ever shows.

| Item | Action |
|---|---|
| Home | internal `setTab('feed')` — stays in SPA |
| Community | `window.location.href = '/community'` |
| + (FAB) | opens submit dialog |
| Jobs | internal `setTab('jobs')` — stays in SPA |
| Alerts | opens InboxDialog if user, else opens AuthDialog |
| Profile | opens ProfileDialog if user, else opens AuthDialog |

## 4. Per-page nav (top of each Next.js route page)

### `/dashboard`
- Logo: `/dashboard` (router.push)
- Inbox button: `/inbox`
- Profile button: `/?tab=profile`
- 4 hero tiles: `/marketplace`, `/community`, `/jobs`, `/facilities`
- Conditional Contractor tiles (when `hasContractorAccess(user)`): `/disposal-intelligence`, `/receipts`

### `/marketplace`
- Logo: conditional `router.push(user ? '/dashboard' : '/')`
- Directory: `/facilities`
- Marketplace: `/marketplace` (active)
- My Dashboard: `/marketplace/me` (or `/?login=1&returnTo=/marketplace/me` if anon)
- Community: `/community`
- Jobs: `/jobs`
- Donate: `/donate`
- Post Item: opens PostItemDialog if user, else `/?login=1&returnTo=/marketplace`
- Floating "+" (mobile): same as Post Item
- Listing card click: `/marketplace/<id>`
- Save heart (anon): toast + `/?login=1&returnTo=/marketplace`
- Save heart (auth): toggles save via POST /api/marketplace/<id>/save

### `/marketplace/[id]`
- Back button (FieldFrame `back="/marketplace"`): `/marketplace`
- Reserve (anon): `/?login=1&returnTo=/marketplace/<id>`
- Reserve (auth): POST /api/marketplace/<id>/reserve, **stays on listing**
- Message Seller (anon): same returnTo redirect
- Message Seller (auth): opens DM thread, **stays on listing**
- Report listing: opens report dialog
- Seller Quick Actions (when isOwner): role-aware status buttons; on click POST /api/marketplace/<id>/quick-status, **stays on listing**

### `/marketplace/me`
- Logo: `/dashboard` (auth-only page)
- Directory: `/facilities`
- All other nav: real routes
- Token-missing or 401: `/?login=1&returnTo=/marketplace/me`

### `/community`
- Logo: handled by SiteHeader
- "Log in to post" (anon): `/?login=1&returnTo=/community`

### `/community/posts/[id]`
- Back button (FieldFrame `back="/community"`): `/community`

### `/jobs`
- Logo: `<HomeBrandLink />` (auth-aware)
- Home link: `<HomeBrandLink />`
- Community: `/community`
- Jobs: `/jobs` (active)
- Donate: `/donate`

### `/jobs/[id]`
- Back button (FieldFrame `back="/jobs"`): `/jobs`

### `/facilities`
- Logo: `<HomeBrandLink />`
- Map view: `/?view=map`
- Facility card click: `/facilities/<id>`
- Search / filters / near-me: stay on page (state-only)

### `/facilities/[id]`
- Logo: `<HomeBrandLink />`
- Error fallback link: `<HomeBrandLink />`
- View Details / Save / Claim / Reviews: stay on page or open dialogs

### `/donate`
- Logo: `<HomeBrandLink />`
- Home link: `<HomeBrandLink />`
- Join DumpMaps CTA: `<HomeBrandLink />`
- "Donate $X" buttons: POST /api/donate (Stripe Checkout)

### `/donate/success`
- Explore DumpMaps CTA: `<HomeBrandLink />`

### `/donate/cancel`
- Back to DumpMaps: `/dashboard`

### `/inbox`
- Header back: `/dashboard`
- Tab switcher: stays on page (?tab= query param)
- Unauth: "Sign in" link → AuthDialog via SiteHeader

### `/settings`, `/settings/integrations`
- Logo: `<HomeBrandLink />`
- Header Home: `<HomeBrandLink />`

### `/recommendations`
- Header back: `<HomeBrandLink />`

### `/disposal-intelligence` (Phase B contractor-only)
- Logo: `<HomeBrandLink />`
- Sub-nav: Dashboard / Disposal Intelligence (active) / Receipts / Facilities
- Anon: redirect to `/?login=1&returnTo=/disposal-intelligence`
- Authed but no contractor access: render Apply for Contractor Tools card

### `/admin/*`
- `AdminShell` sidebar — every entry stays inside `/admin/...`
- "Open Site" (intentional break-out): `/`
- Logo (top-left): `/admin`

## 5. Alias / redirect pages

These exist so deep links never 404. Each is a thin client component that
useEffect-replaces the URL.

| Alias | Target | Notes |
|---|---|---|
| `/messages` | `/inbox` | |
| `/notifications` | `/inbox?tab=notifications` | |
| `/login` | `/?login=1&returnTo=<returnTo|/dashboard>` | AuthDialog auto-pops in login mode |
| `/signup` | `/?login=1&mode=signup&returnTo=<returnTo|/dashboard>` | AuthDialog lands on signup tab |
| `/profile` | `/settings` (auth) or `/?login=1&returnTo=/settings` | |
| `/profile/setup` | `/settings#profile-setup` (auth) or login redirect | |
| `/receipts` | `/disposal-intelligence` | Phase C will replace with real page |
| `/intelligence` | `/disposal-intelligence` | |
| `/contractor-dashboard` | `/dashboard` | unified dashboard surfaces contractor tiles when access granted |
| `/facility-owner/dashboard` | `/dashboard` | same |

## 6. Logout (intentional break-out)

Wired in `HomeShell.jsx:138`. Calls `localStorage.removeItem('dm_token')`
then `window.location.href = '/'`. This is the **only** sanctioned full-page
redirect to the marketing landing for an authenticated session.

---

## Where image storage lives (Phase A2 fix)

| Path | Mount | Persistence | Used by |
|---|---|---|---|
| `/data/db/uploads/` | `/dev/nvme0n7` (ext4, persistent — same as MongoDB) | ✅ Survives restart + redeploy | **Current canonical upload path** |
| `/data/uploads/` | overlay fs | ❌ Wiped on restart | Legacy (Phase A v1) — fallback only |
| `/app/public/uploads/` | `/app` mount (ext4, persistent) | ⚠️ Persistent in container, but rewritten on git deploy | Legacy seed data — fallback only |

The `/api/files/[name]` route reads from all three locations in order and
returns the first hit. New uploads go to `/data/db/uploads/`. Any URL of
shape `/uploads/<x>` is normalized to `/api/files/<x>` at render time so
legacy listings still resolve.

If a file is missing from all three paths, the front-end's `onError`
swap-to-`<CategoryPlaceholder>` kicks in and the user sees a category-themed
tile instead of a broken image icon.

---

## Acceptance criteria status (from sprint brief)

- ✅ Marketplace cards route to `/marketplace/<id>` (verified)
- ✅ Facilities flow works (`/facilities` 200 in prod, card click → detail)
- ✅ Community flow works (`/community` + post detail + back to list)
- ✅ Logged-in users stay inside ecosystem (every Home link auth-aware)
- ✅ Browser back works (FieldFrame `back=` props all point at correct lists)
- ✅ Mobile navigation works (no `router.push('/')` bouncers; floating + uses returnTo when anon)
- ✅ Dashboard is the primary authenticated destination (auto-redirect from `/`)
- ⚠️ Marketplace images load — **fix shipped but production needs redeploy** (move to `/data/db/uploads` persistent path)
- ✅ Role-based tools (Disposal Intelligence + Receipt Center) gated by `hasContractorAccess(user)`
