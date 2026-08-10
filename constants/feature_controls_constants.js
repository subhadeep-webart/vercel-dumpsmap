// feature_controls_constants.js
// ---------------------------------------------------------------------------
// Constants for the Feature Controls admin page
// (app/admin/feature-controls/page.js). The status pill and category colour
// maps were previously inlined at the top of the page; hoisting them here keeps
// the page focused on rendering and gives the row + dialog + counter code one
// source of truth for status labels, icons, and colour classes.

import {
  EyeOff, Rocket, FlaskConical, Sparkles, Pause,
} from 'lucide-react'

// Feature status → pill metadata (label, ring/colour classes, icon). Keyed by
// flag.globalStatus. Object.keys(STATUS_META) also drives the counter tiles, so
// the order here is the order the counters render in.
export const STATUS_META = {
  live:        { label: 'Live',        cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200', icon: Rocket },
  beta:        { label: 'Beta',        cls: 'bg-violet-100 text-violet-800 ring-violet-200',     icon: FlaskConical },
  demo:        { label: 'Demo',        cls: 'bg-amber-100 text-amber-800 ring-amber-200',         icon: Sparkles },
  paused:      { label: 'Paused',      cls: 'bg-orange-100 text-orange-800 ring-orange-200',     icon: Pause },
  not_active:  { label: 'Not Active',  cls: 'bg-neutral-200 text-neutral-700 ring-neutral-300',  icon: EyeOff },
}

// Feature category → chip metadata (label + colour classes). Keyed by
// flag.category; unknown categories fall back to a neutral chip in the row.
export const CATEGORY_META = {
  navigation:  { label: 'Navigation Pages', cls: 'bg-brand-100 text-brand-800' },
  contractor:  { label: 'Contractor Ops',   cls: 'bg-sky-100 text-sky-800' },
  marketplace: { label: 'Marketplace',      cls: 'bg-blue-100 text-blue-800' },
  monetization:{ label: 'Monetization',     cls: 'bg-emerald-100 text-emerald-800' },
  rewards:     { label: 'Rewards',          cls: 'bg-pink-100 text-pink-800' },
  enterprise:  { label: 'Enterprise',       cls: 'bg-indigo-100 text-indigo-800' },
}

// Number of audit-log entries to request for the Audit tab.
export const AUDIT_LIMIT = 100
