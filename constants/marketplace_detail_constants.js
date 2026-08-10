// marketplace_detail_constants.js
// ---------------------------------------------------------------------------
// Constants for the Marketplace *detail* + *buyer dashboard* pages
// (app/(app)/marketplace/[id]/page.js and app/(app)/marketplace/me/page.js) and
// their hooks. Kept separate from constants/marketplace_constants.js (the main
// list page) so those existing exports stay untouched.
//
// Everything here is framework-agnostic data. The one lucide-icon import backs
// the "me" page's tab definitions; the colour-class maps are hoisted so they're
// not re-created on every render.

import {
  Timer, MessageCircle, CheckCircle2, Bell, Sparkles, Bookmark as BookmarkIcon,
} from 'lucide-react'

// ---------------- Buyer dashboard ("me" page) ----------------

// Tab definitions for the buyer dashboard.
export const ME_TABS = [
  { value: 'saved',      label: 'Saved',          icon: BookmarkIcon },
  { value: 'reserved',   label: 'Reserved',       icon: Timer },
  { value: 'messages',   label: 'Messages',       icon: MessageCircle },
  { value: 'claimed',    label: 'Claimed',        icon: CheckCircle2 },
  { value: 'alerts',     label: 'Nearby Alerts',  icon: Bell },
  { value: 'searches',   label: 'Saved Searches', icon: Sparkles },
]

// Empty saved-search form used by the SavedSearchEditor dialog.
export const EMPTY_SAVED_SEARCH = {
  name: '', category: '', city: '', keyword: '', maxKm: '',
  priceType: '', freeOnly: false, donationOnly: false, enabled: true,
}

// MetricCard accent → gradient/text colour classes, keyed by the `accent` prop.
export const METRIC_ACCENTS = {
  brand:  'from-brand-50 to-white text-brand-700',
  green:  'from-emerald-50 to-white text-emerald-700',
  rose:   'from-rose-50 to-white text-rose-700',
  amber:  'from-amber-50 to-white text-amber-700',
  purple: 'from-purple-50 to-white text-purple-700',
}
export const METRIC_ACCENT_FALLBACK = METRIC_ACCENTS.brand

// Small status-pill colour map used by the dashboard ListingTile.
export const TILE_STATUS_STYLE = {
  on_truck:    'bg-emerald-600 text-white',
  at_site:     'bg-blue-600 text-white',
  last_chance: 'bg-rose-600 text-white',
  reserved:    'bg-amber-500 text-white',
  sold:        'bg-neutral-700 text-white',
  claimed:     'bg-neutral-700 text-white',
  donated:     'bg-purple-600 text-white',
}
export const TILE_STATUS_STYLE_FALLBACK = 'bg-neutral-200 text-neutral-700'

// ---------------- Listing detail page ----------------

// itemStatus → Badge colour classes for the detail header. Note this map is
// intentionally scoped to the statuses the detail badge renders (which differs
// slightly from the list page's statusBadgeStyle — kept identical to the old
// inline ternary so behaviour doesn't change).
export const DETAIL_STATUS_BADGE = {
  on_truck:    'bg-emerald-600 text-white',
  at_site:     'bg-blue-600 text-white',
  last_chance: 'bg-rose-600 text-white',
  reserved:    'bg-amber-500 text-white',
  sold:        'bg-neutral-700 text-white',
  claimed:     'bg-neutral-700 text-white',
}
export const DETAIL_STATUS_BADGE_FALLBACK = 'bg-neutral-200 text-neutral-700'

// Reservation hold length shown in copy ("15 minutes"). Display-only.
export const RESERVE_HOLD_MINUTES = 15
