// marketplace_constants.js
// ---------------------------------------------------------------------------
// Constants + pure helpers for the residential Marketplace page. Extracted from
// app/(app)/marketplace/page.js so the page component stays a thin renderer and
// this config can be shared/edited without touching JSX.
//
// Everything here is framework-agnostic data (no React imports) so it can be
// consumed from server or client components. The style/label helpers are pure
// functions of a listing and return Tailwind class strings or display text.

// ---------------- Filter option lists ----------------
export const CATEGORIES = [
  'Furniture', 'Appliances', 'Electronics', 'Construction Materials', 'Scrap Metal',
  'Tools', 'Office Furniture', 'Restaurant Equipment', 'Fixtures', 'Pallets',
  'Household Goods', 'Collectibles', 'Toys & Games', 'Sporting Goods', 'Materials', 'Other',
]

export const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'for_parts', label: 'For Parts' },
]

export const STATUS_CHIPS = [
  { value: 'all', label: 'All Items' },
  { value: 'on_truck', label: 'On Truck' },
  { value: 'at_site', label: 'At Site' },
  { value: 'last_chance', label: 'Last Chance' },
  { value: 'free', label: 'Free', isPriceType: true },
  { value: 'fixed', label: 'For Sale', isPriceType: true },
  { value: 'donation', label: 'Donation', isPriceType: true },
  { value: 'obo', label: 'Make Offer', isPriceType: true },
  { value: 'trade', label: 'Trade', isPriceType: true },
]

export const DISTANCE_PRESETS = [
  { value: 8,    label: '5 miles' },
  { value: 16,   label: '10 miles' },
  { value: 40,   label: '25 miles' },
  { value: 80,   label: '50 miles' },
  { value: null, label: 'Statewide' },
]

export const SORTS = [
  { value: 'newest',        label: 'Newest First' },
  { value: 'closest',       label: 'Closest first' },
  { value: 'leaving_soon',  label: 'Leaving soon' },
  { value: 'price_asc',     label: 'Lowest price' },
  { value: 'price_desc',    label: 'Highest price' },
]

// Price-bucket radio options (left sidebar). Filtering itself stays client-side
// in the page so the backend query stays simple.
export const PRICE_BUCKETS = [
  { v: 'any',      l: 'Any Price' },
  { v: 'free',     l: 'Free' },
  { v: 'under50',  l: 'Under $50' },
  { v: '50_100',   l: '$50 — $100' },
  { v: '100_250',  l: '$100 — $250' },
  { v: '250_plus', l: '$250+' },
]

// ---------------- Helpers ----------------
// Auth header for API calls. Auth now rides on an httpOnly cookie added by the
// global fetch shim, so no Authorization header is needed here.
export function authHeaders() {
  return {}
}

// Legacy uploads stored URLs as "/uploads/<name>". We now serve via
// "/api/files/<name>". Normalize both shapes at render time.
export function normalizePhoto(url) {
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('/uploads/')) return `/api/files/${url.slice('/uploads/'.length)}`
  return url
}

export function timeAgoShort(d) {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

export function distMiles(km) {
  if (km == null) return null
  return km * 0.621371
}

export function priceLabel(l) {
  if (l.priceType === 'free' || l.price === 0) return 'FREE'
  if (l.priceType === 'donation') return 'DONATION'
  if (l.priceType === 'trade') return 'TRADE'
  if (l.priceType === 'obo') return l.price ? `$${l.price} or Make Offer` : 'Make Offer'
  if (l.priceType === 'contact') return 'Contact for price'
  return l.price != null ? `$${l.price}` : '—'
}

export function statusBadgeStyle(s) {
  switch (s) {
    case 'on_truck':    return 'bg-emerald-600 text-white'
    case 'at_site':     return 'bg-blue-600 text-white'
    case 'last_chance': return 'bg-rose-600 text-white animate-pulse'
    case 'reserved':    return 'bg-amber-500 text-white'
    case 'pending_pickup': return 'bg-amber-500 text-white'
    case 'sold':        return 'bg-neutral-700 text-white'
    case 'claimed':     return 'bg-neutral-700 text-white'
    case 'donated':     return 'bg-purple-600 text-white'
    case 'recycled':    return 'bg-emerald-700 text-white'
    default:            return 'bg-neutral-200 text-neutral-700'
  }
}

export function statusLabel(s) {
  if (!s) return 'AVAILABLE'
  return ({
    available: 'AVAILABLE',
    on_truck: 'ON TRUCK',
    at_site: 'AT SITE',
    last_chance: 'LAST CHANCE',
    reserved: 'RESERVED',
    pending_pickup: 'PENDING PICKUP',
    sold: 'SOLD',
    claimed: 'CLAIMED',
    donated: 'DONATED',
    recycled: 'RECYCLED',
  }[s] || String(s).toUpperCase())
}

export function sellerBadgeStyle(b) {
  if (!b) return 'border-neutral-300 bg-neutral-50 text-neutral-700'
  if (b.includes('Verified Hauler') || b.includes('Verified Contractor') || b.includes('Verified Nonprofit')) return 'border-brand-300 bg-brand-50 text-brand-800'
  if (b === 'Facility') return 'border-blue-300 bg-blue-50 text-blue-800'
  if (b === 'Vendor') return 'border-purple-300 bg-purple-50 text-purple-800'
  return 'border-neutral-300 bg-neutral-50 text-neutral-700'
}
