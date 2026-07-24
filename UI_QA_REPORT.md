# UI_QA_REPORT — P0 Stability Sprint
Date: 2026-06-03
Owner: main agent

## Scope
Visual + functional checks on the surfaces touched by this sprint:
- Facility detail loading / not-found / error states
- Marketplace image rendering and placeholder fallback
- Dashboard merged-feed thumbnails

## Facility detail UI (`/facilities/[id]`)

| Check | Result |
|---|---|
| `/facilities/fb-1` renders full facility shell on preview | ✅ See `/tmp/fb1_fallback.png` |
| Top "Sample facility (demo)" banner — neutral grey, single line | ✅ |
| `/facilities/does-not-exist-123` shows the new NotFound card | ✅ See `/tmp/fac_notfound.png` |
| NotFound card has Browse + Retry CTAs, no dead links | ✅ |
| 10s AbortController prevents infinite "Loading…" on slow networks | ✅ Implemented via `setTimeout(() => ctrl.abort(), 10_000)` in `load()` |
| Skeleton card shown while fetching (not bare "Loading…" text) | ✅ `FacilityDetailSkeleton` renders header + 3 body cards + sidebar |
| Generic error (5xx / network) shows `FacilityErrorState` with Retry | ✅ |

## Marketplace images

| Check | Result |
|---|---|
| `/api/files/<uuid>.png` returns 200 with correct mime + cache headers for real file | ✅ Tested: 57559 bytes returned |
| `/api/files/non-existent.png` returns 404 | ✅ |
| Persisted upload directory `/data/db/uploads/` exists and survives container restarts | ✅ |
| `<CategoryPlaceholder>` is wired on all marketplace surfaces with `onError` fallback | ✅ `/app/app/marketplace/page.js`, `/app/app/marketplace/[id]/page.js`, `/app/app/marketplace/me/page.js`, `/app/components/marketplace/PostItemDialog.jsx` |
| Dashboard's "Fresh marketplace" + "Saved items" tiles now also use `CategoryPlaceholder` fallback | ✅ New `SmartListingThumb` helper in `/app/app/dashboard/page.js` |
| Listings with empty `photos:[]` show the category-themed placeholder, not a broken-image icon | ✅ Verified for "Facility Role Test Listing" + "Property_Manager Role Test Listing" (no photos) |

## Sample-data banner consistency

| Surface | Visual treatment |
|---|---|
| Landing map (`/`) | Discreet dark-grey pill "Demo facilities" — was loud amber "Showing sample data" |
| HomeShell facilities list | Soft neutral banner "Demo facilities — couldn't reach the live server." — was amber |
| `/facilities/[id]` | Thin top banner "Sample facility (demo). Live data will replace this once verified." |

Banners are *suppressed entirely* when `window.location.hostname === 'dumpmaps.org'` (or www.). Logic in `/app/lib/env-detect.js`.

## Mobile / responsive

| Check | Result |
|---|---|
| Facility detail at 390px wide | Renders single-column, header buttons wrap, no horizontal scroll | (visual-only check)
| NotFound card centers and stays inside the viewport | ✅ `max-w-md` container |
| Sample banner doesn't overflow on narrow screens | ✅ |

## Console errors / warnings

| Page | Errors | Notes |
|---|---|---|
| `/facilities/fb-1` | none | clean |
| `/facilities/does-not-exist-123` | none | clean |
| Dashboard hero | none | clean — verified during last sprint |

## Outstanding for next sprint

- Full Facility Option 1 redesign (Live Status / Materials / Pricing / Contractor Intel / Live Community cards)
- Unified design system (shared header, primary CTA, status badges, cards)
- Live Feed redesign with filter chips + `+ Post` floating CTA
- Community page nav consistency + categories
- Role-based dashboard variants (Resident / Contractor / Facility Owner / Vendor / Property Mgr / Admin)
- Forgot Password UI + Admin User Management modal
