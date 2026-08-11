# Facility Portal — New Profile Page (Mock-up Spec)

> **Source:** Client mock-up for the redesigned **facility-owner profile page**.
> The dashboard is now folded **inside** the profile page — one unified
> "Facility Portal" surface with its own left-hand menu, a facility header, and a
> stacked set of operational cards that read like a modern SaaS dashboard.
>
> The mock-up image is a **layout reference only** — colours, copy, and exact
> spacing follow the DumpMaps brand tokens (see [`FRONTEND.md`](./FRONTEND.md)),
> not the pixels in the image. The left menu shown in the image is illustrative;
> do **not** copy it verbatim — treat it as the intended *shape* of a portal
> sidebar and reconcile it with the app's real navigation.

---

## 1. Intent

The client wants the facility owner's **profile** and **operational dashboard**
to be a single "portal" experience — the feeling of logging into a SaaS product
(think Stripe Dashboard / Linear) rather than a settings editor bolted onto a
map app.

Key ideas from the mock-up:

1. **One surface, two jobs.** The profile *is* the dashboard. A facility owner
   lands here to both see live signals and edit their facility.
2. **Persistent left menu.** A vertical portal sidebar (Dashboard, Profile,
   Pricing, Wait Time, Hours, Photos, Announcements, Cashback, Reports,
   Analytics, Account) frames every section.
3. **Facility identity header.** A hero row: facility photo, name, verified
   badge, address, phone, website, Facility ID, "Member since", and a
   **View Public Profile** link (deep-links to `/facilities/[id]`).
4. **Status strip.** Facility Status (OPEN/CLOSED), Last Updated, Profile
   Strength meter, and a primary **Update Status** action.
5. **Operational cards** stacked below, each self-contained and inline-editable:
   Current Pricing, Wait Time & Capacity, Materials Accepted, Hours of
   Operation, Announcements, Recent Updates & Reports.
6. **Micro-interactions** — subtle "updated N min ago" timestamps, green
   confirm checks, live pills, progress meters — so the page *feels* alive and
   trustworthy, like a real SaaS console.

---

## 2. Layout map

```
┌──────────────────────────────────────────────────────────────────────┐
│  DumpMaps · Facility Portal          🔔  ▾ Green Valley Recycling      │  ← Portal top bar
├────────────┬─────────────────────────────────────────────────────────┤
│            │  ┌───────┐  Green Valley Recycling Center  ✔ Verified    │
│  ▸ Dashboard│  │ photo │  📍 1234 Industrial Way … ☎ (408)…  🔗 Website │  ← Hero header
│  ▸ Profile  │  └───────┘  Facility ID · Member since   [View Public ▸] │
│  ▸ Pricing  │  ────────────────────────────────────────────────────── │
│  ▸ Wait Time│  [Status OPEN] [Last Updated] [Profile 100%] [Update ▾]  │  ← Status strip
│  ▸ Hours    │  ────────────────────────────────────────────────────── │
│  ▸ Photos   │  ┌ Current Pricing ──────────────────────  [Edit] ┐      │
│  ▸ Announce.│  │ Mixed Debris  Clean Wood  Concrete  Cardboard  │      │  ← Card
│  ▸ Cashback │  │   $145/ton     $85/ton    $120/ton   $45/ton   │      │
│  ▸ Reports  │  └────────────────────────────────────────────────┘      │
│  ▸ Analytics│  ┌ Wait Time & Capacity ─────────────  [Update Now]┐     │
│  ▸ Account  │  │ 15 min · 12 trucks · Scales OPEN · 60% Full     │     │  ← Card
│            │  └────────────────────────────────────────────────┘      │
│  [Facility]│  ┌ Materials Accepted ─────────────────  [Edit] ┐         │
│  Verified  │  │ Asphalt Concrete Wood Metal Cardboard … +8    │        │  ← Card
│  Log Out   │  └───────────────────────────────────────────────┘        │
│            │  ┌ Hours ┐  ┌ Announcements ┐                             │  ← 2-up cards
│            │  └───────┘  └───────────────┘                             │
│            │  ┌ Recent Updates & Reports ────────────  [View All]┐     │  ← Card
│            │  └────────────────────────────────────────────────┘      │
└────────────┴─────────────────────────────────────────────────────────┘
```

**Desktop:** fixed left sidebar (~240px) + scrollable content column.
**Mobile:** sidebar collapses behind the ☰ menu (top-left in mock-up); content
becomes a single stacked column; the 2-up Hours/Announcements row stacks.

---

## 3. Regions & content

### 3.1 Portal top bar
- Left: **DumpMaps · Facility Portal** wordmark/lockup.
- Right: notifications bell (with unread count) + facility switcher dropdown
  (name + avatar) for owners who manage more than one facility.

### 3.2 Left menu (portal sidebar)
Illustrative items from the mock-up (reconcile with real routes — see §6):

| Item | Purpose |
|------|---------|
| Dashboard | The portal home (this page's default view) |
| Profile | Facility identity / public-facing details editor |
| Pricing & Materials | Rates + accepted materials |
| Wait Time & Status | Live wait / capacity / scale signals |
| Hours & Closures | Regular + holiday hours |
| Photos | Facility gallery |
| Announcements | Owner notices (holiday closure, rate updates) |
| Cashback Offers | Promotions / incentives |
| Reports & Feedback | User reports + responses |
| Analytics | Traffic / engagement charts |
| Account Settings | Billing, team, security |

Footer of sidebar: facility avatar + **Verified Facility** badge + **Log Out**.

### 3.3 Hero header
- Facility photo (rounded, ~120×120).
- Facility name (H1) + **Verified Facility** pill.
- Address · Phone · Website (icon rows).
- Facility ID · "Member since {month year}".
- **View Public Profile** button → `/facilities/[id]` (the consumer-facing page).

### 3.4 Status strip (4 tiles)
1. **Facility Status** — OPEN / CLOSED pill.
2. **Last Updated** — timestamp + "by Facility / by User".
3. **Profile Strength** — % complete + progress bar (drives completion nudges).
4. **Update Status** — primary CTA dropdown (Open, Closed, Busy, etc.).

### 3.5 Cards (each: title, optional info tooltip, edit/action button, body)
- **Current Pricing** — grid of material rate tiles ($/ton), each with an
  "Updated {time}" line + green confirm check; **Add Material / Rate** row;
  **Edit Pricing**. Publishes instantly.
- **Wait Time & Capacity** — 4 stat tiles: Estimated Wait, Trucks in Line,
  Scale Status, Yard Capacity; each with freshness ("Updated N min ago");
  **Update Now** action.
- **Materials Accepted** — chip list with checks + "+N more"; **Edit Materials**.
- **Hours of Operation** — weekday rows + holiday hours; **Edit Hours**;
  "View Full Schedule" link.
- **Announcements** — list of owner notices (title, NEW pill, body, posted
  date); **Manage** + **Add Announcement**.
- **Recent Updates & Reports** — mixed activity feed (owner edits + user
  reports) with right-aligned timestamps; **View All**.

---

## 4. Micro-interactions (the "SaaS feel")

- **Freshness timestamps** ("Updated 5 min ago", "Today, 12:30 PM") on every
  live value.
- **Green confirm checks** after a save; brief toast via `sonner`.
- **Live status pills** (OPEN / Moderate / etc.) with tone colours.
- **Profile Strength meter** animates on load; empty sections nudge completion.
- **Instant publish** — pricing/wait edits reflect immediately (optimistic UI +
  revalidate).
- **NEW badges** on unread announcements.
- Subtle card hover lift + section fade-in stagger on first paint (reuse the
  existing `dm-rise-in` / stagger animations noted in the profile plan).

---

## 5. Brand & theming (do not copy mock-up colours)

Follow DumpMaps tokens (`FRONTEND.md` §"Brand & theming"):

- Primary CTA → `brand-600` (`#0B4DBA`), not the mock-up's green.
- Page/card surface → `brand-surface` (`#F5F7FA`).
- Success/verified/OPEN → `green-600` (explicit success only).
- Warnings (Moderate capacity, long wait) → amber-500/600.
- Danger (Closed, scale issue) → red-600.

The mock-up's green accent is the *reference brand's* colour — map it onto
DumpMaps blue + the semantic green/amber/red already in the system.

---

## 6. Reconcile with the existing app

This portal is the **owner-facing** counterpart to two pages that already exist:

- [`app/dashboard/facility/page.js`](../app/dashboard/facility/page.js) — the
  current Facility Owner Ops dashboard (`DashboardShell`, KPI tiles, live
  signals, owned-facility list). Much of the status/activity logic lives here.
- [`app/profile/page.js`](../app/profile/page.js) — the unified profile editor
  (`ProfileHero` + `ProfileTabsNav` + `ProfileBody`, `useProfile` hook, instant
  PATCH saves).
- [`/facilities/[id]`](../app/facilities/[id]) — the **public** facility page
  the "View Public Profile" button links to.

**Open question for the client / product:** is the new Facility Portal a
*replacement* for `/dashboard/facility` (dashboard folded into profile), or a
new route (e.g. `/facility-owner/portal`)? The mock-up implies the former —
"the dashboard is now included in the profile page." The dev doc
([`FACILITY_PORTAL_DEV.md`](./FACILITY_PORTAL_DEV.md)) assumes a unified portal
and calls this out as a decision point.

Data sources already exist: `/api/facilities/mine`, facility pricing/materials/
hours/announcements endpoints, and the reports/activity feed — this is largely a
**presentation + composition** effort, not new backend.
