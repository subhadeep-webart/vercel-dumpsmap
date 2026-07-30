'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  authHeaders, CONDITIONS, DISTANCE_PRESETS, PRICE_BUCKETS, SORTS, STATUS_CHIPS,
} from '@/constants/marketplace_constants'

// ---------------------------------------------------------------------------
// Container hook for the Marketplace page. Owns every piece of state and all
// data-fetching / mutation logic so the page + presentational components stay
// thin. Returns a flat bag of state + handlers consumed by the page.
// ---------------------------------------------------------------------------
export function useMarketplace() {
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

  // Tab dimension. 'residential' shows the existing marketplace; 'commercial_b2b'
  // swaps in the CommercialB2BTab component.
  const [marketView, setMarketView] = useState('residential')

  // Quick View + contact seller modal state.
  const [quickView, setQuickView] = useState(null)        // listing being previewed
  const [contactOpen, setContactOpen] = useState(false)   // ContactSellerModal visibility

  // Honor ?tab=commercial_b2b so external links (and the AppHeader) can
  // deep-link straight to the B2B tab.
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

  const openListing = (l) => setQuickView(l)             // Grid card click opens Quick View
  const onCreated = (created) => {
    setPostOpen(false)
    toast.success('Listing posted')
    if (created?.id) router.push(`/marketplace/${created.id}`)
    else load()
  }

  const clearFilters = () => { setQ(''); setCat(''); setStatusChip('all'); setCondition(''); setPriceBucket('any') }

  // Active-filter chips — one removable pill per applied filter, mirroring the
  // facilities directory UX so applied filters are visible at a glance.
  const conditionLabel = CONDITIONS.find((c) => c.value === condition)?.label
  const priceBucketLabel = PRICE_BUCKETS.find((b) => b.v === priceBucket)?.l
  const statusChipLabel = STATUS_CHIPS.find((c) => c.value === statusChip)?.label
  const distanceLabel = DISTANCE_PRESETS.find((p) => p.value === distancePreset)?.label
  const activeChips = [
    q && { key: 'q', label: `Search: ${q}`, onRemove: () => setQ('') },
    cat && { key: 'cat', label: `Category: ${cat}`, onRemove: () => setCat('') },
    statusChip !== 'all' && { key: 'status', label: statusChipLabel, onRemove: () => setStatusChip('all') },
    condition && { key: 'condition', label: `Condition: ${conditionLabel}`, onRemove: () => setCondition('') },
    priceBucket !== 'any' && { key: 'price', label: `Price: ${priceBucketLabel}`, onRemove: () => setPriceBucket('any') },
    // Distance only actually filters results once a location is set.
    coords && distancePreset != null && { key: 'distance', label: `Within ${distanceLabel}`, onRemove: () => setDistancePreset(null) },
  ].filter(Boolean)

  const sortLabel = SORTS.find((s) => s.value === sort)?.label

  // Sub-nav tab definitions. Each `filter` sets the state needed to show that
  // slice; kept here (not in the presenter) since they mutate container state.
  const subNavTabs = [
    { key: 'browse',         label: 'Browse',         filter: () => { setMarketView('residential'); setStatusChip('all');   setCat(''); setPriceBucket('any') } },
    { key: 'free',           label: 'Free',           filter: () => { setMarketView('residential'); setStatusChip('free');  setCat(''); setPriceBucket('free') } },
    { key: 'for_sale',       label: 'For Sale',       filter: () => { setMarketView('residential'); setStatusChip('fixed'); setCat(''); setPriceBucket('any') } },
    { key: 'commercial_b2b', label: 'Commercial B2B', filter: () => { setMarketView('commercial_b2b') } },
    { key: 'on_truck',       label: 'On Truck',       filter: () => { setMarketView('residential'); setStatusChip('on_truck'); setCat('') } },
    { key: 'at_site',        label: 'At Site',        filter: () => { setMarketView('residential'); setStatusChip('at_site');  setCat('') } },
    { key: 'last_chance',    label: 'Last Chance',    filter: () => { setMarketView('residential'); setStatusChip('last_chance'); setCat('') } },
    { key: 'my_listings',    label: 'My Listings',    filter: () => { if (user) router.push('/marketplace?mine=1'); else setSoftLogin('save') } },
  ]

  return {
    router,
    // core data
    user, listings, myListings, loading,
    // filters
    q, setQ, cat, setCat, statusChip, setStatusChip, condition, setCondition,
    priceBucket, setPriceBucket, distancePreset, setDistancePreset,
    coordsLabel, sort, setSort, viewMode, setViewMode,
    // views + modals
    marketView, setMarketView, postOpen, setPostOpen,
    softLogin, setSoftLogin, quickView, setQuickView, contactOpen, setContactOpen,
    // derived
    savedCount, subNavTabs, activeChips, sortLabel,
    // actions
    requireAuth, useMyLocation, onSave, isSaved, openListing, onCreated, clearFilters,
  }
}
