// facility_detail_constants.js
// ---------------------------------------------------------------------------
// Constants for the facility detail page (app/facilities/[id]/page.js).
// Extracted so the page and its detail/ components share a single source of
// truth for the hero fallback image and tab configuration.

import { Activity, Recycle, CircleDollarSign, Gift, Megaphone, Star } from 'lucide-react'

// Default hero image — premium recycling facility shot. Used when the
// facility has no uploaded photo. Curated for DumpMaps brand alignment.
export const DEFAULT_HERO_IMAGE =
  'https://images.pexels.com/photos/27312908/pexels-photo-27312908.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'

// Status pill colour classes, keyed by statusMeta.color. Hoisted out of the
// hero component so the map isn't re-created on every render.
export const STATUS_PILL_COLORS = {
  green: 'bg-green-100 text-green-800 border-green-300',
  red:   'bg-red-100 text-red-800 border-red-300',
  amber: 'bg-amber-100 text-amber-900 border-amber-300',
  blue:  'bg-blue-100 text-blue-800 border-blue-300',
}

export const TABS = [
  { key: 'overview',  label: 'Overview',  icon: Activity },
  { key: 'materials', label: 'Materials', icon: Recycle },
  { key: 'pricing',   label: 'Pricing',   icon: CircleDollarSign },
  { key: 'rewards',   label: 'Rewards',   icon: Gift },
  { key: 'updates',   label: 'Updates',   icon: Megaphone },
  { key: 'reviews',   label: 'Reviews',   icon: Star },
]

// Breadcrumb trail for the facility detail page. The parent crumb is fixed;
// the leaf is the current facility's name, so this is a small builder rather
// than a static array.
export const facilityBreadcrumbs = (facilityName) => [
  { label: 'Facilities', href: '/facilities' },
  { label: facilityName },
]
