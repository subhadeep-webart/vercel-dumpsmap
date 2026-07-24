# Frontend

The UI is a **Next.js 14 App Router** app (React 18) styled with **Tailwind CSS** and
**shadcn/ui** (Radix primitives). There are ~78 pages. Most feature pages are client
components (`'use client'`) that call the `/api` backend directly.

- Root layout & metadata: [`app/layout.js`](../app/layout.js)
- Home page (map + facility search, a large client component):
  [`app/page.js`](../app/page.js)
- SEO route handlers: [`app/robots.js`](../app/robots.js),
  [`app/sitemap.js`](../app/sitemap.js)
- Config: [`jsconfig.json`](../jsconfig.json) sets the `@/*` path alias;
  [`components.json`](../components.json) configures shadcn; Tailwind theme +
  brand tokens in [`tailwind.config.js`](../tailwind.config.js).

---

## Page map (by area)

**Public / core**
`/` · `/facilities` · `/facilities/[id]` · `/login` · `/signup` ·
`/forgot-password` · `/reset-password` · `/beta` · `/business` · `/donate`
(+ `/donate/success`, `/donate/cancel`)

**Discovery & intelligence**
`/disposal-intelligence` · `/intelligence` · `/live-feed` · `/activity-hub` ·
`/recommendations` (+ `/recommendations/facilities`, `/recommendations/contractors`,
`/recommendations/contractors/[id]`)

**Community**
`/community` · `/community/groups` · `/community/groups/[id]` ·
`/community/posts/[id]` · `/community/guidelines`

**Marketplace**
`/marketplace` · `/marketplace/[id]` · `/marketplace/me`

**Jobs & bounties**
`/jobs` · `/jobs/[id]` · `/bounties`

**Contractor / field tools**
`/contractor-dashboard` · `/time-clock` · `/vehicle-inspections`
(+ `/new`, `/[id]`) · `/receipts` · `/receipt-scanner` · `/rewards`

**Facility owner**
`/facility-owner/dashboard`

**User account**
`/profile` · `/profile/setup` · `/settings` (+ `/settings/integrations`,
`/settings/payment-methods`) · `/inbox` · `/messages` · `/notifications`

**Dashboards (role-routed)**
`/dashboard` → `/dashboard/resident` · `/dashboard/contractor` ·
`/dashboard/facility` · `/dashboard/admin`

**Admin suite** (`/admin/*`, ~26 sections)
`/admin` · `activity-log` · `analytics` · `commercial-access` · `community` ·
`contractor-ops` · `contractor-verification` · `donations` · `email-notifications` ·
`facilities` · `facility-claims` · `facility-imports` · `facility-owners` ·
`feature-controls` · `feed` · `integrations` · `jobs` · `leads` · `marketplace` ·
`memberships` · `payments` · `platform-settings` · `reports` · `trust-safety` ·
`users`

> A route/navigation cross-reference lives in [`../NAVIGATION_MATRIX.md`](../NAVIGATION_MATRIX.md).

---

## Roles & dashboards

The app is role-aware: **resident**, **contractor**, **facility owner**, **admin**,
and **super_admin**. `/dashboard` routes users to the appropriate role dashboard, and
navigation/visibility adapts to role and feature access (see gating helpers below).
`components/RoleBadge.jsx` renders role labels; `home-href.js` computes the correct
"home" per role.

---

## Component library

Shared components live in [`components/`](../components/); low-level primitives are in
[`components/ui/`](../components/ui/) (shadcn/Radix: button, dialog, table, form,
tabs, etc.). Notable app-level components:

**Shell & navigation** — `AppHeader`, `AppFooter`, `SiteHeader`, `PageShell`,
`HomeShell`, `DashboardShell`, `GlobalMobileNav`, `MobileBottomNav`, `GlobalFab`,
`HomeBrandLink`, `HomeShell`.

**Maps** — `MapView`, `MapSafety` (Leaflet; guarded for optional/absent map keys).

**Facilities & feed** — `FacilityLiveStatusBadge`, `FacilityStatusHistory`,
`AccuracyBanner`, `AlertSystem` (exports `AlertPostDialog`, `AlertCard`, `LiveFeed`,
`ALERT_TYPES`, `timeAgo`, …), `QuickCheckInModal`, `components/feed/BestOptionCard`.

**Community & marketplace** — `Community` (`CommunityCenter`, `FacilityBoard`),
`Marketplace`, and `components/marketplace/*` (post/contact/quick-view dialogs,
commercial B2B tab).

**Messaging** — `components/messaging/*` (`DmThreadPanel`, `StartDmButton`,
`GroupChatPanel`, notification listeners/mounts).

**Field mode (contractor)** — `components/field/*` (`FieldShell`, `FieldHeader`,
`FieldBottomNav`, quick-post forms, view-mode toggle).

**Admin** — `components/admin/*` (`AdminShell`, `AdminContext`, `AdminPageFrame`,
`PaymentHealthDashboard`, `FeatureGrantsDrawer`, `NeedsAttentionWidget`).

**Gating & feature-lock UI** — `FeatureLock`, `RouteFeatureLock`,
`ContractorToolsGate`, `MaintenanceGate`, `PhaseTeaser`, `SoftLoginModal`.

**Media** — `MediaUploader`, `PhotoUploader`, `SafeImage`.

**Misc** — `Pricing`, `Dashboard`, `ScaleWorkflow`, `ReportButton`, `EmailCTAButton`,
`VersionWatcher` (polls `/api/version` to prompt reloads on new builds),
`LayoutModeToggle`/`LayoutModeApplier`.

**Hooks** — [`hooks/use-mobile.jsx`](../hooks/use-mobile.jsx),
[`hooks/use-toast.js`](../hooks/use-toast.js). Toasts also use `sonner`.

---

## Gating & business logic (`lib/`)

Feature access and domain rules are centralized in [`lib/`](../lib/):

| File | Responsibility |
|------|----------------|
| `feature-control.js`, `useFeatureAccess.js` | Feature flags/grants + client hook |
| `useNavVisibility.js` | Which nav items show for the current user |
| `commercial-access.js` | `hasCommercialAccess()` — B2B gating |
| `contractor-access.js` | Contractor tool gating |
| `marketplace-roles.js` | `resolveMarketplaceRole()`, allowed listing statuses |
| `view-mode.js`, `layout-mode.js` | Field/standard view + layout preference |
| `rewards.js`, `impact.js` | Rewards points + environmental-impact math |
| `receipt-classifier.js` | Categorize dump receipts |
| `facility-types.js`, `facility-hours.js` | Facility taxonomy + open/closed logic |
| `community-categories.js` | Community post categories |
| `home-href.js` | Role-aware home destination |
| `env-detect.js` | Runtime environment detection |
| `stripe.js`, `llm.js`, `email/` | Integration clients |
| `field-back.js`, `work-items.js` | Field-mode helpers, work-item shaping |
| `seed/` | Curated facility seed JSON (see ARCHITECTURE §5) |

When adding a gated feature, prefer wiring it through these helpers (and the
`FeatureLock`/`RouteFeatureLock` components) rather than ad-hoc role checks, so the
admin **Feature Controls** UI can manage it.

---

## Brand & theming

Brand tokens (from the README / `tailwind.config.js`):

| Token | Hex | Use |
|-------|-----|-----|
| `brand-600` | `#0B4DBA` | Primary DumpMaps Blue |
| `brand-navy` | `#0B1220` | Dark backgrounds, text on white |
| `brand-surface` | `#F5F7FA` | Page background, cards |
| `brand-400/500` | `#5C92EE` / `#2E70E0` | Hover, secondary CTAs |
| amber-500/600 | — | Warnings (call to confirm) |
| red-600 | — | Danger / critical |
| green-600 | — | Explicit "success" states only |

Logos and icons live in [`public/`](../public/) (`dumpmaps-logo.png`,
`og-image.png`, `apple-touch-icon.png`, favicons).
