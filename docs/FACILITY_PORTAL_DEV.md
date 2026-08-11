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
