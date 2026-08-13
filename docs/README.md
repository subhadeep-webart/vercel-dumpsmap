# DumpMaps — Documentation

> **DumpMaps** is an operational-intelligence platform for haulers, contractors,
> recyclers, donation drop-off sites, and the neighborhoods around them. It surfaces
> disposal sites, donation centers, recycling locations, live wait times, cleanup
> jobs, free-item curb alerts, and verified facility updates in one place.

This `docs/` folder documents how the project is built and how to work in it. It was
generated from a codebase read-through and is meant as an onboarding aid — when in
doubt, the source is the source of truth.

## Contents

| Doc | What it covers |
|-----|----------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | The backend catch-all router, the ordered handler-dispatch system, the MongoDB data model, auth, and cross-cutting concerns (Stripe, uploads, email, LLM). Start here. |
| [API.md](./API.md) | The endpoint map — how routing works, and a grouped reference of the routes exposed by `route.js` and the extracted handlers. |
| [FRONTEND.md](./FRONTEND.md) | The App Router page tree, role-based dashboards, the shared component library, and the `lib/` gating/business-logic helpers. |
| [SETUP.md](./SETUP.md) | Environment variables, running locally, seed data, and the production deployment checklist. |
| [MESSAGING.md](./MESSAGING.md) | Direct messages — the derived-thread data model, the `/api/dm/*` endpoints, the polling (no-cache) frontend, and the plan for the Activity Hub comment/message icon split. |

## The 60-second overview

- **Stack:** Next.js 14 (App Router, React 18) · Tailwind + shadcn/ui (Radix) · MongoDB
  (native driver) · JWT auth (bcrypt) · Stripe · Leaflet · Nodemailer · optional LLM.
- **Backend:** A single catch-all route — [`app/api/[[...path]]/route.js`](../app/api/%5B%5B...path%5D%5D/route.js)
  (~6,900 lines) — hand-rolls request routing by matching `route` + `method`. Newer
  features live in [`handlers/`](../app/api/%5B%5B...path%5D%5D/handlers/) and are dispatched
  **in a specific order** by `dispatchPr2b()` before the main route body runs.
- **Frontend:** ~78 App Router pages, including a large `/admin/*` suite and
  role-based dashboards (resident / contractor / facility / admin).
- **Origin:** Built on **Emergent AI**; developed in numbered phases/sprints
  (PR-1, PR-2a/b/c, Sprint A/B/1/2). This history shows up in file names, route
  comments, and the many `backend_test_*.py` suites at the repo root.

## Repository map

```
app/
  page.js                 # Home — map + facility search (large client component)
  layout.js               # Root layout, metadata, providers
  robots.js  sitemap.js   # SEO route handlers
  api/
    [[...path]]/route.js  # THE backend — catch-all router (see ARCHITECTURE.md)
    [[...path]]/handlers/ # Extracted feature handlers (messaging, rewards, …)
    stripe/webhook/       # Stripe webhook receiver
    files/[name]/         # Serves uploaded files from the persistent dir
    version/              # Build/version endpoint (used by VersionWatcher)
  admin/*                 # ~26 admin sections
  dashboard/*             # Role dashboards: resident/contractor/facility/admin
  <feature pages>         # marketplace, community, jobs, bounties, live-feed, …
components/               # Shared React components + ui/ (shadcn primitives)
hooks/                    # use-mobile, use-toast
lib/                      # Business logic + gating helpers + seed/ data
public/                   # Logos, OG image, favicons, /uploads (dev)
*.md (root)               # QA reports, navigation matrix
backend_test_*.py         # Python integration test suites (per phase/sprint)
```
