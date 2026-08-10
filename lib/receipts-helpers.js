// receipts-helpers.js
// ---------------------------------------------------------------------------
// Pure helper functions for the Receipt Center page. These were previously
// inlined at the top of app/(app)/receipts/page.js (the currency/tons
// formatters) and duplicated inside the form + batch panel (the net-weight and
// total-cost math). Hoisting them here keeps the page/view components focused on
// rendering and lets the form, the batch panel, and any hook share one copy.
//
// Everything here is pure (no React, no I/O): given the same input it returns
// the same output, so it's safe to call in render and trivial to unit-test.

// --- Formatting -------------------------------------------------------------

// Number → "$1,234.50" (always 2 decimals).
export const fmtUSD = (n) =>
  `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`

// Number → "12.34 t" (up to 2 decimals).
export const fmtTons = (n) =>
  `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} t`

// --- Weight / cost math -----------------------------------------------------

// Net pounds from gross/tare inputs (never negative). Inputs may be strings.
export const netLbOf = (grossLb, tareLb) =>
  Math.max(0, (Number(grossLb) || 0) - (Number(tareLb) || 0))

// Net tons (net lb / 2000) from gross/tare inputs.
export const netTonsOf = (grossLb, tareLb) => netLbOf(grossLb, tareLb) / 2000

// Computed total cost = net tons × $/ton, rounded to cents.
export const computedTotalOf = (grossLb, tareLb, pricePerTon) =>
  Number((netTonsOf(grossLb, tareLb) * (Number(pricePerTon) || 0)).toFixed(2))

// A fresh, empty batch row (today's date, sensible defaults).
export const emptyBatchRow = () => ({
  dateOf: new Date().toISOString().slice(0, 10),
  facilityName: '', materialType: 'Mixed C&D',
  grossLb: '', tareLb: '', pricePerTon: '',
  vehicleNumber: '', jobName: '', ticketNumber: '', notes: '',
})
