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
  Megaphone, BadgePercent, MessageSquareWarning, Settings,
  CircleCheck, CircleSlash, Timer, KeyRound, Briefcase, Activity, TriangleAlert,
} from 'lucide-react'

// Portal sidebar menu. `section` items swap the main panel (SaaS-style, one
// section at a time — clicking Pricing shows ONLY the pricing panel). `href`
// items deep-link to real pages elsewhere in the app.
//
// ROLE-BASED (client answers, docs/FACILITY_PORTAL_DEV.md §6 Q1–Q3): the facility
// backend is restricted to facility owners. Residents get a different menu —
// activity, jobs, and reporting — and cannot access facility management at all.
// Use menuForRole() rather than reading these arrays directly.

// Facility owner / facility user: manages the business side of the platform.
export const OWNER_MENU = [
  { key: 'dashboard',     label: 'Dashboard',           icon: LayoutDashboard, section: 'dashboard' },
  { key: 'profile',       label: 'Profile',             icon: Building2,       section: 'profile' },
  { key: 'pricing',       label: 'Pricing & Materials', icon: DollarSign,      section: 'pricing' },
  { key: 'wait',          label: 'Wait Time & Status',  icon: Timer,           section: 'wait' },
  { key: 'hours',         label: 'Hours & Closures',    icon: CalendarClock,   section: 'hours' },
  { key: 'photos',        label: 'Photos',              icon: ImageIcon,       section: 'photos' },
  { key: 'announcements', label: 'Announcements',       icon: Megaphone,       section: 'announcements' },
  { key: 'cashback',      label: 'Cashback Offers',     icon: BadgePercent,    section: 'cashback' },
  { key: 'reports',       label: 'Reports & Feedback',  icon: MessageSquareWarning, section: 'activity' },
  { key: 'account',       label: 'Account Settings',    icon: Settings,        section: 'settings' },
]

// Regular user / resident: general platform activity, jobs, and reporting. No
// facility backend. "Claim Facility" is the upgrade path to the owner menu.
export const RESIDENT_MENU = [
  { key: 'dashboard',  label: 'My Activity',       icon: Activity,   section: 'dashboard' },
  { key: 'profile',    label: 'Profile',           icon: Building2,  section: 'profile' },
  { key: 'jobs',       label: 'Jobs',              icon: Briefcase,  section: 'jobs' },
  { key: 'reports',    label: 'My Reports',        icon: MessageSquareWarning, section: 'activity' },
  { key: 'claim',      label: 'Claim Facility',    icon: KeyRound,   section: 'claim' },
  { key: 'account',    label: 'Account Settings',  icon: Settings,   section: 'settings' },
]

// Back-compat export — some callers (and the shell's section validator) want the
// full universe of sections. Prefer menuForRole() for anything user-facing.
export const PORTAL_MENU = OWNER_MENU

/**
 * The sidebar menu for a given role.
 * @param {boolean} isOwner — true for facility owners/staff, false for residents
 */
export function menuForRole(isOwner) {
  return isOwner ? OWNER_MENU : RESIDENT_MENU
}

// The panel shown first when the portal opens (same key in both menus).
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
  // Shown to residents in the Claim Facility section. Per Q4, users claim their
  // facility, validate ownership, accept the terms, and then become responsible
  // for maintaining its information.
  noFacility: {
    icon: KeyRound,
    title: 'Claim Your Facility',
    body: 'Do you run a drop-off location — a donation centre, recycling facility, trash station, or buyback facility? Claim it to manage your pricing, hours, accepted materials, and operational status. Once we verify the facility belongs to you, its information becomes yours to maintain.',
    cta: 'Find your facility',
    href: '/facilities',
  },
  // Owner role, but no facility record came back (deleted, or the fetch failed).
  // Distinct from noFacility — this account HAS ownership, so "claim one" is the
  // wrong instruction.
  ownerNoFacility: {
    icon: TriangleAlert,
    title: "We couldn't load your facility",
    body: 'Your account manages a facility, but we couldn’t load its record just now. Try again in a moment — if it keeps happening, contact support and we’ll sort it out.',
    cta: 'Browse facilities',
    href: '/facilities',
  },
  claimPending: {
    title: 'Claim under review',
    body: 'Our team is verifying your ownership. We usually reply to your business email within 1–2 business days. Once approved, your facility management tools appear here automatically.',
  },
  // Terms the claimant accepts before submitting (Q4: "accept the applicable
  // terms/conditions … become responsible for maintaining the facility information").
  claimTerms: [
    'I am an owner, manager, or authorised representative of this facility.',
    'I will keep the pricing, hours, accepted materials, and operational status accurate and up to date.',
    'I understand the information I publish is shown to the public as verified facility data.',
  ],
  residentNotice: {
    title: 'Facility management is for facility accounts',
    body: 'Pricing, hours, and materials are maintained by each facility. You can still report what you see — a price change, a long wait, a closed gate — and help keep the map accurate for everyone.',
  },
}
