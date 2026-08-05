// home_constants.js
// ---------------------------------------------------------------------------
// All static content for the home page ("/") lives here so the section
// components stay presentation-only. Icons reference lucide-react components
// directly, so each item can be rendered as `const Icon = item.icon`.
//
// Mirrors the pattern established by business_constants.js.

import {
  MapPin, Activity, CircleDollarSign, Users, HeartHandshake, Truck, Recycle, Heart,
  Cpu, AlertTriangle, Shield, Hammer, Trees, Building2,
} from 'lucide-react'

// ── Hero ──────────────────────────────────────────────────────────────────
// Trust stats row under the hero CTAs.
export const HERO_STATS = [
  { k: '10,000+', v: 'Facilities Mapped' },
  { k: '50,000+', v: 'Community Members' },
  { k: 'Live', v: 'Wait Times' },
]

// ── "Everything you need in one place" ───────────────────────────────────
// `color` keys into the chip map inside HomeFeatures.
export const FEATURES = [
  { icon: MapPin, color: 'emerald', title: 'Find Facilities', desc: 'Search nearby recycling, donation, buy-back, and waste facilities.' },
  { icon: Activity, color: 'orange', title: 'Live Updates', desc: 'Check wait times, closures, prices, and more from the community.' },
  { icon: CircleDollarSign, color: 'emerald', title: 'Earn Cash Back', desc: 'Upload receipts from participating locations and earn rewards.' },
  { icon: Users, color: 'sky', title: 'Community', desc: 'Share updates, ask questions, and connect with other members.' },
  { icon: HeartHandshake, color: 'rose', title: 'Make an Impact', desc: 'Recycle more. Donate more. Keep our community clean and green.' },
]

// ── Facility categories grid ─────────────────────────────────────────────
// `desc` is rendered via dangerouslySetInnerHTML — it contains HTML entities.
export const HOME_FACILITY_CATEGORIES = [
  { name: 'Transfer Stations', icon: Truck, desc: 'Drop-off &amp; hauling' },
  { name: 'Recycling Centers', icon: Recycle, desc: 'Curbside-ready' },
  { name: 'Buy-Back Centers', icon: CircleDollarSign, desc: 'Get paid to recycle' },
  { name: 'Donation Drop-Off', icon: Heart, desc: 'Furniture, clothes &amp; more' },
  { name: 'Tire Disposal', icon: Cpu, desc: 'Safe tire recycling' },
  { name: 'Hazardous Waste', icon: AlertTriangle, desc: 'Batteries, paint, chemicals' },
  { name: 'HHW Drop-Off', icon: Shield, desc: 'Household hazardous' },
  { name: 'Scrap Metal', icon: Hammer, desc: 'Metals &amp; appliances' },
  { name: 'Green Waste &amp; Compost', icon: Trees, desc: 'Yard debris &amp; organics' },
  { name: 'Construction Recycling', icon: Building2, desc: 'C&amp;D debris' },
  { name: 'E-Waste', icon: Cpu, desc: 'Electronics recycling' },
  { name: 'CRV Redemption', icon: Recycle, desc: 'Cans &amp; bottles' },
]

// ── How it works ─────────────────────────────────────────────────────────
export const HOME_HOW_IT_WORKS = [
  { n: 1, t: 'Search near you', d: 'Tap "Near Me" or enter a city. We surface verified drop-off sites within minutes.' },
  { n: 2, t: 'Check live conditions', d: 'See real-time wait times, gate status, and community reports before you drive.' },
  { n: 3, t: 'Go & earn rewards', d: 'One-tap directions. Upload your receipt at participating partners to earn cash back.' },
]

// ── Footer link columns ──────────────────────────────────────────────────
export const FOOTER_EXPLORE_LINKS = [
  { href: '/facilities', label: 'Facilities' },
  // { href: '/community',    label: 'Community' },
  { href: '/activity-hub', label: 'Activity Hub' },
  { href: '/business', label: 'For Business' },
]

export const FOOTER_COMPANY_LINKS = [
  { href: '/#about', label: 'About' },
  { href: '/beta', label: 'Join Beta' },
  { href: '/donate', label: 'Support Our Mission' },
  { href: '/community/guidelines', label: 'Community Guidelines' },
]
