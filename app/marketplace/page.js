'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ShoppingBag, Search, MapPin, Heart, Bell, Plus, BadgeCheck, Recycle, Leaf,
  Truck, Building2, HeartHandshake, Hammer, Package, Box, Filter, Loader2, Bookmark,
  Sparkles, ShieldCheck, Eye, MessageCircle, Clock, Crosshair, LayoutGrid, List as ListIcon,
  User,
} from 'lucide-react'
import PostItemDialog from '@/components/marketplace/PostItemDialog'
import QuickViewModal from '@/components/marketplace/QuickViewModal'
import ContactSellerModal from '@/components/marketplace/ContactSellerModal'
import CategoryPlaceholder from '@/components/marketplace/CategoryPlaceholder'
import CommercialB2BTab from '@/components/marketplace/CommercialB2BTab'
import FeatureLock from '@/components/FeatureLock'
import AppHeader from '@/components/AppHeader'
import SafeImage from '@/components/SafeImage'
import { SoftLoginModal } from '@/components/SoftLoginModal'

// Legacy uploads stored URLs as "/uploads/<name>". We now serve via
// "/api/files/<name>". Normalize both shapes at render time.
function normalizePhoto(url) {
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('/uploads/')) return `/api/files/${url.slice('/uploads/'.length)}`
  return url
}

// ---------------- Constants ----------------
const CATEGORIES = [
  'Furniture', 'Appliances', 'Electronics', 'Construction Materials', 'Scrap Metal',
  'Tools', 'Office Furniture', 'Restaurant Equipment', 'Fixtures', 'Pallets',
  'Household Goods', 'Collectibles', 'Toys & Games', 'Sporting Goods', 'Materials', 'Other',
]
const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'for_parts', label: 'For Parts' },
]
const STATUS_CHIPS = [
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
const DISTANCE_PRESETS = [
  { value: 8,    label: '5 miles' },
  { value: 16,   label: '10 miles' },
  { value: 40,   label: '25 miles' },
  { value: 80,   label: '50 miles' },
  { value: null, label: 'Statewide' },
]
const SORTS = [
  { value: 'newest',        label: 'Newest First' },
  { value: 'closest',       label: 'Closest first' },
  { value: 'leaving_soon',  label: 'Leaving soon' },
  { value: 'price_asc',     label: 'Lowest price' },
  { value: 'price_desc',    label: 'Highest price' },
]

// ---------------- Helpers ----------------
function authHeaders() {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}
function timeAgoShort(d) {
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
function distMiles(km) {
  if (km == null) return null
  return km * 0.621371
}
function priceLabel(l) {
  if (l.priceType === 'free' || l.price === 0) return 'FREE'
  if (l.priceType === 'donation') return 'DONATION'
  if (l.priceType === 'trade') return 'TRADE'
  if (l.priceType === 'obo') return l.price ? `$${l.price} or Make Offer` : 'Make Offer'
  if (l.priceType === 'contact') return 'Contact for price'
  return l.price != null ? `$${l.price}` : '—'
}
function statusBadgeStyle(s) {
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
function statusLabel(s) {
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
function sellerBadgeStyle(b) {
  if (!b) return 'border-neutral-300 bg-neutral-50 text-neutral-700'
  if (b.includes('Verified Hauler') || b.includes('Verified Contractor') || b.includes('Verified Nonprofit')) return 'border-brand-300 bg-brand-50 text-brand-800'
  if (b === 'Facility') return 'border-blue-300 bg-blue-50 text-blue-800'
  if (b === 'Vendor') return 'border-purple-300 bg-purple-50 text-purple-800'
  return 'border-neutral-300 bg-neutral-50 text-neutral-700'
}

// ---------------- Listing Card ----------------
// Tiny image-with-fallback used by list mode + anywhere we render a single
// listing photo as a thumbnail. Falls back to <CategoryPlaceholder /> on load
// error so we never show a broken image icon.
function ListingThumb({ photo, category, showLabel = false, className = '' }) {
  const [failed, setFailed] = useState(false)
  const src = normalizePhoto(photo)
  if (!src || failed) {
    return <CategoryPlaceholder category={category} size="sm" showLabel={showLabel} />
  }
  return <img src={src} alt="" className={`h-full w-full object-cover ${className}`} onError={() => setFailed(true)} />
}

function ListingCard({ l, onSave, isSaved, onClick }) {
  const miles = distMiles(l.distanceKm)
  const photo = normalizePhoto((l.photos && l.photos[0]) || null)
  const [imgFailed, setImgFailed] = useState(false)
  const priceIsFree = l.priceType === 'free' || l.price === 0
  return (
    <Card className="group relative cursor-pointer overflow-hidden border-neutral-200 transition hover:-translate-y-0.5 hover:shadow-xl" onClick={onClick}>
      <div className="relative aspect-[4/3] w-full bg-neutral-100">
        {photo && !imgFailed ? (
          <img
            src={photo}
            alt={l.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <CategoryPlaceholder category={l.category} />
        )}

        {/* PRICE TAG \u2014 prominent, upper-right corner (Upside-style) */}
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          <span className={`rounded-lg px-2.5 py-1 text-sm font-black shadow-md backdrop-blur ${priceIsFree ? 'bg-emerald-500 text-white' : 'bg-white/95 text-neutral-900'}`}>
            {priceLabel(l)}
          </span>
          {/* Save heart under price */}
          <button
            onClick={(e) => { e.stopPropagation(); onSave?.(l) }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-neutral-700 shadow-sm hover:bg-white"
            aria-label="Save"
          >
            <Heart className={`h-4 w-4 ${isSaved ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>

        {/* Status pills, upper-left */}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ${statusBadgeStyle(l.itemStatus)}`}>
            {statusLabel(l.itemStatus)}
          </span>
          {l.leavingInMinutes != null && l.leavingInMinutes > 0 && l.itemStatus !== 'sold' && l.itemStatus !== 'claimed' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white">
              <Clock className="h-3 w-3" /> Leaving in {l.leavingInMinutes} min
            </span>
          )}
        </div>

        {/* Quick View hover overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3 opacity-0 transition group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg">
            <Eye className="h-3 w-3" /> Quick View
          </span>
        </div>
      </div>
      <CardContent className="space-y-1 p-3">
        <div className="line-clamp-1 text-sm font-bold text-neutral-900">{l.title}</div>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{miles != null ? `${miles.toFixed(1)} mi \u00b7 ` : ''}{l.city || '\u2014'}</span>
          <span>{timeAgoShort(l.createdAt)}</span>
        </div>
        {l.seller && (
          <div className="mt-1.5 flex items-center justify-between border-t border-neutral-100 pt-1.5">
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 overflow-hidden rounded-full bg-neutral-200">
                {l.seller.avatarUrl ? <SafeImage src={l.seller.avatarUrl} alt="" kind="avatar" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-[10px] font-bold text-neutral-500">{(l.seller.name || '?')[0].toUpperCase()}</div>}
              </div>
              <span className="text-xs font-medium text-neutral-700 line-clamp-1">{l.seller.name}</span>
            </div>
            {l.seller.badge && (
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${sellerBadgeStyle(l.seller.badge)}`}>
                <BadgeCheck className="mr-0.5 inline h-3 w-3" />{l.seller.badge.replace('Verified ', '')}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------- Why Use Panel ----------------
function WhyUsePanel() {
  const items = [
    { icon: Recycle,        title: 'Keep it out of the landfill', desc: 'Help the environment and your wallet.' },
    { icon: Crosshair,      title: 'Find great deals nearby',     desc: 'New items posted every minute.' },
    { icon: BadgeCheck,     title: 'Verified haulers & vendors',  desc: 'Buy with confidence.' },
    { icon: Bell,           title: 'Smart alerts',                desc: 'Get notified about items you want.' },
    { icon: Truck,          title: 'Real-time updates',           desc: 'On truck, at site, or last chance.' },
    { icon: ShieldCheck,    title: 'Safety tips',                 desc: 'Meet in safe public places when possible. Never share personal info. Report suspicious activity.' },
  ]
  return (
    <Card className="border-neutral-200">
      <CardContent className="space-y-3 p-5">
        <div className="text-base font-extrabold tracking-tight">Why Use DumpMaps Marketplace?</div>
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <it.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-900">{it.title}</div>
              <div className="text-xs leading-relaxed text-neutral-600">{it.desc}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ---------------- Seller Dashboard ----------------
function SellerDashboard({ user, myListings }) {
  if (!user) return null
  const active = myListings.filter((l) => !l.sold && l.itemStatus !== 'sold' && l.itemStatus !== 'claimed')
  const reserved = myListings.filter((l) => l.itemStatus === 'reserved')
  const claimed = myListings.filter((l) => l.itemStatus === 'sold' || l.itemStatus === 'claimed' || l.itemStatus === 'donated')
  const revenue = claimed.reduce((s, l) => s + (Number(l.price) || 0), 0)
  const itemsDiverted = claimed.length
  const dumpFeesAvoided = itemsDiverted * 40 // est. $40 per item diverted
  const co2 = (itemsDiverted * 28 / 1000).toFixed(2) // ~28kg per item heuristic

  return (
    <Card className="border-neutral-200">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div className="text-base font-extrabold tracking-tight">Seller Dashboard</div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">This Month</span>
        </div>
        <div className="space-y-2 text-sm">
          <Row icon={Sparkles}        label="Revenue Recovered"  value={`$${revenue.toLocaleString()}`} highlight />
          <Row icon={Truck}           label="Dump Fees Avoided"  value={`$${dumpFeesAvoided.toLocaleString()}`} highlight />
          <Row icon={Recycle}         label="Items Diverted"     value={itemsDiverted} highlight />
          <Row icon={Leaf}            label="CO₂ Saved"          value={`${co2} tons`} highlight />
        </div>
        <div className="space-y-1 border-t border-neutral-100 pt-3 text-sm">
          <Row label="Active Listings" value={active.length} />
          <Row label="Items Reserved"  value={reserved.length} />
          <Row label="Items Sold/Claimed" value={claimed.length} />
        </div>
        <Link href="/marketplace?mine=1" className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-neutral-50">
          View All My Listings
        </Link>
      </CardContent>
    </Card>
  )
}
function Row({ icon: Icon, label, value, highlight }) {
  return (
    <div className="flex items-center justify-between">
      <div className="inline-flex items-center gap-2 text-neutral-600">
        {Icon && <Icon className="h-4 w-4 text-brand-600" />}
        <span>{label}</span>
      </div>
      <span className={`font-bold ${highlight ? 'text-brand-700' : 'text-neutral-900'}`}>{value}</span>
    </div>
  )
}

// ---------------- Main Page ----------------
export default function MarketplacePage() {
  // Page-level feature gate: when Super Admin sets `marketplace` to
  // not_active/paused/demo/beta, FeatureLock renders the appropriate
  // locked screen INSTEAD of the page. Existing data stays in the DB.
  return (
    <FeatureLock featureKey="marketplace">
      <MarketplacePageInner />
    </FeatureLock>
  )
}

function MarketplacePageInner() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [listings, setListings] = useState([])
  const [myListings, setMyListings] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [statusChip, setStatusChip] = useState('all')
  const [condition, setCondition] = useState('')
  const [priceBucket, setPriceBucket] = useState('any')      // any|free|under50|50_100|100_250|250_plus
  const [distancePreset, setDistancePreset] = useState(16)   // default 10 mi
  const [coords, setCoords] = useState(null)                 // { lat, lng } or null
  const [coordsLabel, setCoordsLabel] = useState('All locations')
  const [sort, setSort] = useState('newest')
  const [viewMode, setViewMode] = useState('grid')           // grid|list
  const [postOpen, setPostOpen] = useState(false)
  // Soft-login modal state. Stores an action key ('save'|'post'|...) when a
  // logged-out user tries to engage; null otherwise.
  const [softLogin, setSoftLogin] = useState(null)
  const requireAuth = (action) => {
    if (user) return true
    setSoftLogin(action)
    return false
  }
  // New: tab dimension. 'residential' shows the existing residential
  // marketplace; 'commercial_b2b' swaps in the CommercialB2BTab component.
  const [marketView, setMarketView] = useState('residential')

  // Honor ?tab=commercial_b2b and ?apply=1 query params so external links
  // (and the AppHeader) can deep-link straight to the B2B tab.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('tab') === 'commercial_b2b') setMarketView('commercial_b2b')
  }, [])

  // Load me
  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!t) return
    fetch('/api/auth/me', { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => setUser(j?.user || null))
      .catch(() => {})
  }, [])

  // Geolocate (browser, optional)
  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return toast.error('Geolocation not supported')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setCoordsLabel('Current Location')
      },
      () => toast.error('Could not get location')
    )
  }

  // Load listings whenever filters change
  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (cat) params.set('category', cat)
      if (condition) params.set('condition', condition)
      if (statusChip && statusChip !== 'all') {
        const chip = STATUS_CHIPS.find((c) => c.value === statusChip)
        if (chip?.isPriceType) params.set('priceType', statusChip)
        else params.set('itemStatus', statusChip)
      }
      if (coords) {
        params.set('lat', String(coords.lat))
        params.set('lng', String(coords.lng))
        if (distancePreset) params.set('maxKm', String(distancePreset))
      }
      if (sort) params.set('sort', sort)

      const r = await fetch(`/api/marketplace?${params.toString()}`, { headers: authHeaders() })
      const j = await r.json()
      let arr = j.listings || []
      // local price-bucket filter (kept client-side so backend stays simple)
      if (priceBucket !== 'any') {
        arr = arr.filter((l) => {
          if (priceBucket === 'free') return l.priceType === 'free' || l.price === 0
          if (priceBucket === 'under50') return l.price != null && l.price < 50
          if (priceBucket === '50_100') return l.price != null && l.price >= 50 && l.price <= 100
          if (priceBucket === '100_250') return l.price != null && l.price > 100 && l.price <= 250
          if (priceBucket === '250_plus') return l.price != null && l.price > 250
          return true
        })
      }
      setListings(arr)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-line react-hooks/exhaustive-deps */ },
    [q, cat, condition, statusChip, coords, distancePreset, sort, priceBucket])

  // My listings (for seller dashboard)
  useEffect(() => {
    if (!user) { setMyListings([]); return }
    fetch('/api/marketplace?mine=true&includeSold=true', { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setMyListings(j.listings || []))
      .catch(() => {})
  }, [user])

  const onSave = async (l) => {
    if (!requireAuth('save')) return
    const wasSaved = (l.savedByUserIds || []).includes(user.id)
    setListings((prev) => prev.map((x) => x.id === l.id ? { ...x, savedByUserIds: wasSaved ? (x.savedByUserIds || []).filter((u) => u !== user.id) : [...(x.savedByUserIds || []), user.id] } : x))
    try {
      await fetch(`/api/marketplace/${l.id}/save`, { method: 'POST', headers: authHeaders() })
    } catch {
      toast.error('Could not save')
    }
  }
  const isSaved = (l) => !!user && (l.savedByUserIds || []).includes(user.id)
  const savedCount = user ? listings.filter((l) => (l.savedByUserIds || []).includes(user.id)).length + myListings.filter((l) => (l.savedByUserIds || []).includes(user.id)).length : 0

  const [quickView, setQuickView] = useState(null)       // listing being previewed
  const [contactOpen, setContactOpen] = useState(false)   // ContactSellerModal visibility
  const openListing = (l) => setQuickView(l)              // Grid card click opens Quick View
  const openFullDetails = (l) => router.push(`/marketplace/${l.id}`)
  const onCreated = (created) => {
    setPostOpen(false)
    toast.success('Listing posted')
    if (created?.id) router.push(`/marketplace/${created.id}`)
    else load()
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader active="marketplace" />

      <main className="container mx-auto px-4 py-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Marketplace</h1>
            <p className="text-sm text-neutral-600">Rescue. Reuse. Recycle. Profit. <span className="ml-1 text-emerald-700">Find incredible items near you and keep them out of the landfill.</span></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {user && (
              <>
                <button
                  onClick={() => router.push('/marketplace/me?tab=saved')}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 text-[13px] font-semibold text-rose-700 hover:bg-rose-50"
                  title="Items you've saved"
                >
                  <Heart className="h-4 w-4" />
                  Saved
                  {savedCount > 0 && <span className="rounded-full bg-rose-100 px-1.5 text-[10px]">{savedCount}</span>}
                </button>
                <button
                  onClick={() => router.push('/marketplace/me')}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50"
                  title="Your listings"
                >
                  <User className="h-4 w-4" />
                  My Listings
                  {myListings.length > 0 && <span className="rounded-full bg-neutral-100 px-1.5 text-[10px]">{myListings.length}</span>}
                </button>
              </>
            )}
            <Button onClick={() => { if (requireAuth('post')) setPostOpen(true) }} className="h-10 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
              <Plus className="mr-1 h-4 w-4" /> Post Item
            </Button>
          </div>
        </div>

        {/* MARKETPLACE INTERNAL SUB-NAV */}
        <Card className="mb-5 border-neutral-200">
          <CardContent className="flex flex-wrap items-center gap-1.5 p-2">
            {[
              { key: 'browse',         label: 'Browse',         filter: () => { setMarketView('residential'); setStatusChip('all');   setCat(''); setPriceBucket('any') } },
              { key: 'free',           label: 'Free',           filter: () => { setMarketView('residential'); setStatusChip('free');  setCat(''); setPriceBucket('free') } },
              { key: 'for_sale',       label: 'For Sale',       filter: () => { setMarketView('residential'); setStatusChip('fixed'); setCat(''); setPriceBucket('any') } },
              { key: 'commercial_b2b', label: 'Commercial B2B', filter: () => { setMarketView('commercial_b2b') } },
              { key: 'on_truck',       label: 'On Truck',       filter: () => { setMarketView('residential'); setStatusChip('on_truck'); setCat('') } },
              { key: 'at_site',        label: 'At Site',        filter: () => { setMarketView('residential'); setStatusChip('at_site');  setCat('') } },
              { key: 'last_chance',    label: 'Last Chance',    filter: () => { setMarketView('residential'); setStatusChip('last_chance'); setCat('') } },
              { key: 'my_listings',    label: 'My Listings',    filter: () => { if (user) router.push('/marketplace?mine=1'); else setSoftLogin('save') } },
            ].map((t) => {
              const isActive =
                (t.key === 'commercial_b2b' && marketView === 'commercial_b2b') ||
                (marketView === 'residential' && (
                  (t.key === 'browse'      && statusChip === 'all') ||
                  (t.key === 'free'        && statusChip === 'free') ||
                  (t.key === 'for_sale'    && statusChip === 'fixed') ||
                  (t.key === 'on_truck'    && statusChip === 'on_truck') ||
                  (t.key === 'at_site'     && statusChip === 'at_site') ||
                  (t.key === 'last_chance' && statusChip === 'last_chance')
                ))
              const isCommercial = t.key === 'commercial_b2b'
              return (
                <button
                  key={t.key}
                  onClick={t.filter}
                  className={`inline-flex min-h-[40px] items-center gap-1 rounded-md px-4 py-2 text-sm font-bold transition ${isActive ? (isCommercial ? 'bg-indigo-600 text-white shadow-sm' : 'bg-brand-600 text-white shadow-sm') : 'text-neutral-700 hover:bg-neutral-100'}`}
                >
                  {isCommercial && <Building2 className={`h-4 w-4 ${isActive ? '' : 'text-indigo-600'}`} />}
                  {t.label}
                </button>
              )
            })}
            <span className="ml-auto hidden text-xs text-neutral-500 md:inline">
              {marketView === 'commercial_b2b' ? 'B2B exchange' : `${listings.length} item${listings.length === 1 ? '' : 's'} shown`}
            </span>
          </CardContent>
        </Card>

        {/* MAIN BODY — switches between residential grid and B2B tab */}
        {marketView === 'commercial_b2b' ? (
          <FeatureLock featureKey="commercialB2B">
            <CommercialB2BTab user={user} />
          </FeatureLock>
        ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr_320px]">
          {/* LEFT FILTER SIDEBAR */}
          <aside className="space-y-4">
            <Card className="border-neutral-200">
              <CardContent className="space-y-4 p-5">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Near me</div>
                  <Button variant="outline" onClick={useMyLocation} className="w-full justify-start">
                    <Crosshair className="mr-2 h-4 w-4 text-brand-600" /> {coordsLabel}
                  </Button>
                  <div className="mt-2">
                    <select
                      value={distancePreset == null ? 'state' : String(distancePreset)}
                      onChange={(e) => setDistancePreset(e.target.value === 'state' ? null : Number(e.target.value))}
                      className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                    >
                      {DISTANCE_PRESETS.map((p) => (
                        <option key={p.label} value={p.value == null ? 'state' : p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>                <Section title="Categories">
                  <FilterRadio name="cat" value="" label="All Categories" current={cat} onChange={setCat} icon={LayoutGrid} />
                  <FilterRadio name="cat" value="free-cat" label="Free" current={cat} onChange={setCat} icon={Heart} disabled hint="(use chip)" />
                  {CATEGORIES.map((c) => (
                    <FilterRadio key={c} name="cat" value={c} label={c} current={cat} onChange={setCat} />
                  ))}
                </Section>
                <Section title="Condition">
                  {CONDITIONS.map((c) => (
                    <label key={c.value} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={condition === c.value} onChange={(e) => setCondition(e.target.checked ? c.value : '')} className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500" />
                      {c.label}
                    </label>
                  ))}
                </Section>
                <Section title="Price">
                  {[
                    { v: 'any',      l: 'Any Price' },
                    { v: 'free',     l: 'Free' },
                    { v: 'under50',  l: 'Under $50' },
                    { v: '50_100',   l: '$50 — $100' },
                    { v: '100_250',  l: '$100 — $250' },
                    { v: '250_plus', l: '$250+' },
                  ].map((b) => (
                    <label key={b.v} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="radio" name="price" checked={priceBucket === b.v} onChange={() => setPriceBucket(b.v)} className="h-4 w-4 border-neutral-300 text-brand-600 focus:ring-brand-500" />
                      {b.l}
                    </label>
                  ))}
                </Section>
              </CardContent>
            </Card>
            <Card className="border-neutral-200 bg-gradient-to-br from-brand-50 to-white">
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center gap-2 text-brand-800"><Bell className="h-4 w-4" /><span className="text-sm font-bold">Get Notified</span></div>
                <p className="text-xs text-neutral-600">Never miss great items near you!</p>
                <Button variant="outline" className="w-full border-brand-300 text-brand-700">Enable Alerts</Button>
              </CardContent>
            </Card>
          </aside>

          {/* CENTER GRID */}
          <section className="space-y-4">
            <Card className="border-neutral-200">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" className="pl-9" />
                  </div>
                  <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
                    {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <div className="flex overflow-hidden rounded-md border border-neutral-300">
                    <button onClick={() => setViewMode('grid')} className={`px-2.5 py-2 ${viewMode === 'grid' ? 'bg-brand-50 text-brand-700' : 'bg-white text-neutral-600'}`}><LayoutGrid className="h-4 w-4" /></button>
                    <button onClick={() => setViewMode('list')} className={`px-2.5 py-2 border-l ${viewMode === 'list' ? 'bg-brand-50 text-brand-700' : 'bg-white text-neutral-600'}`}><ListIcon className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_CHIPS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setStatusChip(c.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${statusChip === c.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>
            ) : listings.length === 0 ? (
              <Card className="border-dashed"><CardContent className="grid place-items-center gap-2 p-10 text-center text-sm text-neutral-500">
                <ShoppingBag className="h-8 w-8 text-neutral-300" />
                <div>No listings match your filters yet.</div>
                <Button onClick={() => { setQ(''); setCat(''); setStatusChip('all'); setCondition(''); setPriceBucket('any') }} variant="outline">Clear filters</Button>
              </CardContent></Card>
            ) : viewMode === 'grid' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((l) => (
                  <ListingCard key={l.id} l={l} onSave={onSave} isSaved={isSaved(l)} onClick={() => openListing(l)} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {listings.map((l) => (
                  <Card key={l.id} onClick={() => openListing(l)} className="cursor-pointer hover:bg-neutral-50">
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                        <ListingThumb photo={l.photos?.[0]} category={l.category} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${statusBadgeStyle(l.itemStatus)}`}>{statusLabel(l.itemStatus)}</span>
                          {l.leavingInMinutes != null && l.leavingInMinutes > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white"><Clock className="h-3 w-3" />Leaving in {l.leavingInMinutes} min</span>
                          )}
                        </div>
                        <div className="line-clamp-1 text-sm font-bold">{l.title}</div>
                        <div className="text-xs text-neutral-500">{l.city} · {timeAgoShort(l.createdAt)}</div>
                      </div>
                      <div className={`shrink-0 text-lg font-extrabold ${l.priceType === 'free' || l.price === 0 ? 'text-emerald-600' : 'text-neutral-900'}`}>{priceLabel(l)}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* RIGHT PANEL */}
          <aside className="space-y-4">
            {user ? (
              <SellerDashboard user={user} myListings={myListings} />
            ) : (
              <Card className="border-neutral-200 bg-gradient-to-br from-brand-50 to-white">
                <CardContent className="space-y-3 p-5 text-sm">
                  <div className="text-base font-extrabold tracking-tight">Sign in to sell or save</div>
                  <p className="text-neutral-700">Post items, message sellers, reserve free pickups, and track your impact.</p>
                  <Link href="/?login=1&returnTo=/marketplace" className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white hover:bg-brand-700">Sign in / Sign up</Link>
                </CardContent>
              </Card>
            )}
            <WhyUsePanel />
          </aside>
        </div>
        )}

        {/* Footer audience bar */}
        <section className="mt-10 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-5 md:grid-cols-4">
          <AudienceBar icon={Truck}            title="For Haulers"  desc="Make extra money, save on dump fees, and build your reputation." />
          <AudienceBar icon={ShoppingBag}      title="For Buyers"   desc="Find amazing items for less and help the planet." />
          <AudienceBar icon={Building2}        title="For Vendors"  desc="Get early access to inventory before it hits the market." />
          <AudienceBar icon={HeartHandshake}   title="For Everyone" desc="Stronger communities through reuse and sustainability." />
        </section>
      </main>

      {/* Floating + on mobile */}
      <button
        onClick={() => { if (requireAuth('post')) setPostOpen(true) }}
        className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl hover:bg-brand-700 md:hidden"
        aria-label="Post Item"
      >
        <Plus className="h-6 w-6" />
      </button>

      <PostItemDialog
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onCreated={onCreated}
        categories={CATEGORIES}
        conditions={CONDITIONS}
        user={user}
      />
      <SoftLoginModal action={softLogin} onClose={() => setSoftLogin(null)} />

      {/* Quick View \u2192 shows on grid card click without leaving the page */}
      <QuickViewModal
        open={!!quickView}
        onOpenChange={(o) => !o && setQuickView(null)}
        listing={quickView}
        viewerIsOwner={!!user && quickView && quickView.sellerId === user.id}
        isSaved={quickView ? isSaved(quickView) : false}
        onSave={(l) => onSave(l)}
        onContactSeller={() => {
          if (!requireAuth('contact_seller')) return
          setContactOpen(true)
        }}
      />

      {/* Contact Seller \u2192 sends email via Gmail SMTP (graceful fallback if not configured) */}
      <ContactSellerModal
        open={contactOpen}
        onOpenChange={setContactOpen}
        listing={quickView}
        user={user}
      />
    </div>
  )
}

// ---------------- Small bits ----------------
function Section({ title, children }) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}
function FilterRadio({ name, value, label, current, onChange, icon: Icon, disabled, hint }) {
  if (disabled) return null
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-neutral-700 hover:bg-neutral-50'}`}
    >
      {Icon && <Icon className="h-4 w-4 text-neutral-400" />}
      <span className="flex-1">{label}</span>
      {active && <span className="text-xs">●</span>}
    </button>
  )
}
function AudienceBar({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-neutral-600">{desc}</div>
      </div>
    </div>
  )
}
