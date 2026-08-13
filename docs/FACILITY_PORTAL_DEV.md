# Facility Portal — Development Plan

> Implementation plan for the new **Facility Portal** (redesigned facility-owner
> profile page with the dashboard folded in). Read the mock-up spec first:
> [`FACILITY_PORTAL_MOCKUP.md`](./FACILITY_PORTAL_MOCKUP.md).
>
> This follows the codebase conventions in [`FRONTEND.md`](./FRONTEND.md) and the
> mandatory cleanup rules (constants / helpers / SWR hooks / hooks+components
> split) already used by the facility-detail and profile pages.

---

## 0. Decision points (confirm before building)

1. **Route.** Does the portal *replace* `/dashboard/facility`, or live at a new
   path? Recommendation: **new route `/facility-owner/portal`** (or reuse the
   existing `/facility-owner/dashboard` alias target) so the current
   role-routed `/dashboard` stays intact for non-owners, and redirect owners
   there. Keep `/profile` (personal settings editor) untouched — the portal is
   facility-scoped, not account-scoped.
2. **Multi-facility.** Owners can own more than one facility
   (`/api/facilities/mine` returns a list). The top-bar switcher selects the
   active facility; the portal renders one facility at a time. Need a
   `?facility=<id>` query param or in-page selected state.
3. **Sidebar sections as routes vs. anchors.** The left menu items can be
   in-page scroll anchors (single-page portal) **or** sub-routes
   (`/portal/pricing`, `/portal/hours`, …). Recommendation: **single page with
   section anchors** for v1 (matches the mock-up's one-scroll layout), promote
   heavy sections (Analytics, Reports) to sub-routes later.

---

## 1. Architecture (hooks + api-client + components split)

Mirror the facility-detail / public-profile pattern (see the memory notes on
`facility-detail-architecture` and `data-fetching-pattern`): **no inline fetch
in components** — all data flows through the central `api-client` + SWR hooks.

```
app/facility-owner/portal/page.js        ← orchestration only (selected facility,
                                             active section, wires regions)

hooks/use-facility-portal.js             ← SWR: facility, pricing, wait/status,
                                             materials, hours, announcements,
                                             activity — plus mutate/save actions

constants/facility_portal_constants.js   ← menu items, status options, tone maps,
                                             tile config

components/facility-portal/
  PortalShell.jsx          ← top bar + sidebar + content column (responsive)
  PortalSidebar.jsx        ← left menu (uses constants), footer badge + logout
  PortalTopbar.jsx         ← wordmark, notifications, facility switcher
  PortalHero.jsx           ← photo, name, verified, contact, View Public Profile
  StatusStrip.jsx          ← 4 tiles: status / last-updated / strength / update
  cards/
    PricingCard.jsx        ← rate tiles + Add Material + Edit
    WaitCapacityCard.jsx   ← 4 stat tiles + Update Now
    MaterialsCard.jsx      ← chips + Edit Materials
    HoursCard.jsx          ← weekday + holiday rows + Edit Hours
    AnnouncementsCard.jsx  ← notices list + Manage / Add
    ActivityCard.jsx       ← Recent Updates & Reports feed
  PortalStates.jsx         ← skeleton / error / no-facility / not-owner
  portal-helpers.js        ← pure formatters (timeAgo re-export, $ format, etc.)
```

**Hook order gotcha:** call all hooks unconditionally at the top of the page /
regions before any early return (skeleton / error), per the facility-detail
note. Never gate a hook behind `if (loading)`.

---

## 2. Data & API (reuse — largely no new backend)

Existing endpoints (verify shapes against `handlers/` before wiring):

| Region | Endpoint(s) | Notes |
|--------|-------------|-------|
| Owned facilities | `GET /api/facilities/mine` (fallback: filter `/api/facilities` by `claimedByUserId`/`ownerId`) | see `app/dashboard/facility/page.js` |
| Facility identity | `GET /api/facilities/:id` | name, address, phone, website, verified, createdAt |
| Pricing | facility pricing GET/PATCH | "publishes instantly" → optimistic update |
| Wait / status / capacity | facility status GET/PATCH | drives Status strip + Wait card |
| Materials | facility materials GET/PATCH | chip list |
| Hours | facility hours GET/PATCH | regular + holiday |
| Announcements | facility announcements GET/POST/PATCH/DELETE | NEW badge = unread |
| Activity / reports | facility activity feed | owner edits + user reports |
| Public link | route only → `/facilities/:id` | no fetch |

If any of pricing/materials/hours/announcements lacks an owner-write endpoint,
that's the **only** new backend work — flag it during step 3.

**Profile Strength** is derived client-side from which fields/sections are
populated (put the scoring in `portal-helpers.js`).

---

## 3. Build order

1. **Scaffold + guard.** Route, `PortalShell` (top bar + sidebar + column),
   `PortalStates`; owner/role guard (redirect non-owners); `useFacilityPortal`
   returning the selected facility. Ship with placeholder cards.
2. **Hero + Status strip.** `PortalHero` (identity + View Public Profile),
   `StatusStrip` (status pill, last-updated, strength meter, Update Status
   dropdown wired to status PATCH).
3. **Pricing card.** Rate tiles, freshness lines + confirm checks, Add
   Material / Rate, Edit (inline or dialog); optimistic publish.
4. **Wait & Capacity card.** 4 stat tiles with tone colours + freshness;
   Update Now action.
5. **Materials + Hours cards.** Chip editor; weekday/holiday editor +
   View Full Schedule.
6. **Announcements + Activity cards.** Notices CRUD with NEW badges; activity
   feed with timestamps + View All.
7. **Sidebar wiring + micro-interactions.** Active-section highlight (scroll
   spy), animations/stagger, toasts, mobile ☰ drawer.
8. **Multi-facility switcher.** Top-bar dropdown → swap selected facility.
9. **QA pass.** Responsive (mobile stack), empty/error states, hook-order,
   a11y, and the cleanup-rules checklist.

---

## 4. Conventions checklist (must pass before delivery)

Per the project's codebase-cleanup rules:

- [ ] **Constants** — menu items, status options, tone maps, tile configs live
      in `constants/facility_portal_constants.js`, not inline.
- [ ] **Helpers** — all formatting (currency, timeAgo, profile-strength scoring)
      in `portal-helpers.js`; no logic duplicated across cards.
- [ ] **SWR** — every read goes through `hooks/use-facility-portal.js` via the
      central `api-client`; **no `fetch()` in components**.
- [ ] **Hooks/components split** — `page.js` is orchestration only; each region
      is its own component; hooks called unconditionally (no hook-order bugs).
- [ ] **Theming** — DumpMaps brand tokens (blue primary, semantic green/amber/
      red), **not** the mock-up's green; light/dark-safe where the app supports.
- [ ] **Mobile** — sidebar → drawer; cards stack; cover/photo uses the `pb-[%]`
      padding hack, not `aspect-[x]` + absolute child (mobile-height gotcha).
- [ ] **Reuse** — `DashboardShell`/`ProfileHero`/`ProfileCard` primitives, the
      existing status-tone maps, `timeAgo`, `StartDmButton`, etc. where they fit.

---

## 5. Out of scope for v1

- Analytics charts (link the sidebar item to the existing `/analytics` or stub).
- Cashback Offers editor (stub / "coming soon").
- New reporting backend (surface existing reports read-only if no write API).
- Section sub-routes (single-page anchors first; split later if needed).

---

## 6. Open questions — pending client clarification

> Sent to the client on 2026-08-11. **Answered 2026-08-12** — the assumptions the
> current build shipped with (portal for every user, all menu items for everyone,
> synthesized placeholder facility, edit actions always visible) are **all
> contradicted** and must be reworked. See §7 for the resulting work items.

1. **Availability** — Is this dashboard available for *all users*, or only certain
   user types (e.g. facility owners)?
   - **Answer:** Role-based — **not** available to all users. Facility
     users/owners get the facility dashboard and facility backend functions.
     Regular users/residents get a standard user profile (post jobs, accept jobs,
     view activity). Facility backend info and management is restricted to
     facilities.

2. **Menu access** — Are *all menu items* accessible by every user, or do they
   vary by role?
   - **Answer:** They vary by role (see Q3).

3. **Role-based menus** — If menus vary by role, which menus should each user type
   see?
   - **Answer:**
     - **Regular user / resident:** general platform activity; post & accept
       jobs; interact with / view activity; report info such as whether a
       facility is busy or slow. **Cannot** access or manage facility backend.
     - **Facility owner / facility user:** facility/business profile; manage
       Pricing, Operating hours, Accepted materials, Facility status/operational
       info. They manage the business side of the platform.
     - Client clarified facility access is intended for **businesses with
       drop-off locations** — donation centres, recycling facilities, trash
       stations, buyback facilities.

4. **Non-facility / empty state** — For a user who doesn't manage a facility, what
   should the facility sections show?
   - **Answer:** Show a **"Claim Your Facility"** prompt. Users validate the
     facility belongs to them and accept the terms/conditions, after which they
     become responsible for maintaining its information and gain update access.

5. **Cashback & Analytics** — Both are currently placeholders. Are they in scope
   now, and what should Analytics display / link to?
   - **Answer:** **Cashback → P2**, not P0/P1. It is a loyalty rewards program
     with participating facilities: users upload/scan receipts and a backend
     formula calculates rewards. Immediate priority stays on the
     receipt/scan/OCR functionality, not the full cashback system.
     **Analytics → not defined.** The client gave no definition of what an
     analytics dashboard should display; **clarification required before
     implementation.**

6. **Edit permissions** — Who can edit the operational data (pricing, hours,
   status)?
   - **Answer:** **Only the verified facility owner/account** may officially
     update pricing, operating hours, accepted materials, and operational
     status. Regular users may still post/comment/report what they observe (e.g.
     "this facility's price changed"), but that is **not verified facility
     data**. Once the owner claims and verifies, their verified pricing becomes
     the **authoritative pricing shown on the map**.

---

## 7. Rework from the answers — IMPLEMENTED 2026-08-12

The portal had been built as "one console for every user." The answers make it
owner-only. All items below are done and verified (see §8 for the test run).

| # | Area | Change |
|---|------|--------|
| 1 | **Security fix — pricing** | `PATCH /facilities/:id/pricing` (route.js) accepted writes from **any authenticated user**, stamping `verifiedBy: 'user'`, and wrote straight into `facility.pricing` — the pricing the map displays. Now **403s** for anyone but the verified owner or staff, per Q6. Residents report price changes via `POST /posts` (`isOfficial: false`) instead. |
| 2 | Owner predicate | Added `isFacilityOwner()`, `isStaffUser()`, `canManageFacility()` to `lib/dashboard-routing.js`. Reads `ownedFacilities` **or** `profileTypes: 'facility_owner'`, so claims predating the profileTypes stamp still resolve. |
| 3 | Placeholder facility | **Deleted** from `use-facility-portal.js`. It fabricated a facility from the user record with the **user id** as facility id, so every save fired `PATCH /facilities/{userId}/…`. The hook now exposes `isOwner` / `canEdit` / `pendingClaim`. |
| 4 | Role split | `isOwner` is a **role**, derived from the user record alone — deliberately not `&& facility`. An owner whose facility fetch fails is not demoted into the resident view; they get `PortalNoFacility` with its own copy. |
| 5 | Menu gating | `OWNER_MENU` / `RESIDENT_MENU` + `menuForRole()`. `PortalShell` validates `?section=` against the **role's own** menu, so a resident cannot deep-link to `?section=pricing`. |
| 6 | Claim flow | New `panels-claim.jsx` + `use-facility-claim.js`: facility search → ownership details → **terms acceptance** (Q4) → submit. Wires into the existing `/api/facility-claims` pipeline — **no new backend**. Shows "under review" status instead of re-offering a submitted claim. |
| 7 | Resident view | New `panels-resident.jsx` + `use-resident-portal.js`: My Activity, Jobs (posted + accepted), My Reports. Reports are labelled **"Community report"** so they read as signals, never authoritative facility data. |
| 8 | Edit gating | `canEdit` threaded through `StatusStrip` and all five cards (`PricingCard`, `HoursCard`, `MaterialsCard`, `WaitCapacityCard`, `AnnouncementsCard`) + `DashboardPanel`. Defense-in-depth — the server is the real gate. |
| 9 | Jobs API | Added `GET /jobs?mine=true` (session-scoped) to `handlers/workItems.js`. Accepted work reuses the existing `GET /work-orders?as=contractor`. |
| 10 | Cashback | Left stubbed — confirmed **P2**. |
| 11 | Analytics | Menu item **removed**; it pointed at `/analytics`, a route that does not exist and 404'd. |

### Known pre-existing issues (NOT introduced here, NOT fixed here)
- **`/jobs` handler shadowing.** `handleWorkItems` claims `/jobs` before the richer
  inline handler in route.js, so that one's `?mine=true` / `?accepted=true` /
  enrichment logic is unreachable dead code. The two use incompatible schemas
  (`posterId`/`state` vs `postedByUserId`/`status`), which also means
  `POST /jobs/:id/accept` checks a `status` field that workItems-created docs
  never have. Worth a separate cleanup.
- **`GET /alerts`** has no user filter and returns active-only; the resident
  Reports panel uses `/users/me/contributions` instead, which is user-scoped and
  has no expiry cutoff.

**Still open with the client:** what Analytics should display (Q5 half-answered —
cashback was confirmed P2, analytics was never defined).

---

## 8. Verification (2026-08-12)

`npx next build` passes. Three test suites run against the dev server + database;
all test accounts/facilities created were deleted afterwards.

**API authorization — 22 assertions, all passing.** With a throwaway resident
account and correct CSRF headers (so the 403s are genuine authorization, not CSRF):
- `PATCH /pricing`, `PATCH /owner-update`, `POST /owner-updates` → **403**, and
  the facility's pricing was confirmed **unmodified** afterwards.
- `GET /jobs?mine=true` → **401** signed out; signed in, returns only that user's jobs.
- Claim flow: submit → pending; submitting a claim does **not** grant ownership;
  a pending claimant still cannot write pricing; duplicate claim → 409.

**Owner path — 16 assertions, all passing.** Ownership granted exactly as the
admin claim-approval handler does, against a throwaway facility:
- `PATCH /pricing` → **200**, stamped `verifiedBy: 'facility'` (authoritative).
- `PATCH /owner-update` → 200; `POST /owner-updates` → 200, stamped `official`.
- Owner sees no claim prompt.

**Role-aware UI wiring — 45 assertions, all passing.** Predicate truth table
(including staff, legacy `profileTypes`, null/undefined users, and cross-facility
denial), menu split, deep-link blocking for all six management sections, and copy.

**Not covered:** no browser automation is installed, so the rendered DOM was not
asserted; pages were checked for HTTP 200 and a clean dev-server log only.

---

## 9. Profile photo + cover photo (2026-08-12)

**Problem:** users had no way to set a profile picture or cover photo anywhere in
the app.

**Cause:** `components/profile/ProfileHero.jsx` — which contains both uploaders —
was orphaned. It belonged to the old standalone `/profile` editor; when that page
became the Portal, the surviving editor (`panels-profile.jsx`) mounted the six
sub-tabs but never the hero, so the upload UI disappeared with it. Nothing in the
codebase imported it.

Everything else was already in place and needed no change:

| Layer | Status |
|-------|--------|
| Upload endpoint | `POST /api/upload` — 8 MB images, client-side canvas compression, stored under `PERSIST_UPLOAD_DIR`, served via `/api/files/:name` |
| Persist whitelist | `PROFILE_FIELDS` in `handlers/authProfile.js` already allows `avatarUrl`, `profilePhotoUrl`, `coverImageUrl` |
| Field mirroring | Both `useProfile.save()` and the server mirror `profilePhotoUrl ↔ avatarUrl`, so legacy surfaces (Marketplace, Community, Activity Hub) keep reading the photo |
| Form draft | `useProfile.toForm()` already carried all three fields |
| Uploader component | `components/MediaUploader.jsx` — `avatar` + `cover` variants purpose-built for this |
| Public display | `PublicProfileHero` reads `coverImageUrl` + `profilePhotoUrl \|\| avatarUrl` |

**Fix:** mounted `ProfileHero` at the top of `panels-profile.jsx`, wiring
`onChangeAvatar`/`onChangeCover` to the existing `save()`. Uploads persist
immediately (an image has no save button of its own). No API, hook, or new
component was needed.

**Verified — 23 assertions, all passing.** Real PNG bytes uploaded through the
live endpoint: upload → 200 with a URL; the file is served back with an image
content-type; both fields persist and survive a reload; `avatarUrl` mirroring
confirmed; the public projection exposes both; re-uploading replaces; and
upload/PATCH both reject signed-out callers (401). Test accounts and upload rows
were deleted afterwards.

### Known gap (not fixed — separate surface)
`components/AppHeader.jsx` renders only a **text initial**, never the photo — it
uses `getInitial()` from `lib/nav-helpers.js` and reads no avatar field. So a user
who sets a photo still sees a letter in the global header. Worth a follow-up if
the client expects the avatar there.

---

## 10. Profile tabs: onBlur → onSubmit (2026-08-12)

**Problem:** the Personal and Business tabs saved **every field on blur** — one
PATCH per field. Tabbing through Personal fired up to 7 requests; Business up to
6. Beyond the request volume, it persisted half-typed values (a partly-entered
email hit the server and could 409 mid-typing), and gave the user no way to
abandon an edit or see validation before it was already saved.

**Now:** react-hook-form holds the field state, zod validates on submit, and one
PATCH goes out carrying **only the changed fields**. A "Save changes" button sits
in each card header, disabled until the form is dirty.

| Piece | File |
|-------|------|
| Schemas + helpers | `validator/profile.js` — `personalSchema`, `businessSchema`, `pickDefaults()`, `changedFields()` |
| Personal tab | `components/profile/PersonalTab.jsx` — `register()` per input, `handleSubmit` |
| Business tab | `components/profile/BusinessTab.jsx` — same, plus `Controller` for the representation button-group (not a native input) |

Follows the codebase's existing convention (`validator/signup.js` +
`BusinessPartnerForm.jsx`): schemas live in `validator/`, errors render through
the shared `<FieldError />`. All three libraries were already dependencies.

**Design notes**
- The schemas **mirror the server's rules** (`handlers/authProfile.js`) so errors
  surface inline rather than as a toast after a rejected request — 1000-char bio
  vs 500 elsewhere, the `isRepresentative` enum, EIN/ZIP/state shapes.
- `changedFields()` diffs trimmed values, so a whitespace-only edit sends nothing
  and clearing a field correctly sends `''`.
- Neither tab writes back to the parent draft: `useProfile.save()` already folds
  the server's **normalised** response in (e.g. `website` gains its `https://`
  prefix). A local write-back would fight that with un-normalised values.
- The `defaults` effect re-seeds from SWR only while the form is untouched, so an
  async profile load never discards in-progress typing.
- Email uniqueness can only be checked server-side, so a 409 still arrives as a
  toast — everything else is caught before the request.

**Verified — 95 assertions, all passing.**
- **63 schema/helper assertions:** required fields, email formats, ZIP/ZIP+4,
  2-letter state, phone punctuation, EIN dashed+undashed, website with and
  without scheme, enum rejection, length caps at their exact boundaries, and the
  `pickDefaults`/`changedFields` contracts (no cross-tab leakage, no-op diffs,
  trimming, field clearing).
- **32 live-API assertions:** one submit → **exactly 1 request** (was 7 and 6);
  every field persists; a one-field edit sends one key and preserves the rest;
  every shape zod accepts the server also accepts (no validation drift); the
  server still rejects what zod blocks; edits survive a reload.

Test accounts were deleted afterwards. `next build` passes; all portal routes
serve 200 from a cleared `.next` cache with no runtime errors.

> **Dev-server note — `.next` cache corruption.** Several times during this work
> pages began returning 500 with errors like `__webpack_modules__[moduleId] is
> not a function` or `Cannot find module './vendor-chunks/tailwind-merge.js'`,
> while the API served 200 and `next build` compiled clean.
>
> **Root cause: running `next build` while `next dev` is running.** Both write to
> the same `.next/` directory and clobber each other's chunks. The symptom looks
> like a code fault but isn't — it survives `git stash`, which is the quickest way
> to prove it (if the error persists with your changes removed, it's the cache).
>
> Fix: stop the dev server, `rm -rf .next`, restart. Avoid building and dev-ing
> at the same time.

---

## 11. "View public profile" link (2026-08-12)

Added to the portal's Profile section, directly under the photo/cover band, so
"see how this looks to everyone else" sits next to the images you just changed.

Points at **`/users/me`** — the API resolves `me` from the session server-side
(the `profile-public` handler), so the link needs no user id and works on the
first render, before the profile fetch resolves. Opens in a new tab so the editor
isn't lost.

**Facilities already had this** — `PortalHero` renders a "View Public Profile"
button linking to `/facilities/:id` for owners. The gap was the *user* profile at
`/users/[id]`: the page and its API were fully built, but nothing in the app
linked to it. This is one `<Link>`, no new route or endpoint.

### Role-aware targets
The first cut hardcoded `/users/me`, which is wrong for a facility owner sitting
in the *facility* portal — they'd expect their facility page, not their personal
account. A facility owner has **two public pages and they are not
interchangeable**:

| Page | Route | Who sees it |
|------|-------|-------------|
| Facility listing | `/facilities/:id` | Customers finding them on the map |
| Personal account | `/users/me` | Anyone viewing them as a person |

So `ProfileEditPanel` now takes an optional `facility` prop (passed by
`FacilityPortal` on the owner branch only) and offers **both** buttons when it's
present, and just the personal one for a resident. No guessing which the user
meant — the owner picks.

**Verified — 14 assertions.** `/users/me/profile-public` resolves to the correct
user and flags `isOwner`; it agrees with the explicit-id form; it 404s signed-out
(no session to resolve) while an explicit id stays publicly browsable; the public
projection leaks neither email nor phone; and both page routes render 200.

---

## 12. Header nav highlight on the Portal (2026-08-12)

**Problem:** opening the dashboard lit up **Activity Hub** in the global header.

**Cause:** two bugs in `lib/nav-helpers.js` → `isNavActive()`, compounding.

1. The `feed` key (Activity Hub) matched `p === '/dashboard'`. That was true when
   `/dashboard` *was* the feed, but `app/dashboard/page.js` now renders the
   **Portal** — so the path no longer belongs to Activity Hub.
2. `PortalShell` passes `<AppHeader active="dashboard" />`, but `'dashboard'` is
   not in `NAV_KEYS`, so the explicit override was skipped and the function fell
   through to pathname inference — which then hit bug 1. The override a page
   passed was silently ignored.

**Fix:** dropped `/dashboard` from the `feed` case, and added a `NON_NAV_KEYS`
list (`dashboard`, `profile`, `settings`, `help`). A page passing one of those is
asserting "no top-nav item is active", so the function now returns false for every
key instead of guessing from the path.

**Verified — 37 assertions.** The reported bug is gone; all six Portal route/prop
combinations highlight nothing (including `/facility-owner/portal`, which must not
match the `/facilities` prefix); every real nav item still highlights correctly;
explicit overrides still win; **at most one item is ever active**; and empty /
undefined pathnames are safe. `next build` passes.
