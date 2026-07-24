// business_constants.js
// ---------------------------------------------------------------------------
// All static content for the /business ("Partner With Us") page lives here so
// the page component stays presentation-only. Icons reference lucide-react
// components directly, so each item can be rendered as `const Icon = item.icon`.
//
// NOTE: BUSINESS_TYPE_OPTIONS / INTEREST_OPTIONS values must stay in sync with
// the enums in validator/business-inquiry.js (BUSINESS_TYPES / INTERESTS).

import {
  TrendingUp, Users, ShieldCheck, MapPin, Recycle, Heart, Truck, Cpu, Hammer,
  Trees, Building2, AlertTriangle, DollarSign, Sparkles, HeartHandshake, Leaf,
  CircleDollarSign, UserPlus, BadgeCheck, Gift,
} from 'lucide-react'

// Hero — bullet checklist under the headline.
export const HERO_BENEFITS = [
  'Drive more visits to your facility',
  'Reward your customers with cash back',
  'Build trust with verified partner badges',
  'Showcase your community impact',
]

// Stats band — headline metrics.
export const STATS = [
  { icon: Users, k: '10,000+', v: 'Active Users', d: 'Contractors & residents searching daily' },
  { icon: MapPin, k: '50,000+', v: 'Facilities Mapped', d: 'Across recycling, donation & buy-back' },
  { icon: CircleDollarSign, k: '$250K+', v: 'Cash Back Earned', d: 'By users at participating facilities' },
  { icon: Leaf, k: '1', v: 'Cleaner Community', d: 'Together we reduce waste' },
]

// How it works — numbered onboarding steps.
export const HOW_IT_WORKS = [
  { n: 1, icon: UserPlus,   t: 'Join DumpMaps', d: "Create your business account in minutes. It's free and easy." },
  { n: 2, icon: BadgeCheck, t: 'Claim Your Facility', d: 'Verify ownership and unlock your Verified Partner badge.' },
  { n: 3, icon: Gift,       t: 'Create Cashback Offers', d: 'Set your reward structure. We help you get it right.' },
  { n: 4, icon: TrendingUp, t: 'Grow & Track', d: 'Watch visits, redemptions, and impact in your dashboard.' },
]

// Benefits — "Why partner with DumpMaps?" cards.
export const BENEFITS = [
  { icon: TrendingUp, t: 'Increase Foot Traffic', d: 'Get discovered by thousands of local users actively looking to recycle, donate, or cash in.' },
  { icon: CircleDollarSign, t: 'Reward & Retain', d: 'Offer cash back to encourage repeat visits and build customer loyalty.' },
  { icon: ShieldCheck, t: 'Build Trust', d: 'Verified partner badge, customer reviews, and impact metrics showcase your commitment.' },
  { icon: Leaf, t: 'Support Sustainability', d: 'Together we can divert more waste, keep materials out of landfills, and create a greener community.' },
]

// Facility categories grid.
export const FACILITY_CATEGORIES = [
  { i: Truck, n: 'Transfer Stations' },
  { i: CircleDollarSign, n: 'Buy-Back Centers' },
  { i: Recycle, n: 'Recycling Centers' },
  { i: Heart, n: 'Donation Drop-Off' },
  { i: Cpu, n: 'E-Waste' },
  { i: AlertTriangle, n: 'Hazardous Waste' },
  { i: ShieldCheck, n: 'HHW Drop-Off' },
  { i: Hammer, n: 'Scrap Metal' },
  { i: Trees, n: 'Green Waste' },
  { i: Building2, n: 'Construction Recycling' },
  { i: Cpu, n: 'Tire Disposal' },
  { i: Sparkles, n: 'Other Facilities' },
]

// Small benefit chips beside the partner form.
export const FORM_BENEFITS = [
  { icon: MapPin, t: 'Attract Customers' },
  { icon: CircleDollarSign, t: 'Reward Loyalty' },
  { icon: ShieldCheck, t: 'Verified Badge' },
  { icon: Leaf, t: 'Support Sustainability' },
]

// "Business Type" select options — value must match validator BUSINESS_TYPES.
export const BUSINESS_TYPE_OPTIONS = [
  { value: 'transfer_station', label: 'Transfer Station' },
  { value: 'recycling_center', label: 'Recycling Center' },
  { value: 'buy_back', label: 'Buy-Back Center' },
  { value: 'donation', label: 'Donation Center' },
  { value: 'scrap_yard', label: 'Scrap Yard' },
  { value: 'hhw', label: 'HHW Program' },
  { value: 'tire', label: 'Tire Recycling' },
  { value: 'landfill', label: 'Landfill' },
  { value: 'other', label: 'Other' },
]

// "I'm interested in…" select options — value must match validator INTERESTS.
export const INTEREST_OPTIONS = [
  { value: 'partnership', label: 'Becoming a Verified Partner' },
  { value: 'cashback', label: 'Offering Cashback Rewards' },
  { value: 'listing', label: 'Getting Listed on the Map' },
  { value: 'analytics', label: 'Facility Analytics Dashboard' },
  { value: 'demo', label: 'Requesting a Demo' },
  { value: 'other', label: 'Something else' },
]

// Footer strip — trust badges.
export const FOOTER_BADGES = [
  { icon: CircleDollarSign, t: 'Free to join', d: 'No upfront costs' },
  { icon: Sparkles, t: 'Easy setup', d: 'Get started in minutes' },
  { icon: HeartHandshake, t: 'Dedicated support', d: "We're here to help" },
  { icon: ShieldCheck, t: 'Verified partners', d: 'Build trust & credibility' },
]
