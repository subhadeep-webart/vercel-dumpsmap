'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  MapPin, Search, Locate, Star, Navigation, BadgeCheck, Filter as FilterIcon,
  Plus, Heart, X, ChevronRight, ArrowLeft, Users, Activity, Bell,
  User as UserIcon, Flame,
} from 'lucide-react'
import MapView from '@/components/MapView'
import { AlertPostDialog, LiveFeed, AlertChipRow } from '@/components/AlertSystem'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  MapErrorBoundary,
  MapLoadingState,
  ResponsiveMapLayout,
  SAMPLE_FALLBACK_FACILITIES,
  SAN_JOSE_DEFAULT,
  fetchWithTimeout,
} from '@/components/MapSafety'
import { JobsButton, useHotSpots } from '@/components/Jobs'
import SiteHeader from '@/components/SiteHeader'
import PostOptionRow from '@/components/home/PostOptionRow'
import ActiveFilterChips from '@/components/facilities/ActiveFilterChips'
import { FACILITY_TYPES, MATERIALS, TYPE_ICONS, TYPE_COLORS } from '@/components/home/home-facility-meta'

// Resolve the first usable facility photo across the various fields the API may
// return, rewriting local /uploads/ paths to the /api/files/ route. Mirrors the
// helper in FacilityRow so the map list thumbnails match the feed. Returns null
// when there's no photo, so the card can fall back to the type icon.
function firstPhoto(f) {
  const candidates = [
    f?.imageUrl,
    f?.heroImageUrl,
    f?.photoUrl,
    ...(Array.isArray(f?.photos) ? f.photos : []),
    ...(Array.isArray(f?.images) ? f.images : []),
  ].filter(Boolean)
  const raw = candidates[0]
  if (!raw || typeof raw !== 'string') return null
  if (raw.startsWith('/uploads/')) return `/api/files/${raw.slice('/uploads/'.length)}`
  return raw
}

export default function MapPage({ onExit, onSubmit, openAdmin, userMenu, user, favoriteIds, toggleFavorite, onCommunity, onDashboard, pendingReport, consumePendingReport, pendingJump, consumePendingJump, onJobs, onPostJob, hideHeader = false }) {
  const [facilities, setFacilities] = useState(SAMPLE_FALLBACK_FACILITIES)
  const [loading, setLoading] = useState(true)
  const [usedFallback, setUsedFallback] = useState(false)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [materialFilter, setMaterialFilter] = useState('all')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [freeOnly, setFreeOnly] = useState(false)
  const [paidOnly, setPaidOnly] = useState(false)
  const [donationOnly, setDonationOnly] = useState(false)
  const [contractorOnly, setContractorOnly] = useState(false)
  const [hasAlertsOnly, setHasAlertsOnly] = useState(false)
  const [maxKm, setMaxKm] = useState('any')
  const [userLocation, setUserLocation] = useState(null)
  const [mapCenter, setMapCenter] = useState(SAN_JOSE_DEFAULT)
  const [selectedId, setSelectedId] = useState(null)
  const [feedOpen, setFeedOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState(null) // facility object
  const [refreshKey, setRefreshKey] = useState(0)
  // mobile-only UI state
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [mobileListOpen, setMobileListOpen] = useState(false)
  const [mobileFeedOpen, setMobileFeedOpen] = useState(false)
  const [postFabOpen, setPostFabOpen] = useState(false)

  // Mobile: the map is a 60dvh block near the top of a scrolling page, so
  // tapping a card in the inline list below needs to scroll it back into view.
  const mapSectionRef = useRef(null)

  // hot spots overlay
  const hotSpots = useHotSpots()

  // Mark the document while the map shell is mounted. ResponsiveMapLayout is a
  // fixed 100dvh shell, so without this the global AppFooter stacks below it and
  // overflows the viewport — giving a page-level scrollbar on top of the map's
  // own internal one. See the [data-map-shell] rules in globals.css.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-map-shell', '1')
    return () => root.removeAttribute('data-map-shell')
  }, [])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      if (typeFilter !== 'all') p.set('types', typeFilter)
      if (materialFilter !== 'all') p.set('materials', materialFilter)
      if (verifiedOnly) p.set('verified', 'true')
      if (q) p.set('q', q)
      if (userLocation) {
        p.set('lat', userLocation.lat)
        p.set('lng', userLocation.lng)
        if (maxKm !== 'any') p.set('maxKm', maxKm)
      }
      const j = await fetchWithTimeout(`/api/facilities?${p.toString()}`, { timeoutMs: 8000 })
      let docs = j.facilities || []
      if (freeOnly) docs = docs.filter((f) => f.flags?.freeDropOff)
      if (paidOnly) docs = docs.filter((f) => f.flags?.paidDisposal)
      if (donationOnly) docs = docs.filter((f) => f.flags?.donation)
      if (contractorOnly) docs = docs.filter((f) => f.flags?.contractorFriendly)
      if (hasAlertsOnly) docs = docs.filter((f) => f.activeAlertCount > 0)
      setFacilities(docs)
      setUsedFallback(false)
    } catch (e) {
      console.warn('facilities load failed, using fallback', e?.message || e)
      // In production we don't want to silently swap in seed data; show empty
      // state instead. In preview/dev the seed data keeps the UI demoable.
      const showFallback = typeof window === 'undefined' ? false : !['dumpmaps.org', 'www.dumpmaps.org'].includes(window.location.hostname)
      if (showFallback) {
        setFacilities(SAMPLE_FALLBACK_FACILITIES)
        setUsedFallback(true)
        setError("Showing demo facilities — server unreachable. Tap retry to try again.")
      } else {
        setFacilities([])
        setUsedFallback(false)
        setError("We couldn't reach the facilities server. Tap retry to try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [typeFilter, materialFilter, verifiedOnly, freeOnly, paidOnly, donationOnly, contractorOnly, hasAlertsOnly, maxKm, userLocation, q, refreshKey])

  // Auto-refresh facilities (for activeAlerts) every 30s
  useEffect(() => {
    const t = setInterval(() => setRefreshKey((k) => k + 1), 30000)
    return () => clearInterval(t)
  }, [])

  // Smart defaults based on primary profile (run once per user)
  const [profileApplied, setProfileApplied] = useState(null)
  useEffect(() => {
    if (!user?.primaryProfile || profileApplied === user.primaryProfile) return
    const p = user.primaryProfile
    if (p === 'hauler') {
      setContractorOnly(true)
    } else if (p === 'recycler') {
      // recycler usually visits a specific type — keep type=all but soft-bias by hint
    } else if (p === 'donor') {
      setDonationOnly(true)
    }
    setProfileApplied(p)
  }, [user?.primaryProfile])

  const profileMeta = user?.primaryProfile
    ? {
        hauler: { title: 'Hauler mode', tint: 'bg-orange-100 text-orange-900 border-orange-200', tip: 'Contractor-friendly filter is on. Use Report to share wait times.' },
        recycler: { title: 'Recycler mode', tint: 'bg-brand-100 text-brand-900 border-brand-200', tip: 'Filter to Scrap / CRV / E-Waste below for best matches.' },
        donor: { title: 'Donor mode', tint: 'bg-sky-100 text-sky-900 border-sky-200', tip: 'Showing donation-friendly spots. Check "Needs items" alerts.' },
        facility_owner: { title: 'Owner mode', tint: 'bg-purple-100 text-purple-900 border-purple-200', tip: 'Open your facility to post official updates.' },
        general: { title: 'Standard mode', tint: 'bg-neutral-100 text-neutral-800 border-neutral-200', tip: 'Search, save, and submit updates as you go.' },
      }[user.primaryProfile]
    : null

  const nearMe = () => {
    const sanJose = { lat: 37.3382, lng: -121.8863 }
    if (!navigator.geolocation) {
      setUserLocation(sanJose)
      setMapCenter(sanJose)
      return toast('Centered on San Jose (geolocation unavailable)')
    }
    toast('Locating you…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setMapCenter(loc)
        toast.success('Centered on your location')
      },
      () => {
        setUserLocation(sanJose)
        setMapCenter(sanJose)
        toast('Centered on San Jose / Bay Area')
      },
      { timeout: 5000 }
    )
  }

  const searchCity = async () => {
    if (!q) return
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      const j = await r.json()
      if (j.results?.[0]) {
        const loc = { lat: j.results[0].lat, lng: j.results[0].lng }
        setUserLocation(loc)
        setMapCenter(loc)
        toast.success(`Centered on ${j.results[0].displayName.split(',')[0]}`)
      }
    } catch {}
  }

  const resetFilters = () => {
    setTypeFilter('all'); setMaterialFilter('all'); setMaxKm('any')
    setVerifiedOnly(false); setFreeOnly(false); setPaidOnly(false)
    setDonationOnly(false); setContractorOnly(false); setHasAlertsOnly(false)
  }

  // Active-filter chips — one removable pill per applied filter (shared UX with
  // the feed view). Order matches the filter sheet top-to-bottom.
  const activeChips = [
    typeFilter !== 'all' && { key: 'type', label: `Type: ${typeFilter}`, onRemove: () => setTypeFilter('all') },
    materialFilter !== 'all' && { key: 'material', label: `Material: ${materialFilter}`, onRemove: () => setMaterialFilter('all') },
    maxKm !== 'any' && { key: 'distance', label: `Within ${maxKm} km`, onRemove: () => setMaxKm('any') },
    hasAlertsOnly && { key: 'alerts', label: 'Has live alerts', onRemove: () => setHasAlertsOnly(false) },
    verifiedOnly && { key: 'verified', label: 'Verified only', onRemove: () => setVerifiedOnly(false) },
    freeOnly && { key: 'free', label: 'Free drop-off', onRemove: () => setFreeOnly(false) },
    paidOnly && { key: 'paid', label: 'Paid disposal', onRemove: () => setPaidOnly(false) },
    donationOnly && { key: 'donation', label: 'Donation accepted', onRemove: () => setDonationOnly(false) },
    contractorOnly && { key: 'contractor', label: 'Contractor-friendly', onRemove: () => setContractorOnly(false) },
  ].filter(Boolean)

  const selected = facilities.find((f) => f.id === selectedId)

  // "View details" should take the user to the full facility PAGE
  // (/facilities/:id), not the in-map modal. window.location keeps this working
  // identically whether MapPage is mounted from the homepage or the /facilities
  // route, without threading a router through this shared component.
  const openDetails = (id) => {
    if (!id) return
    if (typeof window !== 'undefined') window.location.href = `/facilities/${id}`
  }

  // Handle deep-links from dashboard
  useEffect(() => {
    if (pendingJump && facilities.length) {
      const f = facilities.find((x) => x.id === pendingJump)
      if (f) {
        setMapCenter({ lat: f.lat, lng: f.lng })
        setSelectedId(pendingJump)
      }
      consumePendingJump?.()
    }
  }, [pendingJump, facilities])

  useEffect(() => {
    if (pendingReport) {
      setReportTarget(pendingReport)
      consumePendingReport?.()
    }
  }, [pendingReport])

  return (
    // When embedded under the shared AppHeader (hideHeader), the map shell must
    // be the viewport height MINUS that header (h-14 = 3.5rem), or its bottom —
    // and the mobile action bar — spills past the viewport. On the homepage the
    // shell owns the full viewport.
    //
    // md:-scoped, because on mobile the shell is h-auto and the page scrolls —
    // pinning it to the viewport there is exactly what made the content below
    // the map unreachable.
    <ResponsiveMapLayout className={hideHeader ? 'md:!h-[calc(100dvh-3.5rem)]' : ''}>
      {/* TOP — premium SiteHeader (consistent with Landing + HomeShell).
          Suppressed when hideHeader is set: the /facilities route already
          renders the shared (app)-section <AppHeader>, and rendering SiteHeader
          on top of it would show two DIFFERENT headers. On the homepage there
          is no AppHeader, so this stays the map's header. */}
      {!hideHeader && (
        <SiteHeader
          user={user}
          onLogin={userMenu.onLogin}
          onRegister={userMenu.onRegister}
          onProfile={userMenu.onProfile}
          onLogout={userMenu.onLogout}
          onAdmin={openAdmin}
          onDashboard={onDashboard}
          onSubmit={onSubmit}
          onEnterApp={(t) => { if (t === 'community') { window.location.href = '/community' } else { onExit?.() } }}
          active="facilities"
        />
      )}

      {/* SECONDARY ROW — map toolbar (search, near me, jobs, live feed toggle) */}
      <div className="z-20 flex flex-none flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-white px-2 py-1.5 md:flex-nowrap md:px-4">
        <button onClick={() => { try { localStorage.setItem('dm_view_mode', 'feed') } catch {}; onExit?.() }} className="flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50" aria-label="Back to feed">
          <ArrowLeft className="h-3.5 w-3.5 text-neutral-500" />
          <span className="hidden sm:inline">Back to Feed</span>
          <span className="sm:hidden">Feed</span>
        </button>
        <Badge variant="outline" className="hidden border-neutral-200 bg-neutral-50 text-[10px] font-bold uppercase tracking-wide text-neutral-500 md:inline-flex">
          Map View · optional
        </Badge>
        {/* order-last + full basis drops the search onto its own row on mobile
            (where the Back / action buttons already fill the first row); from md
            up it returns to the single-row desktop layout. */}
        <div className="order-last flex w-full min-w-0 basis-full items-center gap-2 md:order-none md:w-auto md:flex-1 md:basis-auto md:max-w-2xl">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchCity()}
              placeholder="Search city, address, material…"
              className="h-9 pl-9 text-sm"
            />
          </div>
          <Button onClick={nearMe} variant="outline" size="sm" className="h-9 hidden md:inline-flex">
            <Locate className="mr-1 h-4 w-4" /> Near Me
          </Button>
          <Button onClick={nearMe} variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" aria-label="Near me">
            <Locate className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden md:inline-flex">
            <JobsButton onOpen={() => onJobs?.('feed')} hotSpotCount={hotSpots.length} />
          </div>
          <Button onClick={() => setFeedOpen((v) => !v)} variant={feedOpen ? 'default' : 'outline'} size="sm" className={feedOpen ? 'h-9 hidden bg-orange-600 hover:bg-orange-700 lg:inline-flex' : 'h-9 hidden lg:inline-flex'}>
            <Bell className="mr-1 h-4 w-4" />
            Live Feed
          </Button>
          <Button onClick={onSubmit} className="hidden h-9 bg-brand-600 hover:bg-brand-700 md:inline-flex" size="sm">
            <Plus className="mr-1 h-4 w-4" /> Submit
          </Button>
        </div>
      </div>

      {/* Body.
          mobile — a normal block that grows with its content (map + inline
            facility list), so the PAGE scrolls to reveal what's below the map.
          md+   — the original flex row that fills the shell; min-h-0 is
            required there because a flex-1 child defaults to min-height:auto,
            which would stop the Leaflet canvas from shrinking. */}
      <div className="relative block md:flex md:min-h-0 md:flex-1 md:overflow-hidden">
        {/* Left list panel — filters now live in a modal (opened via the button
            below); the panel shows the facility list + active-filter chips. */}
        <aside className="hidden w-[380px] flex-col border-r border-neutral-200 bg-white md:flex">
          <div className="space-y-3 border-b border-neutral-200 p-4">
            {profileMeta && (
              <div className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${profileMeta.tint}`}>
                <UserIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold">{profileMeta.title}</div>
                  <div className="text-[11px] opacity-80">{profileMeta.tip}</div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileFiltersOpen(true)}
                className="h-9"
              >
                <FilterIcon className="mr-1.5 h-4 w-4 text-brand-600" /> Filters
                {activeChips.length > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                    {activeChips.length}
                  </span>
                )}
              </Button>
              <Badge variant="outline" className="text-xs">
                {facilities.length} results
              </Badge>
            </div>

            <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
          </div>

          {/* Radix ScrollArea's viewport wraps children in an internal
              display:table div that shrink-to-fits and can grow past the
              w-[380px] aside, overflowing the facility cards horizontally.
              Forcing that child to block + w-full pins it to the panel width so
              the cards' own truncate/min-w-0 rules take effect. */}
          <ScrollArea className="flex-1 [&>div>div]:!block [&>div>div]:!w-full">
            <div className="min-w-0 space-y-2 p-3">
              {loading && <div className="p-4 text-sm text-neutral-500">Loading facilities…</div>}
              {!loading && facilities.length === 0 && (
                <div className="p-4 text-sm text-neutral-500">No facilities match your filters.</div>
              )}
              {facilities.map((f) => {
                const Icon = TYPE_ICONS[f.type] || MapPin
                const isActive = selectedId === f.id
                const photo = firstPhoto(f)
                return (
                  <div
                    key={f.id}
                    onClick={() => {
                      // first click highlights pin; second click opens the full
                      // facility page
                      if (selectedId === f.id) openDetails(f.id)
                      else setSelectedId(f.id)
                    }}
                    className={`group w-full cursor-pointer rounded-xl border bg-white p-3 text-left transition hover:border-brand-600 hover:shadow-sm ${
                      isActive ? 'border-brand-600 ring-2 ring-brand-600/30' : 'border-neutral-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md ${TYPE_COLORS[f.type] || 'bg-neutral-200'}`}>
                        {photo ? (
                          <img
                            src={photo}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="truncate font-semibold">{f.name}</div>
                          {f.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" />}
                        </div>
                        <div className="mt-0.5 text-xs text-neutral-500">{f.type}</div>
                        <div className="mt-1 line-clamp-1 text-xs text-neutral-600">{f.address}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {f.rating?.toFixed?.(1) || '—'}
                          </span>
                          <span>· {f.reviewsCount || 0} reviews</span>
                          {f.distanceKm != null && <span>· {f.distanceKm.toFixed(1)} km</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(f.accepted || []).slice(0, 3).map((m) => (
                            <span key={m} className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                              {m}
                            </span>
                          ))}
                          {(f.accepted || []).length > 3 && (
                            <span className="text-[10px] text-neutral-500">+{f.accepted.length - 3}</span>
                          )}
                        </div>
                        <AlertChipRow facility={f} onClick={() => openDetails(f.id)} />
                        {isActive && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openDetails(f.id)
                              }}
                              className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                            >
                              View details
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setReportTarget(f)
                              }}
                              className="min-w-0 flex-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-[11px] font-semibold text-orange-800 hover:bg-orange-100"
                            >
                              <Activity className="mr-1 inline h-3 w-3" />
                              Report
                            </button>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-brand-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
                            >
                              <Navigation className="h-3 w-3" /> Go
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFavorite(f.id)
                              }}
                              className={`flex items-center justify-center rounded-md border px-2 py-1.5 text-[11px] font-semibold ${
                                favoriteIds?.includes(f.id)
                                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                                  : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                              }`}
                              aria-label="Toggle favorite"
                            >
                              <Heart className={`h-3.5 w-3.5 ${favoriteIds?.includes(f.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                            </button>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* Map area — a fixed 60dvh block on mobile (the page scrolls past it),
            growing to fill the shell from md up. min-h-0/min-w-0 let the canvas
            shrink to its column instead of forcing the shell to overflow. */}
        <div ref={mapSectionRef} className="relative h-[60dvh] min-h-0 min-w-0 scroll-mt-14 p-2 md:h-auto md:flex-1 md:p-4">
          <MapErrorBoundary>
            <MapView
              facilities={facilities}
              userLocation={userLocation}
              center={mapCenter}
              zoom={4}
              selectedId={selectedId}
              loading={loading}
              error={error}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
              onReport={(f) => setReportTarget(f)}
              onSelect={(id) => {
                setSelectedId(id)
              }}
              onOpenDetails={openDetails}
            />
          </MapErrorBoundary>
          <MapLoadingState visible={loading && facilities.length === 0} />
          {usedFallback && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full bg-neutral-900/80 px-3 py-1 text-[11px] font-semibold text-white shadow">
              Demo facilities
            </div>
          )}
          {/* Floating mobile actions (right side) */}
          <div className="absolute right-3 top-3 z-40 flex flex-col gap-2 md:hidden">
            <Button onClick={nearMe} size="icon" className="h-11 w-11 bg-white text-neutral-900 shadow hover:bg-neutral-100" aria-label="Near me">
              <Locate className="h-5 w-5" />
            </Button>
            <Button onClick={() => setMobileFiltersOpen(true)} size="icon" className="h-11 w-11 bg-white text-neutral-900 shadow hover:bg-neutral-100" aria-label="Filters">
              <FilterIcon className="h-5 w-5 text-brand-600" />
            </Button>
          </div>
          {/* Hot Spot indicator on map */}
          {hotSpots.length > 0 && (
            <button
              onClick={() => onJobs?.('hotspots')}
              className="absolute left-3 top-3 z-40 flex items-center gap-1.5 rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow active:scale-95"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
              </span>
              {hotSpots.length} Hot Spot{hotSpots.length === 1 ? '' : 's'} nearby
            </button>
          )}
          {/* Desktop hint */}
          <div className="absolute bottom-5 left-1/2 z-30 hidden -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-neutral-600 shadow md:block">
            Tap a pin to see details · Use + / – to zoom
          </div>
        </div>

        {/* ---------------- MOBILE INLINE FACILITY LIST ----------------
            Mobile-only. The map above is a fixed 60dvh block, so this list is
            what the page scrolls to. On md+ the same content lives in the left
            aside, so this is hidden there. Tapping a card centres the map on
            that facility (and scrolls back up to it) rather than navigating —
            a second tap on the highlighted card opens the full page. */}
        {/* pb reserves room for the FIXED bottom action bar (~4rem + safe area),
            which is out of flow and would otherwise cover the last card. */}
        <div className="border-t border-neutral-200 bg-neutral-50 px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-3 md:hidden">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-neutral-900">
              Nearby facilities
            </h2>
            <Badge variant="outline" className="bg-white text-xs">
              {facilities.length} results
            </Badge>
          </div>

          {activeChips.length > 0 && (
            <div className="mb-2">
              <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
            </div>
          )}

          <div className="space-y-2">
            {loading && facilities.length === 0 && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
                Loading facilities…
              </div>
            )}
            {!loading && facilities.length === 0 && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
                No facilities match your filters.
              </div>
            )}
            {facilities.map((f) => {
              const Icon = TYPE_ICONS[f.type] || MapPin
              const isActive = selectedId === f.id
              const photo = firstPhoto(f)
              return (
                <div
                  key={f.id}
                  onClick={() => {
                    if (selectedId === f.id) {
                      openDetails(f.id)
                      return
                    }
                    setSelectedId(f.id)
                    if (typeof f.lat === 'number' && typeof f.lng === 'number') {
                      setMapCenter({ lat: f.lat, lng: f.lng })
                    }
                    // Bring the map back into view so the selected pin is
                    // actually visible after tapping a card further down.
                    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={`cursor-pointer rounded-xl border bg-white p-3 text-left transition active:bg-neutral-50 ${
                    isActive ? 'border-brand-600 ring-2 ring-brand-600/30' : 'border-neutral-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md ${TYPE_COLORS[f.type] || 'bg-neutral-200'}`}>
                      {photo ? (
                        <img
                          src={photo}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="truncate font-semibold">{f.name}</div>
                        {f.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" />}
                      </div>
                      <div className="mt-0.5 text-xs text-neutral-500">{f.type}</div>
                      <div className="mt-1 line-clamp-1 text-xs text-neutral-600">{f.address}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {f.rating?.toFixed?.(1) || '—'}
                        </span>
                        <span>· {f.reviewsCount || 0} reviews</span>
                        {f.distanceKm != null && <span>· {f.distanceKm.toFixed(1)} km</span>}
                        {f.activeAlertCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                            <Flame className="h-3 w-3" /> {f.activeAlertCount} live
                          </span>
                        )}
                      </div>
                      <AlertChipRow facility={f} onClick={() => openDetails(f.id)} />
                      {isActive && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); openDetails(f.id) }}
                            className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-2 text-[11px] font-semibold text-neutral-700 active:bg-neutral-50"
                          >
                            View details
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setReportTarget(f) }}
                            className="min-w-0 flex-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-2 text-[11px] font-semibold text-orange-800 active:bg-orange-100"
                          >
                            <Activity className="mr-1 inline h-3 w-3" />
                            Report
                          </button>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-brand-600 px-2 py-2 text-[11px] font-semibold text-white active:bg-brand-700"
                          >
                            <Navigation className="h-3 w-3" /> Go
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(f.id) }}
                            className={`flex items-center justify-center rounded-md border px-2.5 py-2 text-[11px] font-semibold ${
                              favoriteIds?.includes(f.id)
                                ? 'border-rose-300 bg-rose-50 text-rose-700'
                                : 'border-neutral-200 text-neutral-700 active:bg-neutral-50'
                            }`}
                            aria-label="Toggle favorite"
                          >
                            <Heart className={`h-3.5 w-3.5 ${favoriteIds?.includes(f.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                          </button>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Live Feed sidebar (right) */}
        {feedOpen && (
          <aside className="hidden w-[340px] shrink-0 border-l border-neutral-200 bg-white lg:flex lg:flex-col">
            <LiveFeed
              refreshKey={refreshKey}
              onJump={(facilityId) => {
                const f = facilities.find((x) => x.id === facilityId)
                if (f) {
                  setMapCenter({ lat: f.lat, lng: f.lng })
                  setSelectedId(facilityId)
                }
              }}
            />
          </aside>
        )}

        {/* Alert post dialog */}
        <AlertPostDialog
          open={!!reportTarget}
          onOpenChange={(v) => { if (!v) setReportTarget(null) }}
          facility={reportTarget}
          onPosted={() => setRefreshKey((k) => k + 1)}
        />
      </div>

      {/* ---------------- MOBILE BOTTOM ACTION BAR ----------------
          `fixed` so it's pinned to the viewport bottom at every scroll
          position. Being fixed takes it out of flow, so the scrolling content
          above reserves space for it via the pb-[…] on the inline facility
          list — otherwise the last card sits underneath the bar. */}
      <div className="fixed inset-x-0 bottom-0 z-30 grid flex-none grid-cols-5 items-stretch gap-1 border-t border-neutral-200 bg-white px-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 shadow-[0_-1px_3px_rgba(0,0,0,0.06)] md:hidden">
        <button
          onClick={() => setMobileListOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[10px] font-semibold text-neutral-700 active:bg-neutral-100"
          aria-label="Map list"
        >
          <MapPin className="h-5 w-5 text-brand-600" />
          Map
        </button>
        <button
          onClick={() => onJobs?.('feed')}
          className="relative flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[10px] font-semibold text-neutral-700 active:bg-neutral-100"
          aria-label="Jobs"
        >
          <Activity className="h-5 w-5 text-brand-600" />
          Jobs
          {hotSpots.length > 0 && (
            <span className="absolute right-3 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
              {hotSpots.length}
            </span>
          )}
        </button>
        {/* center FAB-ish post button */}
        <button
          onClick={() => setPostFabOpen(true)}
          className="flex flex-col items-center justify-center"
          aria-label="Post"
        >
          <span className="-mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-md shadow-brand-600/30 active:scale-95">
            <Plus className="h-6 w-6" />
          </span>
          <span className="-mt-0.5 text-[10px] font-semibold text-neutral-700">Post</span>
        </button>
        <button
          onClick={() => setMobileFeedOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[10px] font-semibold text-neutral-700 active:bg-neutral-100"
          aria-label="Alerts"
        >
          <Bell className="h-5 w-5 text-orange-600" />
          Alerts
        </button>
        <button
          onClick={() => { if (user) userMenu.onProfile?.(); else userMenu.onLogin?.() }}
          className="flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[10px] font-semibold text-neutral-700 active:bg-neutral-100"
          aria-label="Profile"
        >
          <UserIcon className="h-5 w-5 text-neutral-600" />
          {user ? 'Profile' : 'Log in'}
        </button>
      </div>

      {/* ---------------- POST OPTIONS SHEET (controlled) ---------------- */}
      <Sheet open={postFabOpen} onOpenChange={setPostFabOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-6">
          <SheetHeader className="text-left">
            <SheetTitle>What do you want to post?</SheetTitle>
            <SheetDescription className="text-xs">Pick one — you can always add more later.</SheetDescription>
          </SheetHeader>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <PostOptionRow icon={Activity} color="text-red-600" title="Post Job / Hot Spot" desc="Hire a verified contractor for cleanup, hauling, or pickup" onClick={() => { setPostFabOpen(false); onPostJob?.() }} />
            <PostOptionRow icon={Bell} color="text-orange-600" title="Post Facility Alert" desc="Wait times, closures, accepting now, donation needs" onClick={() => {
              setPostFabOpen(false)
              if (facilities[0]) setReportTarget(facilities[0])
              else toast('Tap a facility pin to post an alert')
            }} />
            <PostOptionRow icon={MapPin} color="text-brand-600" title="Submit a Facility" desc="Add a recycling/donation/transfer station to the map" onClick={() => { setPostFabOpen(false); onSubmit?.() }} />
            <PostOptionRow icon={Users} color="text-sky-600" title="Community Update" desc="Coming soon — community posts, tips, and finds" onClick={() => { setPostFabOpen(false); onCommunity?.('community') }} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ---------------- FILTERS SHEET (desktop + mobile) ----------------
          Opened from the "Filters" button in the left panel (desktop) and the
          floating filter button (mobile). Full-width bottom sheet on mobile;
          on desktop it lifts into a centered, fully-rounded floating card so it
          reads as a modal over the map rather than a wall-to-wall bar. */}
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4 md:inset-x-auto md:bottom-6 md:left-1/2 md:max-w-lg md:-translate-x-1/2 md:rounded-2xl md:border md:shadow-2xl"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 pr-8">
              <FilterIcon className="h-4 w-4 text-brand-600" /> Filters
              <Badge variant="outline" className="ml-auto text-xs">{facilities.length} results</Badge>
            </SheetTitle>
            <SheetDescription className="text-xs">Refine by type, material, distance, and tags.</SheetDescription>
          </SheetHeader>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Facility type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {FACILITY_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Material</Label>
                <Select value={materialFilter} onValueChange={setMaterialFilter}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All materials</SelectItem>
                    {MATERIALS.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Distance from me</Label>
              <Select value={maxKm} onValueChange={setMaxKm}>
                <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any distance</SelectItem>
                  <SelectItem value="5">Within 5 km</SelectItem>
                  <SelectItem value="10">Within 10 km</SelectItem>
                  <SelectItem value="25">Within 25 km</SelectItem>
                  <SelectItem value="50">Within 50 km</SelectItem>
                  <SelectItem value="100">Within 100 km</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'alerts', label: 'Has live alerts', Icon: Flame, val: hasAlertsOnly, set: setHasAlertsOnly },
                { id: 'verified', label: 'Verified only', val: verifiedOnly, set: setVerifiedOnly },
                { id: 'free', label: 'Free drop-off', val: freeOnly, set: setFreeOnly },
                { id: 'paid', label: 'Paid disposal', val: paidOnly, set: setPaidOnly },
                { id: 'donation', label: 'Donation accepted', val: donationOnly, set: setDonationOnly },
                { id: 'contractor', label: 'Contractor-friendly', val: contractorOnly, set: setContractorOnly },
              ].map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 px-3 py-2.5 text-sm active:bg-neutral-50">
                  <Checkbox checked={c.val} onCheckedChange={(v) => c.set(!!v)} />
                  <span className="inline-flex items-center gap-1">{c.Icon && <c.Icon className="h-3.5 w-3.5 text-orange-500" />} {c.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={resetFilters}
              >
                Reset
              </Button>
              <Button className="flex-1 h-11 bg-brand-600 hover:bg-brand-700" onClick={() => setMobileFiltersOpen(false)}>
                Show {facilities.length} results
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ---------------- MOBILE FACILITY LIST SHEET (Bottom Drawer) ---------------- */}
      <Sheet open={mobileListOpen} onOpenChange={setMobileListOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-hidden rounded-t-2xl p-0">
          <SheetHeader className="border-b border-neutral-200 p-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-600" />
              Nearby facilities
              <Badge variant="outline" className="ml-auto text-xs">{facilities.length}</Badge>
            </SheetTitle>
          </SheetHeader>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
            {loading && <div className="p-4 text-sm text-neutral-500">Loading facilities…</div>}
            {!loading && facilities.length === 0 && (
              <div className="p-4 text-sm text-neutral-500">No facilities match your filters.</div>
            )}
            {facilities.map((f) => {
              const Icon = TYPE_ICONS[f.type] || MapPin
              const photo = firstPhoto(f)
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setMobileListOpen(false)
                    openDetails(f.id)
                  }}
                  className="flex w-full items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left active:bg-neutral-50"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md ${TYPE_COLORS[f.type] || 'bg-neutral-200'}`}>
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="truncate font-semibold">{f.name}</div>
                      {f.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" />}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">{f.type}</div>
                    <div className="mt-1 line-clamp-1 text-xs text-neutral-600">{f.address}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {f.rating?.toFixed?.(1) || '—'}
                      </span>
                      <span>· {f.reviewsCount || 0} reviews</span>
                      {f.distanceKm != null && <span>· {f.distanceKm.toFixed(1)} km</span>}
                      {f.activeAlertCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700"><Flame className="h-3 w-3" /> {f.activeAlertCount} live</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                </button>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* ---------------- MOBILE LIVE FEED SHEET ---------------- */}
      <Sheet open={mobileFeedOpen} onOpenChange={setMobileFeedOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-hidden rounded-t-2xl p-0">
          <SheetHeader className="border-b border-neutral-200 p-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-orange-600" /> Live Feed
            </SheetTitle>
            <SheetDescription className="text-xs">Real-time alerts from the community.</SheetDescription>
          </SheetHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            <LiveFeed
              refreshKey={refreshKey}
              onJump={(facilityId) => {
                const f = facilities.find((x) => x.id === facilityId)
                if (f) {
                  setMapCenter({ lat: f.lat, lng: f.lng })
                  setSelectedId(facilityId)
                  setMobileFeedOpen(false)
                }
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </ResponsiveMapLayout>
  )
}
