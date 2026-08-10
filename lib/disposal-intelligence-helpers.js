// disposal-intelligence-helpers.js
// ---------------------------------------------------------------------------
// Pure formatting helpers for the Disposal Intelligence page. These were
// inlined at the top of app/(app)/disposal-intelligence/page.js; hoisting them
// here keeps the page focused on rendering and matches the codebase convention
// of parking pure (no React, no I/O) helpers in lib/<page-name>-helpers.js.
//
// Everything here is pure: given the same input it returns the same output, so
// it's safe to call in render and trivial to unit-test.

// Number → USD string, e.g. 1234.5 → "$1,234.50".
export const fmtUSD = (n) =>
  `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`

// Number → tons string, e.g. 12.5 → "12.5 t".
export const fmtTons = (n) =>
  `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} t`
