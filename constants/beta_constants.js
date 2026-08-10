// beta_constants.js
// ---------------------------------------------------------------------------
// Constants for the Beta signup page (app/(app)/beta/page.js). The page hard-
// coded its benefit list, the role <Select> options, and the interest tag chips
// inline in JSX. Hoisted here so the map/arrays aren't re-created on every
// render and the copy lives in one editable place.

import { MapPin, CircleDollarSign, Zap, HeartHandshake } from 'lucide-react'

// "What you get" benefit bullets rendered beside the form. `icon` is the
// lucide component, `t` the title, `d` the description.
export const BETA_BENEFITS = [
  { icon: MapPin,           t: 'Priority access',    d: 'Get onboarded before general release.' },
  { icon: Zap,              t: 'Live wait times',    d: 'See real-time facility conditions in your area.' },
  { icon: CircleDollarSign, t: 'Cashback rewards',   d: 'Earn cash back at participating buy-back centers.' },
  { icon: HeartHandshake,   t: 'Shape the platform', d: 'Direct line to our product team. Your feedback ships.' },
]

// Options for the "I am a…" role <Select>.
export const BETA_ROLES = [
  { value: 'resident',       label: 'Resident / Homeowner' },
  { value: 'contractor',     label: 'Contractor / Junk Hauler' },
  { value: 'facility_owner', label: 'Facility Owner / Operator' },
  { value: 'municipality',   label: 'Municipality / City Staff' },
  { value: 'nonprofit',      label: 'Nonprofit / Donation Org' },
  { value: 'other',          label: 'Other' },
]

// Interest tag chips (multi-select) shown below the role picker.
export const BETA_INTERESTS = [
  'Recycling', 'Donations', 'Buy-back', 'Transfer stations',
  'Hazardous waste', 'E-waste', 'Cashback', 'Community',
]

// Blank form state for the signup card.
export const EMPTY_BETA_FORM = {
  email: '',
  fullName: '',
  role: '',
  city: '',
  state: '',
  interests: [],
  notes: '',
}
