# Setup & deployment

## Prerequisites

- **Node.js** (Next.js 14) and **Yarn** (`yarn@1.22.22`, pinned via `packageManager`).
- A reachable **MongoDB** instance (local or Atlas).

## Environment variables

Copy [`.env.example`](../.env.example) to `.env` and fill it in. **Never commit
`.env`** — it's git-ignored.

### Required

| Variable | Purpose |
|----------|---------|
| `MONGO_URL` | MongoDB connection string (e.g. `mongodb://localhost:27017`) |
| `DB_NAME` | Database name (e.g. `dumpmaps`) |
| `JWT_SECRET` | JWT signing key, **32+ chars**. The backend throws on startup if this is missing. |
| `NEXT_PUBLIC_BASE_URL` | Public base URL (e.g. `http://localhost:3000`) |
| `CORS_ORIGINS` | Allowed CORS origins |

### Optional (enable when keys arrive)

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe payments & webhooks. Without a valid `sk_(test\|live)_` key, donations fall back to a queued-intent flow. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `GMAIL_FROM_NAME` / `GMAIL_FROM_EMAIL` | Transactional email via Nodemailer/Gmail |
| `EMERGENT_LLM_KEY` / `EMERGENT_LLM_BASE_URL` | LLM for OCR receipt parsing |
| `GOOGLE_MAPS_KEY` | Re-enable the optional Map view (per README) |

> Stripe keys can alternatively be set at runtime via **Admin → Payments**, which
> writes the `payment_settings` singleton in Mongo. Env vars take precedence.

## Run locally

```bash
yarn install
yarn dev        # next dev on 0.0.0.0:3000 (memory-capped via NODE_OPTIONS)
```

Available scripts (see [`package.json`](../package.json)):

| Script | What it does |
|--------|--------------|
| `yarn dev` | Dev server on port 3000, `--max-old-space-size=512` |
| `yarn dev:no-reload` / `yarn dev:webpack` | Dev variants |
| `yarn build` | Production build (`next build`) |
| `yarn start` | Serve the production build |

Open <http://localhost:3000>. Mongo must be reachable via `MONGO_URL`.

## Seed data

On first DB connect, the app runs `ensureSeed(db)` and loads curated facility batches
from [`lib/seed/`](../lib/seed/) — CalRecycle **NorCal** and **SoCal**, **Pacific
Northwest**, and **Nevada** — into the facility-imports moderation queue. Seed files
are cached in memory after first load.

## First admin

Create a normal account, then promote it by setting the user's `role` to `super_admin`
in the Mongo `users` collection (see README / `app/memory/test_credentials.md` if
present in your deployment).

## Uploads

File uploads are written to a **persistent** directory (`/data/db/uploads`, alongside
Mongo's data so they survive redeploys) and served via `/api/files/[name]`. In a
vanilla dev box, uploads may land in `public/uploads/`. Cloud storage (S3/Cloudinary)
is planned but not yet wired.

## Tests

Backend integration tests are Python suites at the repo root, organized by phase/sprint:

```
backend_test_*.py          # ~50 suites (auth, admin, marketplace, rewards, …)
verify_*.py                # focused verification scripts
tests/                     # additional tests
test_reports/, test_result.md, *_QA_REPORT.md   # QA output
```

Run a suite with Python (they hit a running instance — check the file header for the
target base URL / credentials before running).

## Production deployment checklist

From the README, before going live:

**Required**
- [ ] Production `MONGO_URL` (Atlas recommended)
- [ ] Strong production `JWT_SECRET`, rotated from any preview value
- [ ] Production admin/owner account seeded
- [ ] Custom domain pointed at the deployment
- [ ] SSL/HTTPS confirmed at the host
- [ ] `NEXT_PUBLIC_BASE_URL` set to the live domain

**Optional when keys arrive**
- [ ] Stripe live keys + webhook secret
- [ ] Cloudinary / S3 bucket + credentials
- [ ] Google Maps JS API key (only to re-enable the Map view)
- [ ] Email provider credentials

**Always**
- [ ] `yarn build` passes
- [ ] No secrets committed (`.env` is git-ignored)
- [ ] All env vars documented in `.env.example`
- [ ] Critical-bug list from the latest QA report is empty

### Hosting

The project originated on **Emergent** and documents an Emergent + GoDaddy custom-domain
flow (Let's Encrypt SSL auto-issued after DNS verifies); it also builds as a standard
Next.js app (e.g. Vercel). See the README's "Custom domain setup" section for the
step-by-step DNS records.
