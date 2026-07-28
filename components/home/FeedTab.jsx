'use client'

// Feed tab — the app's default view: welcome banner, Best Option engine,
// Hot Spots banner, and the live community alerts feed with filter chips.
// Extracted from HomeShell.jsx.

import { useEffect, useState } from 'react'
import {
  Sparkles,
  Map as MapIcon,
  Briefcase,
  ChevronRight,
  Flame,
  Bell,
  RefreshCw,
  CreditCard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHotSpots, JOB_CATEGORIES } from '@/components/Jobs'
import { fetchWithTimeout } from '@/components/MapSafety'
import BestOptionCard from '@/components/feed/BestOptionCard'
import AlertRow from '@/components/home/AlertRow'
import { FEED_FILTERS } from '@/constants/facility_constants'

export default function FeedTab({ onFacilityOpen, onJobs, onJobsDialog, onOpenMap }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [userLoc, setUserLoc] = useState(null)
  const [filterKey, setFilterKey] = useState('all')
  const hotSpots = useHotSpots()

  // Capture user location for the Best Option engine
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator?.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setUserLoc({ lat: 37.3382, lng: -121.8863 }), // San Jose fallback
      { timeout: 5000, maximumAge: 60000 },
    )
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const j = await fetchWithTimeout('/api/alerts?recent=true', { timeoutMs: 8000 })
      setAlerts(j.alerts || [])
    } catch {
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      {/* Welcome */}
      <div className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 shrink-0 text-brand-600" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-neutral-900">Welcome to DumpMaps</div>
            <div className="mt-0.5 text-xs text-neutral-600">
              Live community alerts, nearby facilities, and verified jobs — built for haulers in the field. Map view stays available anytime.
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button onClick={onOpenMap} size="sm" variant="outline">
                <MapIcon className="mr-1 h-4 w-4" /> Open Map
              </Button>
              <Button onClick={() => onJobs?.()} size="sm" className="bg-brand-600 hover:bg-brand-700">
                <Briefcase className="mr-1 h-4 w-4" /> Browse jobs
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Best Option Right Now — AI-ranked recommendation engine */}
      <BestOptionCard
        lat={userLoc?.lat}
        lng={userLoc?.lng}
        onOpenFacility={(f) => onFacilityOpen?.(typeof f === 'string' ? f : f?.id)}
      />

      {/* Hot Spots banner */}
      {hotSpots.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
              </span>
              <div className="text-sm font-bold text-red-800">{hotSpots.length} active Hot Spot{hotSpots.length === 1 ? '' : 's'}</div>
            </div>
            <Button size="sm" variant="outline" className="border-red-300 bg-white text-red-700 hover:bg-red-50" onClick={onJobs}>
              View <ChevronRight className="ml-0.5 h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 space-y-1.5">
            {hotSpots.slice(0, 3).map((j) => {
              const cat = JOB_CATEGORIES.find((c) => c.value === j.category)
              return (
                <button
                  key={j.id}
                  onClick={() => onJobsDialog?.('hotspots')}
                  className="flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-xs hover:bg-red-50"
                >
                  <Flame className="h-3.5 w-3.5 shrink-0 text-red-600" />
                  <span className="truncate font-semibold">{j.title}</span>
                  <span className="ml-auto shrink-0 text-neutral-500">
                    {j.city}{j.distanceKm != null ? ` · ${j.distanceKm.toFixed(1)} km` : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Live alerts */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-neutral-900">
            <Bell className="h-4 w-4 text-orange-600" /> Live Community Alerts
          </h2>
          <Button variant="ghost" size="sm" onClick={load} className="h-7 px-2 text-xs">
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
        </div>

        {/* Filter chips — horizontal scroll on mobile */}
        <div className="sticky top-[56px] -mx-3 mb-2 flex gap-1.5 overflow-x-auto border-b border-neutral-100 bg-white/95 px-3 pb-2 pt-1 backdrop-blur scrollbar-thin md:top-[56px]">
          {FEED_FILTERS.map((f) => {
            const Icon = f.icon
            const active = filterKey === f.key
            const count = f.key === 'all' ? alerts.length : alerts.filter(f.match).length
            return (
              <button
                key={f.key}
                onClick={() => setFilterKey(f.key)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-brand-600 text-white shadow-sm' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? '' : 'text-brand-600'}`} />
                {f.label}
                {count > 0 && (
                  <span className={`ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {loading && <div className="p-4 text-sm text-neutral-500">Loading alerts…</div>}
        {!loading && alerts.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No live alerts right now. Tap <span className="font-semibold">+ Post</span> to report a wait time or status.
          </div>
        )}
        {!loading && alerts.length > 0 && (() => {
          const f = FEED_FILTERS.find((x) => x.key === filterKey) || FEED_FILTERS[0]
          const filtered = alerts.filter(f.match).slice(0, 30)
          if (filtered.length === 0) {
            return (
              <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-xs text-neutral-500">
                No alerts match <span className="font-semibold">{f.label}</span> right now.{' '}
                <button onClick={() => setFilterKey('all')} className="font-semibold text-brand-700 underline">Show all</button>
              </div>
            )
          }
          return (
            <div className="space-y-2">
              {filtered.map((a) => (
                <AlertRow key={a.id} alert={a} onFacilityOpen={onFacilityOpen} />
              ))}
            </div>
          )
        })()}
      </section>

      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
        <div className="inline-flex items-center gap-1 font-semibold"><CreditCard className="h-4 w-4" /> Verified job payments — coming soon</div>
        <div className="mt-0.5">Pre-funded jobs and contractor instant payouts launch in the next phase.</div>
      </div>
    </div>
  )
}
