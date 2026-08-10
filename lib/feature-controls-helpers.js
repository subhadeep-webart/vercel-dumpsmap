// feature-controls-helpers.js
// ---------------------------------------------------------------------------
// Pure helpers for the Feature Controls admin page
// (app/admin/feature-controls/page.js). These derive display state from the
// loaded flags without any React or I/O, so they're safe to call in render and
// trivial to unit-test.
//
// NOTE: this is distinct from lib/feature-control.js, which owns the server-side
// feature registry and the canAccessFeature gate. This file is UI-only.

import { STATUS_META } from '@/constants/feature_controls_constants'

// Tally flags by their globalStatus, seeded with every known status at 0 so the
// counter tiles always render a number (even for statuses with no flags).
export function countByStatus(flags = []) {
  const counts = {}
  for (const status of Object.keys(STATUS_META)) counts[status] = 0
  for (const f of flags) counts[f.globalStatus] = (counts[f.globalStatus] || 0) + 1
  return counts
}
