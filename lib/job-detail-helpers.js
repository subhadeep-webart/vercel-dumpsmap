// job-detail-helpers.js
// ---------------------------------------------------------------------------
// Pure helpers for the Job / Pickup detail page (app/(app)/jobs/[id]/page.js).
// These are string derivations off a job record with no React or I/O, so they
// live here where the page and any future consumer can share them.

// Join a job's address parts into a single, comma-separated line, dropping any
// empty pieces. Used for the displayed location string.
export function jobAddressLine(job) {
  return [job?.address, job?.city, job?.state, job?.zip].filter(Boolean).join(', ')
}

// Build a Google Maps directions URL to the job's location. Uses a space-joined
// (not comma-joined) query, matching the original page behaviour.
export function jobDirectionsUrl(job) {
  const dest = [job?.address, job?.city, job?.state, job?.zip].filter(Boolean).join(' ')
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
}
