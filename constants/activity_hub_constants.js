// Constants for the Activity Hub page (app/activity-hub).
// Kept out of the components/hooks so the presentational + data layers stay
// declarative. These describe the filter bar, the composer's post-type picker,
// and the feed-card type badges, plus the small helpers that resolve URL params
// onto these tables.

import {
  AlertTriangle, Briefcase, CircleDollarSign, Heart, Building2, Gift,
  MessageSquare, Globe, Lightbulb, Landmark,
} from 'lucide-react'

// Story-style filter bar. Each key maps to a feed API `filter` value.
export const FILTERS = [
  { key: 'all',        label: 'All',         icon: Globe,            tone: 'text-brand-600 bg-brand-100' },
  { key: 'alerts',     label: 'Alerts',      icon: AlertTriangle,    tone: 'text-red-600 bg-red-100' },
  // Jobs and Bounties category chips hidden for now — kept here (commented out) so they can be re-enabled easily.
  // { key: 'jobs',       label: 'Jobs',        icon: Briefcase,        tone: 'text-blue-600 bg-blue-100' },
  // { key: 'bounties',   label: 'Bounties',    icon: CircleDollarSign, tone: 'text-green-600 bg-green-100' },
  { key: 'donations',  label: 'Donations',   icon: Heart,            tone: 'text-rose-600 bg-rose-100' },
  { key: 'facilities', label: 'Facilities',  icon: Building2,        tone: 'text-amber-600 bg-amber-100' },
  { key: 'tips',       label: 'Tips',        icon: Lightbulb,        tone: 'text-yellow-600 bg-yellow-100' },
  { key: 'government', label: 'Gov',         icon: Landmark,         tone: 'text-purple-600 bg-purple-100' },
]

// Composer post-type picker. Types with an `href` route away to a dedicated
// page (e.g. /jobs/new) instead of composing inline.
export const POST_TYPES = [
  { value: 'general',           label: 'General Post',    icon: MessageSquare,    tone: 'text-neutral-700 bg-neutral-100', desc: 'Share something with the community' },
  { value: 'safety_alert',      label: 'Alert',           icon: AlertTriangle,    tone: 'text-red-600 bg-red-50',          desc: 'Report a safety issue or alert' },
  // Job and Bounty post types hidden for now — kept here (commented out) so they can be re-enabled easily.
  // { value: 'job',               label: 'Job',             icon: Briefcase,        tone: 'text-blue-600 bg-blue-50',        desc: 'Post a job for contractors', href: '/jobs/new' },
  // { value: 'bounty',            label: 'Bounty',          icon: CircleDollarSign, tone: 'text-green-600 bg-green-50',      desc: 'Start a community bounty', href: '/bounties/new' },
  { value: 'donation_need',     label: 'Donation Need',   icon: Heart,            tone: 'text-rose-600 bg-rose-50',        desc: 'Request donations' },
  { value: 'free_item',         label: 'Free Item',       icon: Gift,             tone: 'text-orange-600 bg-orange-50',    desc: 'Give away or offer for free' },
  { value: 'facility_update',   label: 'Facility Update', icon: Building2,        tone: 'text-amber-600 bg-amber-50',      desc: 'Post facility status (owners only)' },
  { value: 'contractor_tip',    label: 'Contractor Tip',  icon: Lightbulb,        tone: 'text-yellow-600 bg-yellow-50',    desc: 'Share a tip (verified contractors)' },
  { value: 'government_notice', label: 'Gov Notice',      icon: Landmark,         tone: 'text-purple-600 bg-purple-50',    desc: 'Official notice (gov accounts)' },
]

// Post types that open inline in the composer (i.e. not the ones that route
// away to a dedicated page like /jobs/new or /bounties/new).
export const INLINE_POST_TYPES = new Set(POST_TYPES.filter((p) => !p.href).map((p) => p.value))

// Aliases the GlobalFab uses in ?compose=<value>, mapped onto canonical
// POST_TYPES values.
export const COMPOSE_ALIASES = { illegal_dumping: 'safety_alert', alert: 'safety_alert', community: 'general' }

// Type badge shown on each feed card.
export const FEED_TYPE_META = {
  facility_update:   { label: 'FACILITY UPDATE', tone: 'bg-amber-100 text-amber-800',     icon: Building2 },
  job:               { label: 'JOB POSTED',      tone: 'bg-blue-100 text-blue-800',       icon: Briefcase },
  bounty:            { label: 'BOUNTY',          tone: 'bg-green-100 text-green-800',     icon: CircleDollarSign },
  donation_need:     { label: 'DONATION NEED',   tone: 'bg-rose-100 text-rose-800',       icon: Heart },
  free_item:         { label: 'FREE ITEM',       tone: 'bg-orange-100 text-orange-800',   icon: Gift },
  illegal_dumping:   { label: 'ILLEGAL DUMPING', tone: 'bg-red-100 text-red-800',         icon: AlertTriangle },
  safety_alert:      { label: 'SAFETY ALERT',    tone: 'bg-red-100 text-red-800',         icon: AlertTriangle },
  contractor_tip:    { label: 'CONTRACTOR TIP',  tone: 'bg-yellow-100 text-yellow-800',   icon: Lightbulb },
  government_notice: { label: 'GOV NOTICE',      tone: 'bg-purple-100 text-purple-800',   icon: Landmark },
  general:           { label: 'POST',            tone: 'bg-neutral-100 text-neutral-700', icon: MessageSquare },
}

// Filter keys the feed API understands. The visible FILTERS bar is a subset;
// `saved` and `mine` are valid API filters that arrive via the URL (e.g. the
// dashboard links to /activity-hub?filter=saved) even though `saved` has no chip.
export const VALID_FILTER_KEYS = new Set([...FILTERS.map((f) => f.key), 'saved', 'mine'])

// Feed page size — used both as the request `limit` and as the "is there
// another page?" threshold.
export const FEED_PAGE_SIZE = 20

// Resolve a ?compose=<value> query param to a valid inline composer type.
// Returns null when the value is missing/unknown or points at a type that
// routes away instead of composing.
export function resolveComposeType(raw) {
  if (!raw) return null
  const key = String(raw).toLowerCase()
  const resolved = COMPOSE_ALIASES[key] || key
  return INLINE_POST_TYPES.has(resolved) ? resolved : null
}

// Honour ?filter= from the URL; fall back to 'all' for missing/unknown values.
export function resolveFilter(raw) {
  const q = (raw || '').toLowerCase()
  return VALID_FILTER_KEYS.has(q) ? q : 'all'
}
