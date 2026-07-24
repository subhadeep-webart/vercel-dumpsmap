# DumpMaps

**DumpMaps** is the operational intelligence platform for haulers, contractors,
recyclers, donation drop-off sites, and the neighborhoods around them. Find
disposal sites, donation centers, recycling locations, live wait times, cleanup
jobs, free-item curb alerts, and verified facility updates — all in one place.

Live preview: <https://dumpmaps-pilot.preview.emergentagent.com/>

---

## 📦 Tech stack

- **Next.js 14 App Router** (React 19, server + client components)
- **Tailwind CSS + shadcn/ui** for design system
- **MongoDB** for data layer
- **JWT** for authentication
- Optional integrations (toggle via env when you bring keys):
  - **Stripe** for verified-poster fees, marketplace payments, contractor payouts
  - **AWS S3 / Cloudinary** for durable photo storage (currently `/public/uploads/`)
  - **Google Maps** for the optional Map view
  - Email provider (Resend / Postmark / SES) for transactional mail

---

## 🚀 Production deployment checklist

**Required before going live:**

- [ ] Production MongoDB URL (Atlas recommended) set in `MONGO_URL`
- [ ] Strong production `JWT_SECRET` rotated from preview value
- [ ] Production admin/owner account seeded (see `/app/memory/test_credentials.md`)
- [ ] Custom domain pointed at the deployment (see Domain Setup below)
- [ ] SSL/HTTPS confirmed at the host (Emergent native or Vercel)
- [ ] `NEXT_PUBLIC_BASE_URL` updated to the live domain

**Optional / nice-to-have when keys arrive:**

- [ ] Stripe live keys + webhook secret
- [ ] Cloudinary / S3 bucket + IAM credentials
- [ ] Google Maps JS API key (only if you re-enable the Map view)
- [ ] Email provider API key

**Always:**

- [ ] `production build` passes (`yarn build`)
- [ ] No exposed secret keys in the repo (`.env` is git-ignored)
- [ ] All env vars documented in `.env.example`
- [ ] Critical-bug list from latest QA report is empty

---

## 🌐 Custom domain setup (GoDaddy + Emergent)

The app is hosted on Emergent. Once you provision your live deployment:

1. **In Emergent**: copy the deployment domain (e.g. `dumpmaps-prod.emergentagent.com`).
2. **In GoDaddy DNS** (`dumpmaps.org`):
   - `A`/`ALIAS` record on `@` (root) → Emergent deployment IP, **OR**
     a `CNAME` flattening record if your DNS supports it.
   - `CNAME` record on `www` → `dumpmaps.org` (or the Emergent host).
   - `CNAME` record on `app` → the same Emergent host (so `app.dumpmaps.org` works).
3. **In Emergent**: add `dumpmaps.org`, `www.dumpmaps.org`, and `app.dumpmaps.org`
   to the deployment’s custom-domain list. Emergent will issue Let’s Encrypt
   SSL automatically once DNS verifies.
4. **In the app**: update env vars:
   - `NEXT_PUBLIC_BASE_URL=https://dumpmaps.org` (or `app.dumpmaps.org` if the app
     lives there and the root is a marketing page).
5. Wait for DNS propagation (5–60 min typical).
6. Test:
   - `https://dumpmaps.org` → 200 with valid cert
   - `https://www.dumpmaps.org` → 200 (or 301 to root)
   - `https://app.dumpmaps.org` → 200

> Tip: Add a `301` redirect from `www` to the canonical apex if you want a single
> canonical URL for SEO.

---

## 🔑 Environment variables

Set these in your deployment’s Environment Variables panel:

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGO_URL` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | JSON Web Token signing key (32+ chars) |
| `NEXT_PUBLIC_BASE_URL` | ✅ | Public base URL (e.g. `https://dumpmaps.org`) |
| `STRIPE_SECRET_KEY` | optional | Stripe payments |
| `STRIPE_PUBLISHABLE_KEY` | optional | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | optional | Stripe webhooks |
| `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY` / `S3_SECRET` | optional | Photo storage |
| `CLOUDINARY_URL` | optional | Photo storage (alt) |
| `GOOGLE_MAPS_KEY` | optional | Map view |
| `RESEND_API_KEY` | optional | Transactional email |

**Never** commit `.env` files. The repo ignores them.

---

## 📊 Admin & test credentials

See `/app/memory/test_credentials.md`. Rotate these for production. The first
super-admin can be promoted by setting the user’s `role` to `super_admin` in
the Mongo `users` collection.

---

## 🧪 Running locally

```bash
yarn install
sudo supervisorctl restart nextjs   # in the Emergent container
# or, for a vanilla dev box:
yarn dev
```

Mongo must be reachable via `MONGO_URL`. The app seeds curated facility batches
on boot (CalRecycle NorCal/SoCal, Pacific Northwest, Nevada) into the
facility-imports moderation queue.

---

## 🎨 Brand

Official brand colors:

| Token | Hex | Use |
|-------|-----|-----|
| `brand-600` | `#0B4DBA` | Primary DumpMaps Blue |
| `brand-navy` | `#0B1220` | Dark backgrounds, text on white |
| `brand-surface` | `#F5F7FA` | Page background, cards |
| `brand-400/500` | `#5C92EE` / `#2E70E0` | Hover, secondary CTAs |
| `amber-500/600` | — | Warnings (call to confirm) |
| `red-600` | — | Danger / critical |
| `green-600` | — | Reserved for explicit “success” states only |

Logo files live in `/public/`:
- `dumpmaps-logo.png` — primary square logo (used in headers + favicons)
- `og-image.png` — 1200×630 Open Graph image
- `apple-touch-icon.png` — 180×180 iOS home-screen icon
- `favicon-{16,32}.png`, `favicon.ico` — browser tabs

---

## 🚫 What's mocked / blocked

- **Payments (scaffolded)** — Stripe is wired through admin UI, but no SDK is
  installed and no real Checkout sessions are created. The new **Payment Health
  Dashboard** at `/admin/payments` shows live status, key validation,
  donation/marketplace/job volume aggregates, and "Run Connection Test" /
  "Verify Stripe Setup" buttons that return a clear ❌ until real keys land.
  Once an admin pastes `pk_test_…` + `sk_test_…` + `whsec_…` into the keys
  section (or sets them in `.env`), the dashboard lights up and `/donate`
  will create real Stripe Checkout sessions.
- **Cloud storage** — Photo uploads write to `/public/uploads/`. Swap to S3 /
  Cloudinary before scaling.
- **Map view** — Optional secondary view. Add `GOOGLE_MAPS_KEY` to re-enable.

---

## 🧾 Pre-launch QA report

See `QA_REPORT.md` in this directory for the latest full-platform smoke-test
summary, including the safe-to-launch verdict.

---

## 🚲 License

Proprietary — DumpMaps © 2026. All rights reserved.
