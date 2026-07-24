// layout_constants.js
// ---------------------------------------------------------------------------
// Constants for global layout chrome (header, nav, footer). Kept separate from
// app_constants.js so navigation config can evolve without touching brand/API
// constants.

// Desktop primary nav — Marketplace re-added July 2026 revival.
export const PRIMARY_NAV = [
  { key: 'facilities',  href: '/facilities',    label: 'Facilities' },
  { key: 'feed',        href: '/activity-hub',  label: 'Activity Hub' },
  { key: 'community',   href: '/community',     label: 'Community' },
  { key: 'marketplace', href: '/marketplace',   label: 'Marketplace' },
  { key: 'business',    href: '/business',      label: 'For Business' },
]
