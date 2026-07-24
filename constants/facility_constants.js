// facility_constants.js
// ---------------------------------------------------------------------------
// Constants for the facilities directory + live feed. Moved out of
// components/HomeShell.jsx so the extracted facilities/ and home/ components
// share a single source of truth.

import {
  Activity,
  Clock,
  AlertTriangle,
  Heart,
  Truck,
  Package,
  BadgeCheck,
} from 'lucide-react'

// Facility type options for the filter sheet.
export const FACILITY_TYPES = [
  'Transfer Station',
  'Recycling Center',
  'Buy-Back Center',
  'Donation Center',
  'Tire Disposal',
  'Hazardous Waste',
  'HHW Drop-off',
  'Scrap Metal',
  'Green Waste',
  'Compost',
  'Construction Recycling',
  'E-Waste',
  'CRV Redemption',
  'Landfill',
  'Reuse Center',
  'Other',
]

// Material options for the filter sheet.
export const MATERIALS = ['Wood', 'Metal', 'Cardboard', 'Plastic', 'Concrete', 'Drywall', 'Roofing', 'Yard waste', 'Mattresses', 'Appliances', 'E-waste', 'Hazardous']

// Sort options for the facilities toolbar dropdown.
export const FACILITY_SORT_OPTIONS = [
  { k: 'distance', label: 'Nearest' },
  { k: 'rating',   label: 'Highest Rated' },
  { k: 'recent',   label: 'Recently Updated' },
  { k: 'name',     label: 'A → Z' },
]

// Human-readable labels for live alert types (Live Feed).
export const ALERT_TYPE_LABEL = {
  hours: 'Hours / status',
  long_wait: 'Long wait',
  short_wait: 'Short wait',
  no_wait: 'No wait',
  closed: 'Closed early',
  not_accepting: 'Not accepting',
  accepting_donations: 'Accepting now',
  needs_volunteers: 'Needs volunteers',
  pickup_available: 'Pickup available',
  free_dropoff: 'Free drop-off',
  paid_dropoff: 'Paid drop-off',
  hazardous_event: 'HHW event',
}

// Live Feed filter chips — groups alert types into broad, scannable buckets.
export const FEED_FILTERS = [
  { key: 'all',       label: 'All',        icon: Activity, match: () => true },
  { key: 'waits',     label: 'Wait times', icon: Clock,    match: (a) => ['long_wait', 'short_wait', 'no_wait'].includes(a.type) },
  { key: 'closures',  label: 'Closures',   icon: AlertTriangle, match: (a) => ['closed', 'not_accepting', 'hours'].includes(a.type) },
  { key: 'donations', label: 'Donations',  icon: Heart,    match: (a) => ['accepting_donations', 'needs_volunteers'].includes(a.type) },
  { key: 'pickups',   label: 'Pickups',    icon: Truck,    match: (a) => ['pickup_available'].includes(a.type) },
  { key: 'dropoffs',  label: 'Drop-offs',  icon: Package,  match: (a) => ['free_dropoff', 'paid_dropoff', 'hazardous_event'].includes(a.type) },
  { key: 'official',  label: 'Official',   icon: BadgeCheck, match: (a) => !!a.isOfficial },
]
