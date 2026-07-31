'use client'

import { Component, useEffect, useState, useRef } from 'react'
import { AlertTriangle, RefreshCw, MapPin } from 'lucide-react'

// ------- Safe sample fallback facilities (Bay Area, used if API fails) -------
export const SAMPLE_FALLBACK_FACILITIES = [
  { id: 'fb-1', name: 'Mission Trail Waste Systems', type: 'Transfer Station', address: '1080 Walsh Ave, Santa Clara, CA', lat: 37.3791, lng: -121.9758, rating: 4.2, reviewsCount: 47, verified: true, accepted: ['Construction debris', 'Wood', 'Concrete'], activeAlerts: [], activeAlertCount: 0 },
  { id: 'fb-2', name: 'Zanker Recycling', type: 'Construction Debris Facility', address: '675 Los Esteros Rd, San Jose, CA', lat: 37.4391, lng: -121.9410, rating: 4.5, reviewsCount: 132, verified: true, accepted: ['Construction debris', 'Concrete', 'Wood'], activeAlerts: [], activeAlertCount: 0 },
  { id: 'fb-3', name: 'GreenWaste of San Jose', type: 'Recycling Center', address: '625 Charles St, San Jose, CA', lat: 37.3508, lng: -121.9079, rating: 4.3, reviewsCount: 89, verified: true, accepted: ['Cardboard', 'Metal', 'E-waste'], activeAlerts: [], activeAlertCount: 0 },
  { id: 'fb-4', name: 'Second Harvest Donation Drop-Off', type: 'Donation Center', address: '4001 N 1st St, San Jose, CA', lat: 37.4099, lng: -121.9462, rating: 4.8, reviewsCount: 203, verified: true, accepted: ['Household goods', 'Clothing'], activeAlerts: [], activeAlertCount: 0 },
  { id: 'fb-5', name: 'Sims Metal Management - San Jose', type: 'Scrap Yard', address: '1602 Old Bayshore Hwy, San Jose, CA', lat: 37.3673, lng: -121.9032, rating: 4.1, reviewsCount: 76, verified: true, accepted: ['Metal', 'Copper', 'Aluminum'], activeAlerts: [], activeAlertCount: 0 },
  { id: 'fb-6', name: 'Goodwill Donation Center - San Jose', type: 'Donation Center', address: '1080 N 7th St, San Jose, CA', lat: 37.3540, lng: -121.8967, rating: 4.6, reviewsCount: 311, verified: true, accepted: ['Furniture', 'Clothing'], activeAlerts: [], activeAlertCount: 0 },
  { id: 'fb-7', name: 'Recology South Bay', type: 'Recycling Center', address: '1601 Dixon Landing Rd, Milpitas, CA', lat: 37.4596, lng: -121.9123, rating: 4.4, reviewsCount: 154, verified: true, accepted: ['Cardboard', 'Metal', 'Mattresses'], activeAlerts: [], activeAlertCount: 0 },
  { id: 'fb-8', name: 'Guadalupe Recycling & Disposal', type: 'Landfill', address: '15999 Guadalupe Mines Rd, San Jose, CA', lat: 37.2056, lng: -121.8967, rating: 3.9, reviewsCount: 68, verified: true, accepted: ['Construction debris', 'Dirt', 'Mattresses'], activeAlerts: [], activeAlertCount: 0 },
]

export const SAN_JOSE_DEFAULT = { lat: 37.3382, lng: -121.8863 }

// ---------- Map Loading State (auto-hides after 2s no matter what) ----------
export function MapLoadingState({ visible }) {
  if (!visible) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
      <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        Loading map…
      </div>
    </div>
  )
}

// ---------- Map Error Boundary ----------
export class MapErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('Map crashed:', error, info)
  }
  reset = () => this.setState({ hasError: false, error: null })
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl bg-neutral-50 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <div>
            <div className="font-bold text-neutral-900">Map couldn&apos;t load</div>
            <div className="mt-1 text-xs text-neutral-600">
              Don&apos;t worry — your facility list, search and filters still work below.
            </div>
          </div>
          <button onClick={this.reset} className="flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
            <RefreshCw className="h-3 w-3" /> Retry map
          </button>
        </div>
      )
    }
    return this.props.children
  }
}


// ---------- Mock fallback map (used when real MapView crashes) ----------
export function MockFallbackMap({ facilities = SAMPLE_FALLBACK_FACILITIES, onSelect = () => {} }) {
  const list = facilities.length ? facilities : SAMPLE_FALLBACK_FACILITIES
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-gradient-to-br from-brand-50 via-white to-sky-50">
      {/* Decorative grid */}
      <svg className="absolute inset-0 h-full w-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#cbd5e1" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 shadow">
        Offline map · sample pins
      </div>
      <div className="grid h-full grid-cols-2 gap-2 overflow-auto p-3 sm:grid-cols-3 md:grid-cols-4">
        {list.slice(0, 12).map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className="flex flex-col items-start gap-1 rounded-lg border border-neutral-200 bg-white/90 p-2 text-left text-xs shadow-sm hover:border-brand-600"
          >
            <div className="flex items-center gap-1.5 text-brand-700">
              <MapPin className="h-3.5 w-3.5" />
              <span className="line-clamp-1 font-semibold text-neutral-900">{f.name}</span>
            </div>
            <div className="line-clamp-1 text-[10px] text-neutral-500">{f.type}</div>
            <div className="line-clamp-1 text-[10px] text-neutral-500">{f.address}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- useFetchWithFallback: ensures the app never hangs on Loading ----------
// Auto-times-out the fetch after `timeoutMs` and returns fallback data so UI
// always renders. Caller can detect `usedFallback`.
export function useFetchWithFallback(url, { timeoutMs = 8000, fallback = SAMPLE_FALLBACK_FACILITIES, deps = [], enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [usedFallback, setUsedFallback] = useState(false)
  const [error, setError] = useState(null)
  const ctrlRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setLoading(true)
    setUsedFallback(false)
    setError(null)
    const timer = setTimeout(() => ctrl.abort('timeout'), timeoutMs)
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((j) => {
        if (cancelled) return
        setData(j)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        console.warn('[useFetchWithFallback]', url, e?.message || e)
        setData({ fallback: true, items: fallback })
        setUsedFallback(true)
        setError(e?.message || String(e))
        setLoading(false)
      })
      .finally(() => clearTimeout(timer))
    return () => {
      cancelled = true
      clearTimeout(timer)
      ctrl.abort('cleanup')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, usedFallback, error }
}

// ---------- Promise-with-timeout helper for any fetch ----------
// Usage:
//   const facilities = await fetchWithTimeout('/api/facilities', { timeoutMs: 7000 }).catch(() => SAMPLE_FALLBACK_FACILITIES)
export async function fetchWithTimeout(url, { timeoutMs = 7000, ...opts } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort('timeout'), timeoutMs)
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal })
    if (!r.ok) throw new Error('http ' + r.status)
    return await r.json()
  } finally {
    clearTimeout(timer)
  }
}

// ---------- ResponsiveMapLayout: standardises full-height, no-overflow shell ----------
// Use as the outermost wrapper of the map screen so children can use flex-1 safely.
// Height is responsive by design:
//   • mobile (<md) — `h-auto`, so the shell grows to fit its content and the
//     PAGE scrolls. The map itself is a fixed 60dvh block inside; everything
//     below it (action bar, facility list) is reached by normal page scrolling.
//     Freezing the shell to the viewport here is what previously made the
//     content below the map unreachable — the Leaflet canvas ate every touch.
//   • md+ — `h-[100dvh]`, the original app-like shell that owns the viewport
//     and manages its own internal scroll panes. Unchanged.
// `min-h-0` avoids the flex `min-height:auto` floor when embedded under a
// header (/facilities passes md:h-[calc(100dvh-3.5rem)]).
export function ResponsiveMapLayout({ children, className = '' }) {
  return (
    <div
      data-map-shell-root
      className={`flex h-auto min-h-0 w-full max-w-[100vw] flex-col overflow-x-hidden bg-white md:h-[100dvh] md:overflow-hidden ${className}`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </div>
  )
}
