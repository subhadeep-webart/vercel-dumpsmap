# Architecture

DumpMaps is a **Next.js 14 App Router** application with a self-contained backend
running inside Next's API layer. There is no separate server process — the "backend"
is a single catch-all route plus a set of extracted handler modules, all talking
directly to MongoDB.

---

## 1. The backend is one catch-all route

All API traffic under `/api/*` is handled by:

- [`app/api/[[...path]]/route.js`](../app/api/%5B%5B...path%5D%5D/route.js) — ~6,900 lines.

Next.js's optional-catch-all segment (`[[...path]]`) means **every** method and path
lands in one function. The file exports the same handler for all verbs:

```js
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
```

`handleRoute` reconstructs `route` (the path after `/api`) and `method`, connects to
Mongo, then runs a long chain of conditionals — each matching a route by exact string,
`startsWith`, or regex — and returns a `NextResponse`. If nothing matches it falls
through to a `404` with `Route ${route} not found`.

```js
if (route === '/auth/login' && method === 'POST') { ... }
if (route.startsWith('/facilities/') && method === 'GET' && route.split('/').length === 3) { ... }
if (/^\/admin\/facilities\/[^/]+$/.test(route) && method === 'PATCH') { ... }
```

### Why it matters
- **Order is significant.** A broad `startsWith` match placed before a more specific
  one will shadow it. When adding a route, check what precedes it.
- **One try/catch wraps everything.** Unhandled errors become a generic
  `500 { error: 'Internal server error', detail: ... }`.
- **CORS** is applied via a `handleCORS()` wrapper on responses.

## 2. Extracted handlers run first, in a fixed order

Newer features were pulled out of the monolith into
[`app/api/[[...path]]/handlers/`](../app/api/%5B%5B...path%5D%5D/handlers/). They are
dispatched **before** the main route body by `dispatchPr2b(ctx)` in
[`handlers/index.js`](../app/api/%5B%5B...path%5D%5D/handlers/index.js):

```js
export async function dispatchPr2b(ctx) {
  let resp
  resp = await handleMessaging(ctx);             if (resp) return resp
  resp = await handleGroupChat(ctx);             if (resp) return resp
  ...
  return null   // no handler claimed the route → fall through to route.js body
}
```

Each handler's `handle(ctx)` inspects the route/method and either returns a `Response`
(claiming the request) or `null` (declining). **The order in `index.js` is load-bearing**
and the file documents why. Examples of ordering constraints called out in comments:

- Admin contractor-ops dispatches **before** the generic receipts handler so
  `/admin/receipts` and `/admin/vehicle-inspections` aren't shadowed.
- Commercial-B2B marketplace dispatches **before** the generic `/marketplace` handler
  so `/marketplace/commercial` isn't captured by residential code.
- Rewards engine dispatches **before** the generic `/facilities` handler so
  `/facilities/:id/impact`, `/check-in`, and `/rewards-program` are claimed.
- OCR scanner dispatches **before** the generic `/receipts` handler so `/receipts/scan`
  isn't shadowed.

### Handler modules

| Handler | Area |
|---------|------|
| `messaging.js` / `groupChat.js` / `inboxCount.js` | Direct messages, group chat, unread counts |
| `commercialMarketplace.js` | Commercial B2B listings, access applications, admin queue |
| `reviewsRecs.js` | Reviews & recommendations |
| `dashboard.js` | Role-dashboard data aggregation |
| `receipts.js` / `ocrReceipts.js` | Dump receipts + OCR scanning |
| `rewardsEngine.js` | Points ledger, redemptions, cash-out |
| `authProfile.js` / `passwordReset.js` | Change-password, logout, profile, reset tokens |
| `workItems.js` | Jobs, bounties, volunteer events, work orders (Sprint A) |
| `activityHub.js` | Unified activity feed |
| `adminContractorOps.js` / `adminUsersV2.js` | Admin ops + user management |
| `featureControls.js` | Feature flags & grants |
| `paymentMethods.js` | Saved payment methods |
| `vehicleInspections.js` / `timeClock.js` | Contractor field tools |
| `preferences.js` / `seedDemo.js` | User prefs, demo seeding |

## 3. Data layer — MongoDB

- Native `mongodb` driver; a module-level cached `client`/`db` is reused across
  invocations (`connectToMongo()`), and `ensureSeed(db)` runs on connect.
- Documents use **UUID string `id` fields** (`uuidv4()`), not Mongo `_id`, as the
  public identifier. A `clean()` helper strips `_id` before returning documents.
- `DB_NAME` selects the database; `MONGO_URL` is the connection string.

### Collections (grouped by domain)

**Facilities & imports:** `facilities`, `facility_imports`, `facility_claims`,
`facility_owner_requests`, `claims`

**Alerts & feed:** `alerts`, `facility_alerts`, `posts`, `community_posts`,
`community_comments`, `community_reactions`, `community_saves`, `community_groups`,
`community_group_members`, `community_group_messages`, `comments`, `notes`

**Users & auth:** `users`, `password_reset_tokens`, `follows`, `favorites`,
`notifications`, `contractor_verifications`, `verified_posting_applications`,
`commercial_access_applications`

**Marketplace:** `marketplace_listings`, `marketplace_messages`, `marketplace_orders`,
`marketplace_contact_requests`, `marketplace_saved_searches`, `marketplace_saves`,
`marketplace_reports`

**Jobs / work / rewards:** `jobs`, `job_messages`, `job_status_updates`,
`job_payments`, `work_orders`, `bounties`, `volunteer_events`, `time_entries`,
`time_clock_settings`, `vehicle_inspections`, `rewards_ledger`, `rewards_redemptions`,
`rewards_cashout_methods`, `dump_receipts`, `ocr_scans`

**Messaging:** `messages`, `dm_messages`

**Payments & donations:** `payment_settings`, `payment_methods`, `payment_interest`,
`donations`, `donation_intents`, `stripe_webhook_events`

**Admin / platform / trust-safety:** `platform_settings`, `feature_flags`,
`feature_grants`, `feature_audit_log`, `admin_audit_log`, `activity_log`,
`activity_logs`, `admin_notifications_queue`, `integrations`, `email_settings`,
`email_logs`, `bulk_emails_sent`, `reports`, `flags`, `fraud_flags`, `disputes`,
`warnings`, `reviews`, `uploads`

**Signups:** `pilot_signups`, `beta_signups`, `business_inquiries`

> Note: both `activity_log` and `activity_logs` appear in the code — a naming
> inconsistency worth normalizing if you touch activity logging.

## 4. Authentication & authorization

- **JWT**, signed with `JWT_SECRET`. The route **fails fast at import time** if the
  secret is missing (no hardcoded fallback — a deliberate fix over an earlier insecure
  default).
- Tokens arrive as `Authorization: Bearer <token>`. Passwords are hashed with
  `bcryptjs`.
- Guard helpers verify the token, load the user, and reject `banned`/`suspended`
  accounts. Roles include resident, contractor, facility owner, `admin`, and
  `super_admin` (`isSuperAdmin(role)`).
- Fine-grained access is layered on top via `lib/` helpers — see
  [FRONTEND.md](./FRONTEND.md#gating--business-logic-lib) (`feature-control`,
  `commercial-access`, `contractor-access`, `marketplace-roles`).

## 5. Cross-cutting integrations

**Stripe** ([`lib/stripe.js`](../lib/stripe.js) + `getStripeConfig()` in `route.js`)
— lazily initialized. Keys are read from env first, then from the
`payment_settings` singleton in Mongo (set via Admin → Payments). Secret keys are
shape-validated (`sk_(test|live)_`). If no valid key exists, the donation flow
gracefully falls back to a `donation_intents` queue rather than hard-failing. The
Payment Health Dashboard at `/admin/payments` reports readiness and runs
connection/setup tests. A dedicated webhook route lives at
[`app/api/stripe/webhook`](../app/api/stripe/webhook/).

**File uploads** — written to a **persistent** directory
(`/data/db/uploads`, alongside Mongo's data, so they survive redeploys) and served by
[`app/api/files/[name]`](../app/api/files/) with fallbacks to legacy paths. In dev,
uploads may land in `public/uploads/`. Cloud storage (S3/Cloudinary) is planned but
not wired.

**Email** — [`lib/email/`](../lib/email/) via Nodemailer/Gmail
(`GMAIL_USER` / `GMAIL_APP_PASSWORD`). Sends are logged to `email_logs`.

**LLM** — [`lib/llm.js`](../lib/llm.js) uses `EMERGENT_LLM_KEY` /
`EMERGENT_LLM_BASE_URL`, primarily for OCR receipt parsing.

**Seed data** — curated facility batches in [`lib/seed/`](../lib/seed/)
(`calrecycle-norcal`, `calrecycle-socal`, `pacific-northwest`, `nevada`) are loaded
(and cached) on boot into the facility-imports moderation queue.

## 6. Request lifecycle (summary)

```
Request → /api/<path>
  └─ handleRoute(method, route)
       ├─ connectToMongo() → ensureSeed()
       ├─ dispatchPr2b(ctx)        # extracted handlers, in fixed order
       │     └─ first handler to return a Response wins
       ├─ (if null) main route.js conditional chain
       │     └─ first matching (route, method) branch wins
       ├─ 404 if nothing matches
       └─ 500 on any thrown error (single wrapping try/catch)
  └─ handleCORS(response)
```

## 7. Known rough edges / conventions

- The monolith is large; prefer adding new features as **handlers** and registering
  them in `index.js` at the correct position.
- Route matching is manual — **be deliberate about ordering** to avoid shadowing.
- Two activity-log collection names exist; confirm which one a feature uses.
- Payments and cloud storage are partly scaffolded; the Map view is optional.
