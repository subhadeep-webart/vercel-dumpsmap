// facility_portal_constants.js
// ---------------------------------------------------------------------------
// Constants for the Facility Portal (app/facility-owner/portal/page.js) and its
// components/facility-portal/ pieces — the redesigned facility-owner "profile"
// page with the operational dashboard folded in (see docs/FACILITY_PORTAL_*.md).
//
// Extracted per the codebase cleanup rules so the page, sidebar, cards, and hook
// share one source of truth for menu items, status options, and tone maps.
// Reconciles the mock-up's illustrative left menu with the app's real routes.

import {
  LayoutDashboard, Building2, DollarSign, Clock, CalendarClock, Image as ImageIcon,
  Megaphone, BadgePercent, MessageSquareWarning, BarChart3, Settings,
  CircleCheck, CircleSlash, Timer, TriangleAlert,
} from 'lucide-react'

// Portal sidebar menu. `section` items scroll to an in-page anchor (single-page
// portal. `section` items swap the main panel (SaaS-style, one section at a
// time — clicking Pricing shows ONLY the pricing panel). `href` items deep-link
// to real pages elsewhere in the app (Analytics, Account settings).
export const PORTAL_MENU = [
  { key: 'dashboard',     label: 'Dashboard',           icon: LayoutDashboard, section: 'dashboard' },
  { key: 'profile',       label: 'Profile',             icon: Building2,       section: 'profile' },
  { key: 'pricing',       label: 'Pricing & Materials', icon: DollarSign,      section: 'pricing' },
  { key: 'wait',          label: 'Wait Time & Status',  icon: Timer,           section: 'wait' },
  { key: 'hours',         label: 'Hours & Closures',    icon: CalendarClock,   section: 'hours' },
  { key: 'photos',        label: 'Photos',              icon: ImageIcon,       section: 'photos' },
  { key: 'announcements', label: 'Announcements',       icon: Megaphone,       section: 'announcements' },
  { key: 'cashback',      label: 'Cashback Offers',     icon: BadgePercent,    section: 'cashback' },
  { key: 'reports',       label: 'Reports & Feedback',  icon: MessageSquareWarning, section: 'activity' },
  { key: 'analytics',     label: 'Analytics',           icon: BarChart3,       href: '/analytics' },
  { key: 'account',       label: 'Account Settings',    icon: Settings,        section: 'settings' },
]

// The panel shown first when the portal opens.
export const DEFAULT_SECTION = 'dashboard'

// Facility live-status options — the "Update Status" dropdown on the status strip
// and the OPEN/CLOSED pill. `value` is written to facility.currentStatus via the
// owner-update PATCH.
export const STATUS_OPTIONS = [
  { value: 'open',   label: 'Open',   Icon: CircleCheck,  tone: 'bg-green-100 text-green-800 ring-green-200' },
  { value: 'busy',   label: 'Busy',   Icon: Clock,        tone: 'bg-amber-100 text-amber-900 ring-amber-200' },
  { value: 'closed', label: 'Closed', Icon: CircleSlash,  tone: 'bg-red-100 text-red-800 ring-red-200' },
]

// Tone classes for live signal pills reused across the Wait & Capacity card and
// the activity feed. Mirrors the map in app/dashboard/facility/page.js so the two
// owner surfaces read consistently.
export const SIGNAL_TONE = {
  open:          'bg-green-100 text-green-800',
  busy:          'bg-amber-100 text-amber-800',
  slow:          'bg-green-100 text-green-800',
  not_busy:      'bg-green-100 text-green-800',
  closed:        'bg-red-100 text-red-800',
  accepting:     'bg-green-100 text-green-800',
  not_accepting: 'bg-red-100 text-red-800',
  moderate:      'bg-amber-100 text-amber-800',
  long_wait:     'bg-amber-100 text-amber-800',
  scale_issue:   'bg-red-100 text-red-800',
  gate_closed:   'bg-red-100 text-red-800',
  price_update:  'bg-violet-100 text-violet-800',
  safety_alert:  'bg-red-100 text-red-800',
}

// Capacity buckets → tone. Drives the Yard Capacity tile colour on the mock-up
// (Low = green, Moderate = amber, High/Full = red).
export const CAPACITY_TONE = [
  { max: 40,  label: 'Low',      className: 'text-green-600' },
  { max: 75,  label: 'Moderate', className: 'text-amber-600' },
  { max: 101, label: 'High',     className: 'text-red-600' },
]

// The completion checklist that powers the Profile Strength meter. Each entry is
// scored client-side from the facility record (see portal-helpers → profileStrength).
export const STRENGTH_FIELDS = [
  { key: 'photos',   label: 'Add photos',        test: (f) => (f.photos?.length || f.images?.length || 0) > 0 },
  { key: 'pricing',  label: 'Set pricing',       test: (f) => !!(f.pricing?.pricePerTon || f.pricing?.materialPricing?.length) },
  { key: 'materials',label: 'List materials',    test: (f) => (f.accepted?.length || 0) > 0 },
  { key: 'hours',    label: 'Set hours',         test: (f) => !!f.hours && Object.keys(f.hours || {}).length > 0 },
  { key: 'phone',    label: 'Add phone number',  test: (f) => !!f.phone },
  { key: 'website',  label: 'Add website',       test: (f) => !!f.website },
]

// Empty/edge copy so the shell doesn't inline strings.
export const PORTAL_COPY = {
  noFacility: {
    icon: TriangleAlert,
    title: "You don't manage a facility yet",
    body: 'Find your facility in the directory and claim ownership. Once verified, it appears here with pricing, wait time, hours, and customer reports you can manage.',
    cta: 'Browse facilities',
    href: '/facilities',
  },
}
