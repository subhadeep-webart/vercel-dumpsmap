// facility_detail_constants.js
// ---------------------------------------------------------------------------
// Constants for the facility detail page (app/facilities/[id]/page.js).
// Extracted so the page and its detail/ components share a single source of
// truth for the hero fallback image and tab configuration.

import { Activity, Recycle, DollarSign, Gift, Megaphone, Star } from 'lucide-react'

// Default hero image — premium recycling facility shot. Used when the
// facility has no uploaded photo. Curated for DumpMaps brand alignment.
export const DEFAULT_HERO_IMAGE =
  'https://images.pexels.com/photos/27312908/pexels-photo-27312908.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'

export const TABS = [
  { key: 'overview',  label: 'Overview',  icon: Activity },
  { key: 'materials', label: 'Materials', icon: Recycle },
  { key: 'pricing',   label: 'Pricing',   icon: DollarSign },
  { key: 'rewards',   label: 'Rewards',   icon: Gift },
  { key: 'updates',   label: 'Updates',   icon: Megaphone },
  { key: 'reviews',   label: 'Reviews',   icon: Star },
]
