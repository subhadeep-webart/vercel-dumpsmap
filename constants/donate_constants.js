// donate_constants.js
// ---------------------------------------------------------------------------
// Static content + presets for the Donate page (app/(app)/donate/page.js).
// These arrays are pure marketing/config data (preset amounts, supporter tiers,
// impact items, metrics, transparency breakdown, testimonials) that the page
// only maps over. Hoisted here so the page component stays focused on layout
// and the data lives in one editable place.

import {
  Recycle, HeartHandshake, Truck, Building2, Users, Globe2, Activity,
  BadgeCheck, Box, MapPin, Hammer,
} from 'lucide-react'

// Quick-pick donation amounts shown as buttons above the custom-amount input.
export const PRESET_AMOUNTS = [5, 25, 50, 100]

// Supporter tiers. `key` matches the form's tier state; `accent` drives the
// tailwind colour classes on the tier cards; `amount` is the monthly default.
export const TIERS = [
  { key: 'recycler',   name: 'Recycler Supporter',  amount: 10,  icon: Recycle,        accent: 'blue',
    desc: 'Helps us keep the lights on — servers, mapping data, and verification.' },
  { key: 'community',  name: 'Community Supporter', amount: 25,  icon: HeartHandshake, accent: 'sky',
    desc: 'Supports the reuse + donation network and local cleanup coordination.' },
  { key: 'contractor', name: 'Contractor Supporter', amount: 50, icon: Hammer,         accent: 'amber',
    desc: 'Funds live wait times, contractor chat, and job-board intelligence.' },
  { key: 'facility',   name: 'Facility Partner',     amount: 250, icon: Building2,    accent: 'blue',
    desc: 'Enables deeper facility integrations, dynamic pricing, and verification.' },
  { key: 'mission',    name: 'Mission Partner',      amount: 500, icon: Globe2,       accent: 'purple',
    desc: 'Powers expansion into new regions and the long-term roadmap.' },
]

// "What your support helps build" grid.
export const IMPACT_ITEMS = [
  { icon: Activity,       title: 'Live facility updates',       desc: 'Wait times, closures, and accept/reject status from haulers on the ground.' },
  { icon: HeartHandshake, title: 'Community reuse network',     desc: 'Free items, salvage, and donation routing before things hit the landfill.' },
  { icon: Truck,          title: 'Contractor tools',            desc: 'Routing, hot spots, and live facility intelligence for haulers.' },
  { icon: Box,            title: 'Marketplace infrastructure',  desc: 'Residential & commercial listings, hauls, equipment, and bulk material.' },
  { icon: MapPin,         title: 'Mobile-first field tools',    desc: 'Built for the truck cab, not the office — photos, GPS, one-tap reports.' },
  { icon: Recycle,        title: 'Recycling education',         desc: 'Plain-language guides on what gets accepted, where, and at what price.' },
  { icon: Users,          title: 'Local cleanup coordination',  desc: 'Pickup needs, apartment turnovers, estate cleanouts, neighborhood drives.' },
  { icon: BadgeCheck,     title: 'Donation coordination',       desc: 'Real-time “needs furniture today” signals to redirect reusable items.' },
]

// Pilot-phase headline metrics.
export const METRICS = [
  { label: 'Facilities added',         value: '120+' },
  { label: 'Active haulers',           value: '40+' },
  { label: 'Community posts (target)', value: '1,000/mo' },
  { label: 'Contractor alerts shared', value: '5,200+' },
]

// "Where support goes" progress bars (percent of funds by area).
export const TRANSPARENCY = [
  { label: 'Platform development',  pct: 35 },
  { label: 'Server infrastructure', pct: 15 },
  { label: 'Facility verification', pct: 12 },
  { label: 'Community moderation',  pct: 10 },
  { label: 'Mapping / data systems', pct: 10 },
  { label: 'Mobile optimization',   pct: 8 },
  { label: 'Local outreach + cleanup coordination', pct: 10 },
]

// Field testimonials.
export const TESTIMONIALS = [
  { quote: 'Saved me a 25-minute round trip. Gate was closed and the feed told me before I rolled.', name: 'Marcus J.', role: 'Junk hauler · East Bay' },
  { quote: 'Got 12 office chairs picked up the same day instead of trashed. This is the missing layer.', name: 'Renee P.',  role: 'Property manager · San Jose' },
  { quote: 'Our donation center finally has a way to say “we need tables today” and have it actually reach people.', name: 'Iliana V.', role: 'Donation coordinator' },
  { quote: 'Best CRV center near me, with the line moving. Used to be a guessing game.', name: 'Devon T.', role: 'Recycler · Sunnyvale' },
]

// Static "Why DumpMaps exists" mission cards. Kept here alongside the other
// page content since the page only maps over them.
export const MISSION_POINTS = [
  { icon: Activity, title: 'Live facility intelligence', body: 'Wait times, accepted materials, closures, and pricing updated by people on the ground.' },
  { icon: HeartHandshake, title: 'A reuse-first ecosystem', body: 'Free items, donation needs, salvage opportunities — routed before things hit the dump.' },
  { icon: Truck, title: 'Built for the field', body: 'Mobile-first, photo-driven, one-tap reports for haulers, contractors, and facility crews.' },
]

// Partner-type chips in the "Partner with us" card.
export const PARTNER_TYPES = [
  'Transfer stations', 'Scrap yards', 'Donation centers', 'Recycling companies',
  'Realty firms', 'Property managers', 'Hauling crews', 'Local sponsors',
]
