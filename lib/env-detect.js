// Runtime helper: are we currently running on the production canonical host?
//
// We can't rely on NODE_ENV in this container (it's "development" everywhere),
// so we detect the canonical production hostname at runtime in the browser.
// Anything else (preview, localhost, vercel preview, ngrok, etc.) is treated
// as a non-prod / "preview" environment where seeded sample fallbacks are OK
// to show.

export const PROD_HOSTS = new Set([
  'dumpmaps.org',
  'www.dumpmaps.org',
])

// IDs of seeded sample facilities that are linked from the homepage Map and
// other surfaces. These MUST resolve to a viewable page everywhere (including
// production), otherwise users see a confusing "Not Found" state for facilities
// they just clicked on from the map. We therefore opt them in to the sample
// fallback even on production.
export const KNOWN_SAMPLE_FACILITY_IDS = new Set([
  'fb-1', 'fb-2', 'fb-3', 'fb-4', 'fb-5', 'fb-6', 'fb-7', 'fb-8',
])

export function isProductionHost() {
  if (typeof window === 'undefined') return false
  try {
    return PROD_HOSTS.has(window.location.hostname)
  } catch {
    return false
  }
}

// True when we're allowed to show seeded sample-data fallbacks (preview/dev).
// If you pass an `id` and that id is in KNOWN_SAMPLE_FACILITY_IDS, we always
// allow the fallback (even on production) because that ID is linked from
// other surfaces and would otherwise dead-end.
export function canShowSampleFallback(id) {
  if (id && KNOWN_SAMPLE_FACILITY_IDS.has(String(id))) return true
  return !isProductionHost()
}
