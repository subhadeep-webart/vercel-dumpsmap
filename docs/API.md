# API reference

All endpoints are served under `/api` by the catch-all route
[`app/api/[[...path]]/route.js`](../app/api/%5B%5B...path%5D%5D/route.js) and the
extracted [handlers](../app/api/%5B%5B...path%5D%5D/handlers/). See
[ARCHITECTURE.md](./ARCHITECTURE.md) for how dispatch and ordering work.

> This is a **grouped map**, not an exhaustive contract. Route matching is done in
> code by `route === '…'`, `route.startsWith('…')`, and regex tests. When you need the
> exact request/response shape, read the matching branch in `route.js` or the relevant
> handler. Many routes also exist for extracted-handler features (messaging, rewards,
> receipts, work items, etc.) that are matched inside their own modules.

## How to read a route

- Base prefix: **`/api`** (e.g. `/auth/login` → `POST /api/auth/login`).
- Auth: send `Authorization: Bearer <jwt>`. Some read routes allow a `guest` identity.
- Dedicated (non-catch-all) routes:
  - `POST /api/stripe/webhook` — Stripe webhook receiver
  - `GET /api/files/[name]` — serve an uploaded file
  - `GET /api/version` — build/version info (polled by `VersionWatcher`)

---

## Auth & profile

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/auth/signup` | Create account |
| POST | `/auth/login` | Log in → JWT (rejects banned/suspended) |
| GET | `/auth/me` | Current user from token |
| GET/PUT | `/auth/profile` | Read / update profile |
| GET | `/auth/profile-types` | Available profile/account types |
| GET | `/users/search` | Search users (e.g. for messaging) |
| GET | `/users/me/contributions` | Current user's contributions |

Password reset, change-password, and logout are handled in
[`handlers/authProfile.js`](../app/api/%5B%5B...path%5D%5D/handlers/authProfile.js)
and [`handlers/passwordReset.js`](../app/api/%5B%5B...path%5D%5D/handlers/passwordReset.js).

## Facilities

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/facilities` | List/search facilities (supports `verified`, filters) |
| POST | `/facilities` | Submit a new facility |
| GET | `/facilities/:id` | Facility detail |
| GET | `/recommendations/best-option` | Best-option recommendation (uses live alerts) |
| GET | `/geocode` | Geocoding helper |

Facility rewards/impact/check-in routes (`/facilities/:id/impact`, `/check-in`,
`/rewards-program`) are claimed by the **rewards engine handler**, which dispatches
before the generic facilities routes.

## Alerts & live feed

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/alerts` | Active alerts |
| GET | `/alerts/types` | Alert type catalog (wait time, long line, closed, …) |
| — | `/posts`, `/notes`, `/comments` | Live-feed posts, notes, comments |
| POST | `/reviews` | Post a facility review |
| POST | `/flags` | Flag content |
| POST | `/reports` | Report content |
| — | `/follows`, `/favorites` | Follow / favorite facilities |

Alert types and expiry are defined in `route.js` (`ALERT_TYPES`); expired alerts are
swept to `status: 'expired'` on read.

## Community

| Method | Route | Purpose |
|--------|-------|---------|
| — | `/community/posts` | Community posts |
| — | `/community/groups` | Groups |
| GET | `/community/cities` | Cities |
| GET | `/community/trending` | Trending content |

Group chat and reactions/saves are handled in
[`handlers/groupChat.js`](../app/api/%5B%5B...path%5D%5D/handlers/groupChat.js).

## Marketplace

| Method | Route | Purpose |
|--------|-------|---------|
| — | `/marketplace` | Residential listings |
| GET | `/marketplace/me` | My listings |
| POST | `/marketplace/contact-seller` | Contact a seller (creates a thread) |
| — | `/marketplace/saved-searches` | Saved searches |
| GET | `/marketplace/inbox/threads` | Inbox threads |

Commercial B2B (`/marketplace/commercial…`) and commercial-access applications are in
[`handlers/commercialMarketplace.js`](../app/api/%5B%5B...path%5D%5D/handlers/commercialMarketplace.js),
which dispatches **before** the residential marketplace code.

## Messaging

| Method | Route | Purpose |
|--------|-------|---------|
| — | `/messages` | Direct messages |
| GET | `/messages/threads` | Message threads |

Unread counts: `handlers/inboxCount.js`. DMs: `handlers/messaging.js`.

## Jobs, bounties & field tools

- `/jobs` (+ job messages, status updates, payments) — jobs marketplace.
- Bounties, volunteer events, and work orders — `handlers/workItems.js` (Sprint A).
- Time clock — `handlers/timeClock.js`; vehicle inspections —
  `handlers/vehicleInspections.js`; dump receipts & OCR — `handlers/receipts.js` /
  `handlers/ocrReceipts.js`; rewards — `handlers/rewardsEngine.js`.

## Donations & payments

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/donations/intent` | Create donation intent (or Stripe Checkout if keys present) |
| POST | `/donations/webhook` | Donation webhook |
| — | `/payment-interest` | Register payment interest |
| GET | `/payment-settings/public` | Public (publishable-key) payment config |

Saved payment methods: `handlers/paymentMethods.js`. Stripe readiness logic lives in
`getStripeConfig()`; see [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-cross-cutting-integrations).

## Signups & inquiries

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/pilot-signup` | Pilot signup |
| POST | `/beta-signup` | Beta signup |
| POST | `/business-inquiry` | Business/B2B inquiry |
| — | `/verified-posting-application` | Apply for verified-poster status |
| — | `/contractor-applications`, `/contractor-applications/me` | Contractor verification |

## Uploads & misc

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/upload` | Upload a file (stored in the persistent uploads dir) |
| GET | `/platform-settings/public` | Public platform settings |
| GET | `/` or `/root` | Health/root |

---

## Admin API

All under `/admin/*`, guarded for admin/super-admin. Highlights:

**Overview & analytics:** `/admin/overview`, `/admin/analytics`,
`/admin/notification-counts`, `/admin/activity-log`

**Facilities & imports:** `/admin/facilities`, `/admin/facilities/:id` (PATCH/DELETE),
`/admin/facility-claims`, `/admin/facility-imports` and its bulk actions
(`/bulk-approve`, `/bulk-reject`, `/bulk-merge`, `/bulk-needs-details`),
`/admin/facility-imports/csv`, `/from-url`, `/seed`, `/duplicate-check`,
`/admin/pending`

**Content & trust-safety:** `/admin/flags`, `/admin/flagged-alerts`,
`/admin/fraud-flags`, `/admin/reports`, `/admin/disputes`, `/admin/warnings`,
`/admin/alerts`

**Community & marketplace:** `/admin/community/posts`, `/community/groups`,
`/community/stats`, `/admin/marketplace`, `/admin/marketplace/reports`,
`/admin/marketplace/seed-samples`

**Users & access:** `/admin/users`, `/admin/contractor-verifications`,
`/admin/verified-posting-applications`, `/admin/leads/update`,
`/admin/leads/mark-notif-sent`

**Payments:** `/admin/payment-settings`, `/admin/payment-health` and subroutes
(`/goals`, `/sync-from-stripe`, `/test-connection`, `/verify-setup`),
`/admin/payment-interest`, `/admin/donations`, `/admin/donations/export`

**Platform & integrations:** `/admin/platform-settings`, `/admin/integrations`,
`/admin/email-settings`, `/admin/jobs`, `/admin/beta-signups`

> Feature flags/grants are managed via `handlers/featureControls.js`; admin
> user-management v2 and contractor-ops via `handlers/adminUsersV2.js` and
> `handlers/adminContractorOps.js`.
