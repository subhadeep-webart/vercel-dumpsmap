// facility-icons.jsx
// ---------------------------------------------------------------------------
// Resolves facility-type and community-status slugs to lucide-react icon
// components. Kept separate from lib/facility-types.js so that the config data
// there stays React-free (it's read by buildAutoTags and other plain-data
// logic). Mirrors the "config references icons by string, resolve to
// components here" convention used by components/AppHeader.jsx and
// components/home/home-facility-meta.js (TYPE_ICONS).

import {
  Banknote, Gift, Recycle, Wrench, Truck, Laptop, Hammer, Building2, MapPin,
  CircleDot, CircleSlash, Ban, Zap, Hourglass, CalendarClock, AlertTriangle,
} from 'lucide-react'

// Keyed by FACILITY_TYPE_CONFIG slug (see lib/facility-types.js).
const TYPE_ICONS = {
  crv: Banknote,
  donation: Gift,
  recycling: Recycle,
  scrap_yard: Wrench,
  transfer_station: Truck,
  ewaste: Laptop,
  reuse: Hammer,
  construction: Building2,
}

// Keyed by FACILITY_STATUS_OPTIONS slug (see lib/facility-types.js).
const STATUS_ICONS = {
  open: CircleDot,
  closed: CircleSlash,
  full: Ban,
  moving_fast: Zap,
  long_wait: Hourglass,
  appointment: CalendarClock,
  scale_down: AlertTriangle,
  partial_accept: Ban,
}

export function getTypeIcon(typeKey) {
  return TYPE_ICONS[typeKey] || MapPin
}

export function getStatusIcon(status) {
  return STATUS_ICONS[status] || null
}

// Facility-type icon. Falls back to a generic map pin for unknown types, so it
// always renders something (matches the FacilityRow photo-fallback behaviour).
export function TypeIcon({ typeKey, className = 'h-5 w-5' }) {
  const Icon = getTypeIcon(typeKey)
  return <Icon className={className} />
}

// Community-status icon. Renders nothing for an unknown status so callers can
// keep an optional pill. Icons are monochrome and inherit currentColor, so the
// caller's existing status color classes tint them.
export function StatusIcon({ status, className = 'h-4 w-4' }) {
  const Icon = getStatusIcon(status)
  return Icon ? <Icon className={className} /> : null
}
