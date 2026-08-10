// rewards-page-helpers.js
// ---------------------------------------------------------------------------
// Pure helpers for the Rewards page (app/(app)/rewards/page.js). These were
// inlined in the page component; hoisting them here keeps the view components
// focused on rendering and lets the data/action hooks share the same
// formatting + label logic.
//
// NOTE: this is deliberately separate from the existing server-side
// lib/rewards.js (the DB points/cashout engine) — that file is untouched.
//
// Everything here is pure (no React, no I/O): same input → same output.

import { SOURCE_LABELS } from '@/constants/rewards_constants'

// Points → localized integer string ("1,000").
export function fmtPts(n) {
  return Number(n || 0).toLocaleString()
}

// Cents → "$10.00" dollar string.
export function fmtDollars(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`
}

// Ledger source code → human label. Falls back to a title-cased version of the
// raw code ("some_thing" → "Some Thing").
export function labelForSource(s) {
  return (
    SOURCE_LABELS[s] ||
    String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}
