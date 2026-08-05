// Constants for SiteHeader (components/SiteHeader.jsx).
// Kept out of the component so the nav is declarative and editable in one place.

import {
  Users, Layers, BookOpen, Sparkles, ShieldCheck, HeartHandshake, Info, LifeBuoy,
} from 'lucide-react'

// Primary public navigation — rendered in the desktop center nav and the mobile
// drawer. Each entry is a real link (href), so both surfaces use <Link> for
// prefetching + accessible navigation instead of button onClick handlers.
//
//   • `match` — highlights the item as active when SiteHeader's `active` prop
//     (or the item key) equals it.
//   • `external: true` — opens in a new tab (target=_blank rel=noopener). Used
//     for /business, which lives on a separate surface.
export const PRIMARY_NAV = [
  { key: 'facilities',  label: 'Facilities',  href: '/facilities',   match: 'facilities' },
  { key: 'community',   label: 'Activity Hub', href: '/activity-hub', match: 'community' },
  { key: 'marketplace', label: 'Marketplace', href: '/marketplace',  match: 'marketplace' },
  { key: 'business',    label: 'Business',    href: '/business',     match: 'business', external: true },
  { key: 'donate',      label: 'Donate',      href: '/donate',       match: 'donate' },
  { key: 'about',       label: 'About',       href: '/#about',       match: 'about' },
]

// Desktop "More" dropdown, grouped by section label. `emphasis: true` tints the
// Donate row. All items are internal links.
export const MORE_MENU = [
  {
    heading: 'Explore',
    items: [
      { key: 'groups',     label: 'Community groups',     href: '/community/groups',      icon: Users },
      { key: 'categories', label: 'Categories',           href: '/#categories',           icon: Layers },
      { key: 'how',        label: 'How it works',         href: '/#how',                  icon: BookOpen },
      { key: 'pilot',      label: 'Pilot program',        href: '/#pilot',                icon: Sparkles },
      { key: 'guidelines', label: 'Community guidelines', href: '/community/guidelines',  icon: ShieldCheck },
    ],
  },
  {
    heading: 'Support DumpMaps',
    items: [
      { key: 'donate',  label: 'Donate',          href: '/donate',   icon: HeartHandshake, emphasis: true },
      { key: 'about',   label: 'About',           href: '/#about',   icon: Info },
      { key: 'support', label: 'Help & support',  href: '/#support', icon: LifeBuoy },
    ],
  },
]

// Mobile drawer "More" section — flat list of internal links. `emphasis: true`
// tints the Support Our Mission row.
export const MOBILE_MORE_NAV = [
  { key: 'donate',     label: 'Support Our Mission', href: '/donate',              icon: HeartHandshake, emphasis: true },
  { key: 'guidelines', label: 'Community guidelines', href: '/community/guidelines', icon: ShieldCheck },
  { key: 'how',        label: 'How it works',         href: '/#how',                 icon: BookOpen },
  { key: 'about',      label: 'About',                href: '/#about',               icon: Info },
  { key: 'support',    label: 'Help & support',       href: '/#support',             icon: LifeBuoy },
]
