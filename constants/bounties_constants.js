// bounties_constants.js
// ---------------------------------------------------------------------------
// Constants for the Bounties page (app/(app)/bounties/page.js) and its hooks.
// Extracted so the page, its card/dialog sub-components, and the data/action
// hooks share a single source of truth for the state colour map, the filter
// tab defs, the contribute presets, and the new-bounty form defaults. Hoisting
// these keeps them from being re-created on every render.

// Per-state pill label + colour classes, keyed by bounty.state.
export const STATE_META = {
  draft:         { label: 'Draft',         tone: 'bg-neutral-100 text-neutral-700' },
  funding:       { label: 'Funding',       tone: 'bg-amber-100 text-amber-800' },
  goal_reached:  { label: 'Goal Reached',  tone: 'bg-emerald-100 text-emerald-800' },
  claimed:       { label: 'Claimed',       tone: 'bg-blue-100 text-blue-800' },
  in_progress:   { label: 'In Progress',   tone: 'bg-violet-100 text-violet-800' },
  verified:      { label: 'Verified',      tone: 'bg-brand-100 text-brand-800' },
  cancelled:     { label: 'Cancelled',     tone: 'bg-neutral-200 text-neutral-700' },
  expired:       { label: 'Expired',       tone: 'bg-red-100 text-red-800' },
}

// Filter row tab definitions. 'all' hides drafts + cancelled; every other key
// matches a bounty.state exactly (see the page's `filtered` derivation).
export const FILTERS = [
  { key: 'all',          label: 'All' },
  { key: 'funding',      label: 'Funding' },
  { key: 'goal_reached', label: 'Ready to Claim' },
  { key: 'in_progress',  label: 'In Progress' },
  { key: 'verified',     label: 'Completed' },
]

// Quick-amount presets (USD) shown in the Contribute dialog.
export const CONTRIBUTE_PRESETS = [10, 25, 50, 100]

// Default contribution amount pre-selected in the Contribute dialog.
export const DEFAULT_CONTRIBUTION = 25

// Blank Post-a-Bounty form. Used to seed and reset the dialog.
export const EMPTY_BOUNTY_FORM = {
  title: '', description: '', city: '', state: '', fundingGoalUsd: 250,
}
