// payment-methods-helpers.js
// ---------------------------------------------------------------------------
// Pure helper functions for the Payment Methods page. These were previously
// inlined in app/settings/payment-methods/page.js; hoisting them here keeps the
// page + saved-card row focused on rendering and lets the data/action hooks
// share the same formatting logic.
//
// Everything here is pure (no React, no I/O): given the same input it returns
// the same output.

import { CARD_BRAND_LABELS } from '@/constants/payment_methods_constants'

// Stripe brand code → human label ("visa" → "Visa"). Falls back to a
// capitalized version of the raw brand, or "Card" when absent.
export function brandLabel(b) {
  if (!b) return 'Card'
  return CARD_BRAND_LABELS[String(b).toLowerCase()] || (b[0].toUpperCase() + b.slice(1))
}

// Payment method → "MM/YY" expiry string, or an em dash when unknown.
export function formatExpiry(pm) {
  if (!pm || !pm.expMonth || !pm.expYear) return '—'
  return `${String(pm.expMonth).padStart(2, '0')}/${String(pm.expYear).slice(-2)}`
}
