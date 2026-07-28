// DumpMaps Community Categories
// Operational, hyper-local, cleanup/contractor-focused (NOT generic social).
// 10 core categories aligned with the platform mission.
//
// Icons for categories / reactions / profile types live in lib/community-icons.jsx
// (lucide components), keyed by the `key` slugs below — kept out of this file so
// it stays plain, React-free data (categoryColor / timeAgo / resolveProfileType).

export const COMMUNITY_CATEGORIES = [
  {
    key: 'illegal_dumping',
    label: 'Illegal Dumping',
    color: 'red',
    desc: 'Report illegal dump sites, abandoned piles, and hot spots',
    placeholder: 'Where is the dump site? What was dumped? Photos help cleanup crews respond.',
    urgent: true,
  },
  {
    key: 'free_items',
    label: 'Free / Curb Alert',
    color: 'green',
    desc: 'Free items on the curb, reuse alerts, anti-landfill pickups',
    placeholder: 'What is available? Address or cross streets, pickup deadline, condition.',
  },
  {
    key: 'donation_need',
    label: 'Donation Need',
    color: 'purple',
    desc: 'Donation drives or recipients needing specific items',
    placeholder: 'What does the group need? Where to drop off? Deadline?',
  },
  {
    key: 'pickup_request',
    label: 'Pickup Request',
    color: 'blue',
    desc: 'Need a hauler — paid or volunteer pickups',
    placeholder: 'What needs to be hauled? Address, size, budget, deadline.',
  },
  {
    key: 'contractor_tip',
    label: 'Contractor Tip',
    color: 'orange',
    desc: 'Field tips from haulers: gates, scales, pricing, routes',
    placeholder: 'Share a real tip that saves time or money. Facility, time, what happened.',
  },
  {
    key: 'facility_update',
    label: 'Facility Update',
    color: 'cyan',
    desc: 'Live updates from / about facilities (wait times, closures)',
    placeholder: 'Which facility? Wait time, closure, full status, surcharge?',
  },
  {
    key: 'safety_alert',
    label: 'Safety Alert',
    color: 'amber',
    desc: 'Hazards: hazmat, fire, flooding, blocked alleys, sharp debris',
    placeholder: 'What is the hazard? Where? How long has it been there?',
    urgent: true,
  },
  {
    key: 'cleanup_event',
    label: 'Cleanup Event',
    color: 'lime',
    desc: 'Volunteer cleanups, e-waste days, donation drives',
    placeholder: 'Event name, date/time, meet location, what to bring.',
  },
  {
    key: 'agency_notice',
    label: 'Agency Notice',
    color: 'slate',
    desc: 'Verified updates from cities, sanitation, public works',
    placeholder: 'Official notice details. Bulk item day, enforcement action, route closure.',
    officialOnly: true,
  },
  {
    key: 'general',
    label: 'General',
    color: 'neutral',
    desc: 'Cleanup, recycling, reuse coordination',
    placeholder: 'Keep it operational — DumpMaps is not a generic social feed.',
  },
]

export const CATEGORY_BY_KEY = COMMUNITY_CATEGORIES.reduce((acc, c) => { acc[c.key] = c; return acc }, {})

export const REACTION_TYPES = [
  { key: 'helpful', label: 'Helpful' },
  { key: 'thanks', label: 'Thanks' },
  { key: 'concern', label: 'Concern' },
  { key: 'onit', label: 'On it' },
  { key: 'fire', label: 'Hot' },
]

export const REACTION_BY_KEY = REACTION_TYPES.reduce((a, r) => { a[r.key] = r; return a }, {})

export const PROFILE_TYPES = [
  { key: 'resident',         label: 'Resident',         color: 'neutral' },
  { key: 'contractor',       label: 'Contractor',       color: 'orange' },
  { key: 'hauler',           label: 'Hauler',           color: 'blue' },
  { key: 'recycler',         label: 'Recycler',         color: 'green' },
  { key: 'facility_owner',   label: 'Facility Owner',   color: 'purple' },
  { key: 'realtor',          label: 'Realtor',          color: 'cyan' },
  { key: 'property_manager', label: 'Property Manager', color: 'slate' },
  { key: 'volunteer',        label: 'Volunteer',        color: 'lime' },
  { key: 'business',         label: 'Business',         color: 'amber' },
  { key: 'agency',           label: 'Local Agency',     color: 'red' },
]

export const PROFILE_TYPE_BY_KEY = PROFILE_TYPES.reduce((a, p) => { a[p.key] = p; return a }, {})

// Map legacy primaryProfile/profileTypes values to new communityProfileType keys
export function resolveProfileType(user) {
  if (!user) return 'resident'
  if (user.communityProfileType && PROFILE_TYPE_BY_KEY[user.communityProfileType]) return user.communityProfileType
  // Legacy mapping
  const legacy = user.primaryProfile || (Array.isArray(user.profileTypes) && user.profileTypes[0]) || ''
  const map = {
    hauler: 'hauler',
    contractor: 'contractor',
    recycler: 'recycler',
    donor: 'volunteer',
    facility_owner: 'facility_owner',
    normal_user: 'resident',
  }
  return map[legacy] || 'resident'
}

export function categoryColor(key) {
  const c = CATEGORY_BY_KEY[key]
  const map = {
    red:     { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    chip: 'bg-red-100 text-red-800 border-red-300' },
    green:   { bg: 'bg-brand-50',  border: 'border-brand-300',  text: 'text-brand-700',  chip: 'bg-brand-100 text-brand-800 border-brand-300' },
    purple:  { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', chip: 'bg-purple-100 text-purple-800 border-purple-300' },
    blue:    { bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-700',   chip: 'bg-blue-100 text-blue-800 border-blue-300' },
    orange:  { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', chip: 'bg-orange-100 text-orange-800 border-orange-300' },
    cyan:    { bg: 'bg-cyan-50',   border: 'border-cyan-300',   text: 'text-cyan-700',   chip: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
    amber:   { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700',  chip: 'bg-amber-100 text-amber-800 border-amber-300' },
    lime:    { bg: 'bg-lime-50',   border: 'border-lime-300',   text: 'text-lime-700',   chip: 'bg-lime-100 text-lime-800 border-lime-300' },
    slate:   { bg: 'bg-slate-50',  border: 'border-slate-300',  text: 'text-slate-700',  chip: 'bg-slate-100 text-slate-800 border-slate-300' },
    neutral: { bg: 'bg-neutral-50',border: 'border-neutral-300',text: 'text-neutral-700',chip: 'bg-neutral-100 text-neutral-800 border-neutral-300' },
  }
  return map[c?.color || 'neutral'] || map.neutral
}

export function timeAgo(d) {
  if (!d) return '—'
  const ms = Date.now() - new Date(d).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  const mo = Math.floor(days / 30)
  return `${mo}mo ago`
}
