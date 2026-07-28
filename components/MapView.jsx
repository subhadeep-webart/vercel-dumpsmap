'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { Navigation, BadgeCheck, Star, Plus, Minus, Locate, Activity, Heart, Check, Truck, Recycle, Trash2, Cpu, Wrench, Hammer, Sofa, X } from 'lucide-react'

const TYPE_COLORS = {
  Landfill: { bg: '#525252', ring: '#262626' },
  'Transfer Station': { bg: '#737373', ring: '#404040' },
  'Recycling Center': { bg: '#16a34a', ring: '#15803d' },
  'Donation Center': { bg: '#0ea5e9', ring: '#0369a1' },
  'Scrap Yard': { bg: '#f59e0b', ring: '#b45309' },
  'CRV Center': { bg: '#10b981', ring: '#047857' },
  'E-Waste Center': { bg: '#a855f7', ring: '#7e22ce' },
  'Reuse Center': { bg: '#22c55e', ring: '#15803d' },
  'Construction Debris Facility': { bg: '#ea580c', ring: '#9a3412' },
}

const SEVERITY_PIN = {
  bad: { halo: '#ef4444' },
  warn: { halo: '#f59e0b' },
  info: { halo: '#0ea5e9' },
  good: { halo: '#22c55e' },
}

const TYPE_GLYPH_ICONS = {
  Landfill: Trash2,
  'Transfer Station': Truck,
  'Recycling Center': Recycle,
  'Donation Center': Heart,
  'Scrap Yard': Wrench,
  'CRV Center': Recycle,
  'E-Waste Center': Cpu,
  'Reuse Center': Sofa,
  'Construction Debris Facility': Hammer,
}

// Per-alert-type pin badge (chip below the pin)
const ALERT_PIN_BADGE = {
  WAIT_TIME:     { label: 'Long wait',    bg: 'bg-amber-500',  fg: 'text-white' },
  LONG_LINE:     { label: 'Long line',    bg: 'bg-amber-500',  fg: 'text-white' },
  FAST_MOVING:   { label: 'Fast line',    bg: 'bg-brand-600',  fg: 'text-white' },
  CLOSED:        { label: 'Closed',       bg: 'bg-red-600',    fg: 'text-white' },
  NOT_ACCEPTING: { label: 'Not accepting',bg: 'bg-amber-500',  fg: 'text-white' },
  ACCEPTING_NOW: { label: 'Accepting',    bg: 'bg-brand-600',  fg: 'text-white' },
  YARD_FULL:     { label: 'Full',         bg: 'bg-red-600',    fg: 'text-white' },
  SCALE_ISSUE:   { label: 'Scale issue',  bg: 'bg-red-600',    fg: 'text-white' },
  PRICE_UPDATE:  { label: 'Price update', bg: 'bg-sky-500',    fg: 'text-white' },
  DONATION_NEED: { label: 'Needs items',  bg: 'bg-sky-500',    fg: 'text-white' },
  EVENT:         { label: 'Event today',  bg: 'bg-brand-600',  fg: 'text-white' },
  GENERAL_NOTE:  { label: 'Note',         bg: 'bg-neutral-500',fg: 'text-white' },
}

function isRecentActivity(date) {
  if (!date) return false
  return Date.now() - new Date(date).getTime() < 30 * 60 * 1000 // 30 min
}

// Project lat/lng into 0..100 % of the map area given a center and a span
// Larger zoom => smaller span => content appears bigger
function project(lat, lng, center, zoom) {
  // base degree span at zoom=1
  const baseLng = 1.2 // ~ Bay Area width-ish
  const baseLat = 0.9
  const factor = Math.pow(1.55, zoom - 1) // each zoom multiplies "scale"
  const lngSpan = baseLng / factor
  const latSpan = baseLat / factor
  const x = ((lng - (center.lng - lngSpan / 2)) / lngSpan) * 100
  const y = ((center.lat + latSpan / 2 - lat) / latSpan) * 100
  return { x, y }
}

function rand(seed) {
  // simple deterministic-ish hash for animation seeding
  const s = String(seed)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return (h % 1000) / 1000
}

export default function MockMap({
  facilities = [],
  center = { lat: 37.3382, lng: -121.8863 },
  zoom: initialZoom = 4,
  selectedId = null,
  onSelect = () => {},
  onToggleFavorite = null,
  onReport = null,
  favoriteIds = [],
  userLocation = null,
  loading = false,
  error = null,
  className = '',
  compact = false,
}) {
  const [zoom, setZoom] = useState(initialZoom)
  const [mapCenter, setMapCenter] = useState(center)
  const [popupId, setPopupId] = useState(null)

  useEffect(() => {
    if (selectedId) setPopupId(selectedId)
  }, [selectedId])

  useEffect(() => {
    // Recenter to passed-in center if it changes (e.g. Near Me)
    if (center?.lat && center?.lng) setMapCenter(center)
  }, [center?.lat, center?.lng])

  const projected = useMemo(
    () => facilities.map((f) => ({ ...f, _xy: project(f.lat, f.lng, mapCenter, zoom) })),
    [facilities, mapCenter, zoom]
  )

  const userXY = useMemo(
    () => (userLocation ? project(userLocation.lat, userLocation.lng, mapCenter, zoom) : null),
    [userLocation, mapCenter, zoom]
  )

  const popup = projected.find((f) => f.id === popupId)

  // grid lines as "streets" — a few major ones based on zoom
  const gridLines = useMemo(() => {
    const lines = []
    const spacing = Math.max(60 / zoom, 18)
    for (let i = 0; i < 100 / spacing; i++) {
      lines.push({ kind: 'h', pos: i * spacing })
      lines.push({ kind: 'v', pos: i * spacing })
    }
    return lines
  }, [zoom])

  return (
    <div
      className={`relative w-full h-full overflow-hidden rounded-xl bg-[#eef3ef] ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 30%, rgba(34,197,94,0.10), transparent 35%), radial-gradient(circle at 80% 60%, rgba(14,165,233,0.10), transparent 40%), radial-gradient(circle at 50% 90%, rgba(245,158,11,0.08), transparent 40%)',
      }}
    >
      {/* "Streets" grid */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <defs>
          <pattern id="dm-grid" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M 6 0 L 0 0 0 6" fill="none" stroke="rgba(120,130,120,0.10)" strokeWidth="0.15" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#dm-grid)" />
        {/* faux major roads */}
        <g stroke="rgba(180,180,180,0.55)" strokeWidth="0.55" fill="none">
          <path d="M -5 20 Q 30 30 60 22 T 110 18" />
          <path d="M -5 45 Q 25 55 55 50 T 110 55" />
          <path d="M -5 75 Q 30 65 60 78 T 110 72" />
          <path d="M 20 -5 Q 30 30 22 60 T 28 110" />
          <path d="M 55 -5 Q 60 35 50 70 T 58 110" />
          <path d="M 80 -5 Q 75 40 82 70 T 78 110" />
        </g>
        {/* highways */}
        <g stroke="#facc15" strokeWidth="0.5" opacity="0.8" fill="none">
          <path d="M -5 35 Q 50 38 110 42" />
          <path d="M 40 -5 Q 45 50 38 110" />
        </g>
        {/* water/parks */}
        <g fill="rgba(125,211,252,0.30)">
          <ellipse cx="92" cy="12" rx="14" ry="6" />
          <ellipse cx="6" cy="88" rx="12" ry="8" />
        </g>
        <g fill="rgba(134,239,172,0.35)">
          <ellipse cx="15" cy="20" rx="10" ry="6" />
          <ellipse cx="78" cy="82" rx="13" ry="7" />
        </g>
      </svg>

      {/* Labels (neighborhood-ish) */}
      <div className="pointer-events-none absolute inset-0 select-none">
        {[
          { t: 'Downtown San Jose', x: 50, y: 52 },
          { t: 'North San Jose', x: 56, y: 36 },
          { t: 'Milpitas', x: 70, y: 28 },
          { t: 'Santa Clara', x: 36, y: 42 },
          { t: 'Almaden', x: 38, y: 78 },
          { t: 'Bay', x: 88, y: 14 },
        ].map((l) => (
          <div
            key={l.t}
            className="absolute text-[10px] font-semibold uppercase tracking-wider text-neutral-500/80"
            style={{ left: `${l.x}%`, top: `${l.y}%`, transform: 'translate(-50%,-50%)' }}
          >
            {l.t}
          </div>
        ))}
      </div>

      {/* User location dot */}
      {userXY && userXY.x >= -5 && userXY.x <= 105 && userXY.y >= -5 && userXY.y <= 105 && (
        <div
          className="absolute z-10"
          style={{ left: `${userXY.x}%`, top: `${userXY.y}%`, transform: 'translate(-50%,-50%)' }}
        >
          <div className="relative">
            <span className="absolute inset-0 inline-flex h-5 w-5 animate-ping rounded-full bg-blue-400 opacity-60" />
            <span className="relative inline-flex h-5 w-5 rounded-full border-[3px] border-white bg-blue-500 shadow" />
          </div>
        </div>
      )}

      {/* Facility pins */}
      {projected.map((f) => {
        const c = TYPE_COLORS[f.type] || TYPE_COLORS['Recycling Center']
        const isSelected = f.id === popupId || f.id === selectedId
        const inView = f._xy.x > -5 && f._xy.x < 105 && f._xy.y > -5 && f._xy.y < 105
        if (!inView) return null
        const GlyphIcon = TYPE_GLYPH_ICONS[f.type] || Recycle
        const halo = f.topAlertSeverity ? SEVERITY_PIN[f.topAlertSeverity]?.halo : null
        const isAlertSevere = f.topAlertSeverity === 'bad' || f.topAlertSeverity === 'warn'
        const recent = isRecentActivity(f.lastAlertAt)
        const isFavorite = favoriteIds.includes(f.id)
        const top = f.activeAlerts?.[0]
        const isOfficial = !!top?.isOfficial
        const chip = top ? ALERT_PIN_BADGE[top.type] : null
        return (
          <button
            key={f.id}
            onClick={(e) => {
              e.stopPropagation()
              setPopupId(f.id)
              onSelect(f.id)
            }}
            className="group absolute z-20 transition-transform hover:scale-110 focus:outline-none"
            style={{
              left: `${f._xy.x}%`,
              top: `${f._xy.y}%`,
              transform: `translate(-50%, -100%) ${isSelected ? 'scale(1.15)' : ''}`,
            }}
            aria-label={f.name}
          >
            <div className="relative flex flex-col items-center">
              {/* Alert halo */}
              {halo && (
                <>
                  <span
                    className={`absolute inset-0 -m-2 rounded-full ${recent ? 'animate-ping' : isAlertSevere ? 'animate-pulse' : ''}`}
                    style={{ background: halo, opacity: 0.35 }}
                  />
                  <span
                    className="absolute inset-0 -m-1 rounded-full"
                    style={{ boxShadow: `0 0 0 3px ${halo}`, opacity: 0.85 }}
                  />
                </>
              )}
              {/* Owner update purple ring */}
              {isOfficial && (
                <span
                  className="absolute inset-0 -m-1.5 rounded-full"
                  style={{ boxShadow: `0 0 0 3px #9333ea`, opacity: 0.9 }}
                />
              )}
              {isSelected && (
                <span
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full opacity-40 blur-sm"
                  style={{ background: c.bg }}
                />
              )}
              <div
                className={`relative flex items-center justify-center rounded-full text-white shadow-lg ring-2 ring-white ${
                  isSelected ? 'h-10 w-10' : compact ? 'h-7 w-7' : 'h-8 w-8'
                }`}
                style={{ background: c.bg, boxShadow: `0 4px 12px ${c.ring}66` }}
              >
                <GlyphIcon className={isSelected ? 'h-5 w-5' : compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                {f.verified && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-white" title="Verified">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
                {isFavorite && (
                  <span className="absolute -left-1.5 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-white" title="Favorite">
                    <Heart className="h-2 w-2 fill-white" />
                  </span>
                )}
                {f.activeAlertCount > 0 && (
                  <span
                    className="absolute -left-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-bold text-white shadow"
                    style={{ background: halo || '#0ea5e9' }}
                    title={`${f.activeAlertCount} active alerts`}
                  >
                    {f.activeAlertCount}
                  </span>
                )}
              </div>
              {/* Pin stem */}
              <div
                className="h-2 w-1 -mt-0.5"
                style={{
                  background: `linear-gradient(to bottom, ${c.bg}, transparent)`,
                }}
              />
              {/* Alert badge chip below pin */}
              {chip && !compact && (
                <div className={`mt-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide shadow ${chip.bg} ${chip.fg}`}>
                  {chip.label}
                </div>
              )}
            </div>
          </button>
        )
      })}

      {/* Popup card */}
      {popup && !compact && (
        <div
          className="absolute z-30"
          style={{
            left: `${popup._xy.x}%`,
            top: `${popup._xy.y}%`,
            transform: 'translate(-50%, calc(-100% - 48px))',
          }}
        >
          <div className="w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-sm font-bold text-neutral-900">
                  <span className="truncate">{popup.name}</span>
                  {popup.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
                  {favoriteIds.includes(popup.id) && <Heart className="h-3.5 w-3.5 shrink-0 fill-rose-500 text-rose-500" />}
                </div>
                <div className="text-[11px] text-neutral-500">{popup.type}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPopupId(null)
                }}
                className="text-neutral-400 hover:text-neutral-900"
                aria-label="Close popup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Live status panel */}
            {popup.activeAlerts?.[0] ? (
              <div className="mt-2 rounded-md border-2 border-orange-200 bg-orange-50 p-2">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-orange-900">
                    <Activity className="h-3.5 w-3.5" />
                    {popup.activeAlerts[0].label}
                    {popup.activeAlerts[0].isOfficial && (
                      <span className="rounded-sm bg-purple-600 px-1 text-[8px] font-bold uppercase text-white">Official</span>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold text-orange-700">{popup.activeAlertCount} live</span>
                </div>
                {popup.activeAlerts[0].text && (
                  <div className="mt-0.5 line-clamp-1 text-[10px] italic text-orange-800">&ldquo;{popup.activeAlerts[0].text}&rdquo;</div>
                )}
                {(popup.activeAlerts[0].waitMinutes || popup.activeAlerts[0].truckCount) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {popup.activeAlerts[0].waitMinutes && (
                      <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                        ~{popup.activeAlerts[0].waitMinutes} min wait
                      </span>
                    )}
                    {popup.activeAlerts[0].truckCount && (
                      <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                        <Truck className="h-3 w-3" /> ~{popup.activeAlerts[0].truckCount} trucks
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-2 rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-2 py-1 text-center text-[10px] text-neutral-500">
                No live reports · Be the first to post
              </div>
            )}

            <div className="mt-1.5 line-clamp-2 text-[11px] text-neutral-600">{popup.address}</div>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-neutral-600">
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {popup.rating?.toFixed?.(1) || '—'}
              </span>
              <span>· {popup.reviewsCount || 0} reviews</span>
              {popup.distanceKm != null && <span>· {popup.distanceKm.toFixed(1)} km</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(popup.accepted || []).slice(0, 4).map((m) => (
                <span key={m} className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-800">
                  {m}
                </span>
              ))}
              {(popup.accepted || []).length > 4 && (
                <span className="text-[10px] text-neutral-500">+{popup.accepted.length - 4} more</span>
              )}
            </div>

            {/* Action grid: Directions · Post update · Favorite · View details */}
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${popup.lat},${popup.lng}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center gap-1 rounded-md bg-brand-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
              >
                <Navigation className="h-3 w-3" /> Directions
              </a>
              {onReport ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onReport(popup)
                  }}
                  className="flex items-center justify-center gap-1 rounded-md bg-orange-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-orange-700"
                >
                  <Activity className="h-3 w-3" /> Post update
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onSelect(popup.id) }}
                  className="flex items-center justify-center gap-1 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Details
                </button>
              )}
              {onToggleFavorite && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleFavorite(popup.id)
                  }}
                  className={`flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold ${
                    favoriteIds.includes(popup.id)
                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                      : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <Heart className={`h-3 w-3 ${favoriteIds.includes(popup.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                  {favoriteIds.includes(popup.id) ? 'Saved' : 'Save'}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(popup.id)
                }}
                className="flex items-center justify-center rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                View details
              </button>
            </div>
          </div>
          {/* arrow tail */}
          <div className="mx-auto h-3 w-3 -translate-y-1.5 rotate-45 border-b border-r border-neutral-200 bg-white" />
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute right-3 top-3 z-40 flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow">
        <button
          onClick={() => setZoom((z) => Math.min(z + 1, 8))}
          className="flex h-9 w-9 items-center justify-center text-neutral-700 hover:bg-neutral-100"
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
        <div className="h-px bg-neutral-200" />
        <button
          onClick={() => setZoom((z) => Math.max(z - 1, 1))}
          className="flex h-9 w-9 items-center justify-center text-neutral-700 hover:bg-neutral-100"
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      {/* Zoom badge */}
      <div className="absolute bottom-3 left-3 z-40 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-neutral-600 shadow">
        Zoom · {zoom}x
      </div>

      {/* Attribution */}
      <div className="absolute bottom-1 right-2 z-40 text-[9px] text-neutral-500">DumpMaps · mock map</div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            Loading facilities…
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-x-0 top-3 z-50 mx-auto w-fit max-w-[90%] rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 shadow">
          {error}
        </div>
      )}

      {/* Empty hint */}
      {!loading && !error && facilities.length === 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 text-sm font-medium text-neutral-700 shadow">
            No facilities match your filters
          </div>
        </div>
      )}
    </div>
  )
}
