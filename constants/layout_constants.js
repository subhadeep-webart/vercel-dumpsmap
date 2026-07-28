// layout_constants.js
// ---------------------------------------------------------------------------
// Constants for global layout chrome (header, nav, footer). Kept separate from
// app_constants.js so navigation config can evolve without touching brand/API
// constants.
//
// HEADER_CONFIG is the single source of truth for the global <AppHeader />.
// The header component is a pure renderer of this object — edit nav here, not
// in the JSX. Icons are referenced by string name and resolved through the
// HEADER_ICONS registry in AppHeader (keeps this file free of React imports so
// it can be consumed anywhere, incl. server components).

// Desktop primary nav — Marketplace re-added July 2026 revival.
export const PRIMARY_NAV = [
  { key: 'facilities',  href: '/facilities',    label: 'Facilities' },
  { key: 'feed',        href: '/activity-hub',  label: 'Activity Hub' },
  { key: 'community',   href: '/community',     label: 'Community' },
  { key: 'marketplace', href: '/marketplace',   label: 'Marketplace' },
  { key: 'business',    href: '/business',      label: 'For Business' },
]

// Full header configuration. `icon` values are keys into HEADER_ICONS
// (defined in components/AppHeader.jsx). `tint` picks a DrawerRow color chip.
// `activeKey` (when present) is compared against the header's active key for
// highlighting; omit for rows that never show an active state.
export const HEADER_CONFIG = {
  brand: {
    name: 'DumpMaps',
    logo: '/dumpmaps-logo.png',
    // Logo destination depends on auth state.
    href: { loggedIn: '/activity-hub', guest: '/' },
  },

  // Desktop horizontal nav.
  primaryNav: PRIMARY_NAV,

  // Right-side CTA button (desktop md+).
  cta: { label: 'Support Our Mission', href: '/donate', icon: 'HeartHandshake' },

  // Mobile drawer, organised into sections. `requiresAuth: true` hides the
  // whole section for logged-out users.
  drawerSections: [
    {
      title: 'Explore',
      items: [
        { icon: 'MapPin',      label: 'Facilities',   href: '/facilities',   tint: 'emerald', activeKey: 'facilities' },
        { icon: 'Activity',    label: 'Activity Hub', href: '/activity-hub', tint: 'orange',  activeKey: 'feed' },
        { icon: 'Users',       label: 'Community',    href: '/community',    tint: 'sky',     activeKey: 'community' },
        { icon: 'ShoppingBag', label: 'Marketplace',  href: '/marketplace',  tint: 'amber',   activeKey: 'marketplace' },
      ],
    },
    {
      title: 'You',
      requiresAuth: true,
      items: [
        { icon: 'LayoutDashboard', label: 'Dashboard', href: '/dashboard', tint: 'neutral' },
        { icon: 'MessageSquare',   label: 'Messages',  href: '/messages',  tint: 'neutral' },
        { icon: 'UserIcon',        label: 'Profile',   href: '/profile',   tint: 'neutral' },
      ],
    },
    {
      title: 'More',
      items: [
        { icon: 'HeartHandshake', label: 'Support Our Mission', href: '/donate',   tint: 'rose',    featured: true },
        { icon: 'Building2',      label: 'For Business',        href: '/business', tint: 'emerald' },
        { icon: 'Info',           label: 'About',               href: '/#about',   tint: 'neutral' },
        { icon: 'Settings',       label: 'Settings',            href: '/settings', tint: 'neutral' },
        { icon: 'HelpCircle',     label: 'Help & Support',      href: '/#support', tint: 'neutral' },
        // Staff-only; rendered when the header knows the user is staff.
        { icon: 'Shield',         label: 'Admin Console',       href: '/admin',    tint: 'amber', requiresStaff: true },
      ],
    },
  ],
}
