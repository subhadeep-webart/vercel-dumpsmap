// bounties-helpers.js
// ---------------------------------------------------------------------------
// Pure helper functions for the Bounties page. These were inlined at the top of
// app/(app)/bounties/page.js; hoisting them here keeps the card/dialog
// components focused on rendering and lets any consumer share the same money
// formatting + funding-math logic.
//
// Everything here is pure (no React, no I/O): same input → same output, so it's
// safe to call in render and trivial to unit-test.

// Number → "$1,234" (whole dollars, thousands separators, no cents).
export const fmtMoney = (v) =>
  `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

// Whole days from now until `date` (clamped at 0), or null when no date.
export const daysUntil = (date) => {
  if (!date) return null
  const ms = new Date(date).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}
