// donate-helpers.js
// ---------------------------------------------------------------------------
// Pure helpers for the Donate page (app/(app)/donate/page.js). No React, no
// I/O — just the small amount-resolution rule the page uses in two places
// (the submit handler and the live button label), kept in one spot so they
// can't drift apart.

// Resolve the effective donation amount: a positive custom amount wins over
// the selected preset. Returns a Number (0 when nothing valid is set).
export function resolveAmount(custom, preset) {
  const c = Number(custom)
  return c > 0 ? c : preset
}
