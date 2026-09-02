// Constants for the Activity Hub page (app/activity-hub).
// Kept out of the components/hooks so the presentational + data layers stay
// declarative. These describe the filter bar, the composer's post-type picker,
// and the feed-card type badges, plus the small helpers that resolve URL params
// onto these tables.

import {
  AlertTriangle, Briefcase, CircleDollarSign, Heart, Building2, Gift,
  MessageSquare, MessageCircleMore, Send, Globe, Lightbulb, Landmark,
  FileText, UserRound, Bookmark,
} from 'lucide-react'

// Feed-card action icons.
//
// Comment and direct-message are deliberately DIFFERENT SHAPES, not two
// variants of a speech bubble. The card previously used MessageSquare for
// comments, which reads as a chat/DM bubble — the client flagged that it looked
// like a message icon rather than a comment icon.
//
//   COMMENT_ICON = MessageCircleMore → rounded speech bubble with ellipsis,
//                                  the conventional "reply to this post"
//                                  affordance.
//   DM_ICON      = Send          → paper plane, the near-universal "send a
//                                  message to this person" affordance.
//
// Keep these visually distinct if either is ever swapped: two similar bubbles
// side by side in the same action row are indistinguishable on a phone.
export const COMMENT_ICON = MessageCircleMore
export const DM_ICON = Send

// Story-style filter bar. Each key maps to a feed API `filter` value.
// `railLabel` is the longer form used by the left-rail vertical nav (which has
// the width for it); `label` stays short for any horizontal/chip rendering.
export const FILTERS = [
  { key: 'all',        label: 'All',         railLabel: 'All Updates', icon: FileText,         tone: 'text-green-700 bg-green-100' },
  { key: 'alerts',     label: 'Alerts',      icon: AlertTriangle,    tone: 'text-red-600 bg-red-100' },
  { key: 'donations',  label: 'Donations',   icon: Heart,            tone: 'text-rose-600 bg-rose-100' },
  { key: 'facilities', label: 'Facilities',  icon: Building2,        tone: 'text-amber-600 bg-amber-100' },
  { key: 'jobs',       label: 'Jobs',        icon: Briefcase,        tone: 'text-blue-600 bg-blue-100' },
  { key: 'tips',       label: 'Tips',        icon: Lightbulb,        tone: 'text-yellow-600 bg-yellow-100' },
  { key: 'government', label: 'Gov',         railLabel: 'Government', icon: Landmark,         tone: 'text-purple-600 bg-purple-100' },
  // Bounties chip hidden for now — kept here (commented out) so it can be re-enabled easily.
  // { key: 'bounties',   label: 'Bounties',    icon: CircleDollarSign, tone: 'text-green-600 bg-green-100' },
]

// Second group in the left rail, below a "Updates & Community" heading. These
// are personal views rather than post-type categories, so they read as a
// separate section. Both require auth — hidden from signed-out users.
export const PERSONAL_FILTERS = [
  { key: 'mine',  label: 'My Posts', icon: UserRound, tone: 'text-teal-600 bg-teal-100' },
  { key: 'saved', label: 'Saved',    icon: Bookmark,  tone: 'text-neutral-700 bg-neutral-100' },
]

// Composer post-type picker. Types with an `href` route away to a dedicated
// page (e.g. /jobs/new) instead of composing inline.
export const POST_TYPES = [
  { value: 'general',           label: 'General Post',    icon: MessageSquare,    tone: 'text-neutral-700 bg-neutral-100', desc: 'Share something with the community' },
  { value: 'safety_alert',      label: 'Alert',           icon: AlertTriangle,    tone: 'text-red-600 bg-red-50',          desc: 'Report a safety issue or alert' },
  { value: 'job',               label: 'Job',             icon: Briefcase,        tone: 'text-blue-600 bg-blue-50',        desc: 'Post a job for contractors', href: '/jobs/new' },
  // Bounty post type hidden for now — kept here (commented out) so it can be re-enabled easily.
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
// Type pill shown under the author name on each feed card. Labels are title
// case (the card renders them as-is, not uppercased) and the tones are the
// soft tint + deep text pairing the card design uses — light enough to sit
// quietly under the author name rather than compete with it.
export const FEED_TYPE_META = {
  facility_update:   { label: 'Facility Update', tone: 'bg-amber-50 text-amber-700',      icon: Building2 },
  job:               { label: 'Job Posted',      tone: 'bg-blue-50 text-blue-700',        icon: Briefcase },
  bounty:            { label: 'Bounty',          tone: 'bg-green-50 text-green-700',      icon: CircleDollarSign },
  donation_need:     { label: 'Donation Need',   tone: 'bg-green-50 text-green-700',      icon: Heart },
  free_item:         { label: 'Free Item',       tone: 'bg-orange-50 text-orange-700',    icon: Gift },
  illegal_dumping:   { label: 'Illegal Dumping', tone: 'bg-red-50 text-red-700',          icon: AlertTriangle },
  safety_alert:      { label: 'Safety Alert',    tone: 'bg-red-50 text-red-700',          icon: AlertTriangle },
  contractor_tip:    { label: 'Contractor Tip',  tone: 'bg-yellow-50 text-yellow-700',    icon: Lightbulb },
  government_notice: { label: 'Gov Notice',      tone: 'bg-purple-50 text-purple-700',    icon: Landmark },
  general:           { label: 'Post',            tone: 'bg-neutral-100 text-neutral-700', icon: MessageSquare },
}

// Every filter key the feed API understands — the category nav plus the
// personal views. Also what resolveFilter() validates ?filter= against.
export const VALID_FILTER_KEYS = new Set([
  ...FILTERS.map((f) => f.key),
  ...PERSONAL_FILTERS.map((f) => f.key),
])

// Feed page size — used both as the request `limit` and as the "is there
// another page?" threshold.
export const FEED_PAGE_SIZE = 20

// Canonical detail URL for a feed card.
//
// The API sends `href` on most cards, but an optimistically-inserted post (see
// use-activity-hub-actions) and any card the projection misses would otherwise
// have none — leaving that card with no way to reach its own detail page. User
// posts always live at /community/posts/<id>, so fall back to that rather than
// rendering a dead card.
export function postHref(card) {
  if (!card) return null
  if (card.href) return card.href
  return card.kind === 'post' && card.id ? `/community/posts/${card.id}` : null
}

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
