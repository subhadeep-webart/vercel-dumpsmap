// receipt-scanner-helpers.js
// ---------------------------------------------------------------------------
// Pure helper functions for the AI Receipt Scanner page. These were previously
// inlined in app/receipt-scanner/page.js; hoisting them here keeps the page
// focused on rendering and lets the actions hook share the same payload logic.
//
// Everything here is pure (no React, no I/O): given the same input it returns
// the same output, so it's safe to call in render and trivial to unit-test.

import { REWARD_SOURCE_LABELS } from '@/constants/receipt_scanner_constants'

// Humanise a reward source identifier for the user-facing breakdown. Known
// keys map to a friendly label; anything else falls back to the raw key with
// underscores turned into spaces.
export function humanizeSource(source) {
  return REWARD_SOURCE_LABELS[source] || String(source || '').replace(/_/g, ' ')
}

// Recompute net weight when gross/tare change. Given the draft plus the field
// that changed, returns the next draft: net (lb) and net (tons) are derived
// only when both gross and tare are positive, matching the original inline
// behaviour on the review form.
export function recomputeWeights(draft, key, value) {
  const next = { ...draft, [key]: value }
  const gross = Number(next.grossLb) || 0
  const tare = Number(next.tareLb) || 0
  if (gross > 0 && tare > 0) {
    next.netLb = Math.max(0, gross - tare)
    next.netTons = Number((next.netLb / 2000).toFixed(4))
  }
  return next
}

// Build the POST body for saving a receipt from the reviewed draft plus the
// OCR metadata captured during the scan.
export function buildSavePayload(draft, ocrMeta) {
  return {
    ...draft,
    photoUrl: ocrMeta?.photoUrl || null,
    ocr: ocrMeta
      ? {
          provider: ocrMeta.provider,
          model: ocrMeta.model,
          confidence: ocrMeta.confidence,
          elapsedMs: ocrMeta.elapsedMs,
        }
      : null,
  }
}
