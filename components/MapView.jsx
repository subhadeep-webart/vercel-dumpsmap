'use client'

// MapView — REAL interactive Leaflet map (OpenStreetMap) of facilities.
//
// Replaces the earlier hand-drawn "mock map". This is a true pan/zoom map with
// real tiles and real geographic pin positions, matching the client's Google-
// Maps / Waze comparison. It keeps the SAME props interface the mock exposed so
// MapPage (its only caller) works unchanged:
//   facilities, center, zoom, selectedId, onSelect, onToggleFavorite, onReport,
//   favoriteIds, userLocation, loading, error, className, compact
//
// Waze-style condition coloring: each pin's BODY color reflects the facility's
// live condition — 🟢 free / 🟡 moderate / 🔴 busy — derived from `liveStatus`
// (mirrored by the Activity Hub) or, as a fallback, `topAlertSeverity`. A pin
// with no live signal keeps its facility-TYPE color. The type glyph always
// shows inside the pin so you can still tell what kind of facility it is.
//
// Leaflet touches `window`, so leaflet itself is imported dynamically inside an
// effect (never on the server). This component is 'use client' and its single
// caller (MapPage) is client-only too.

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

// ---- Facility-type colors (fallback when there's no live condition) ---------
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

// Emoji glyph per facility type (rendered inside the divIcon — no icon font
// needed, keeps the pin self-contained HTML).
const TYPE_GLYPH = {
  Landfill: '🗑️',
  'Transfer Station': '🚚',
  'Recycling Center': '♻️',
  'Donation Center': '❤️',
  'Scrap Yard': '🔧',
  'CRV Center': '♻️',
  'E-Waste Center': '💻',
  'Reuse Center': '🛋️',
  'Construction Debris Facility': '🔨',
}

// ---- Waze-style live-condition colors for the pin BODY ----------------------
const CONDITION_COLORS = {
  busy:     { bg: '#dc2626', ring: '#991b1b', label: 'Busy' },
  moderate: { bg: '#f59e0b', ring: '#b45309', label: 'Moderate' },
  free:     { bg: '#16a34a', ring: '#15803d', label: 'Free' },
}

// facility.liveStatus (see FACILITY_LIVE_SIGNALS in activityHub.js) → bucket
const LIVE_STATUS_CONDITION = {
  very_busy: 'busy',
  busy: 'busy',
  long_wait: 'busy',
  closed: 'busy',
  gate_closed: 'busy',
  not_accepting: 'busy',
  scale_issue: 'busy',
  safety_alert: 'busy',
  slow: 'moderate',
  price_update: 'moderate',
  not_busy: 'free',
  accepting: 'free',
}

// topAlertSeverity → bucket (fallback when liveStatus is absent)
const SEVERITY_CONDITION = { bad: 'busy', warn: 'moderate', good: 'free' }

// Resolve a facility's live condition bucket ('busy'|'moderate'|'free') or null.
function facilityCondition(f) {
  if (f?.liveStatus && LIVE_STATUS_CONDITION[f.liveStatus]) return LIVE_STATUS_CONDITION[f.liveStatus]
  if (f?.topAlertSeverity && SEVERITY_CONDITION[f.topAlertSeverity]) return SEVERITY_CONDITION[f.topAlertSeverity]
  return null
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Build the HTML for a facility divIcon: colored teardrop + glyph + optional
// verified check, favorite heart, alert-count badge, and a condition/alert chip.
function markerHtml(f, { isFavorite, isSelected }) {
  const condition = facilityCondition(f)
  const c = condition ? CONDITION_COLORS[condition] : (TYPE_COLORS[f.type] || TYPE_COLORS['Recycling Center'])
  const glyph = TYPE_GLYPH[f.type] || '♻️'
  const size = isSelected ? 40 : 32
  const chipLabel = condition ? CONDITION_COLORS[condition].label : ''
  const chip = chipLabel
    ? `<div style="margin-top:2px;white-space:nowrap;border-radius:9999px;padding:1px 6px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#fff;background:${c.bg};box-shadow:0 1px 3px rgba(0,0,0,.3)">${escapeHtml(chipLabel)}</div>`
    : ''
  const verified = f.verified
    ? `<span style="position:absolute;right:-4px;top:-4px;display:flex;height:16px;width:16px;align-items:center;justify-content:center;border-radius:9999px;border:2px solid #fff;background:#0B4DBA;color:#fff;font-size:10px;font-weight:900">✓</span>`
    : ''
  const fav = isFavorite
    ? `<span style="position:absolute;left:-6px;bottom:-2px;display:flex;height:16px;width:16px;align-items:center;justify-content:center;border-radius:9999px;border:2px solid #fff;background:#f43f5e;color:#fff;font-size:9px">♥</span>`
    : ''
  const alertBadge = f.activeAlertCount > 0
    ? `<span style="position:absolute;left:-8px;top:-8px;display:flex;height:18px;min-width:18px;align-items:center;justify-content:center;border-radius:9999px;border:2px solid #fff;padding:0 4px;font-size:10px;font-weight:800;color:#fff;background:${c.bg};box-shadow:0 1px 3px rgba(0,0,0,.3)">${f.activeAlertCount}</span>`
    : ''
  return `
    <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-100%)">
      <div style="position:relative;display:flex;align-items:center;justify-content:center;height:${size}px;width:${size}px;border-radius:9999px;background:${c.bg};color:#fff;font-size:${isSelected ? 18 : 15}px;box-shadow:0 4px 12px ${c.ring}88;border:2px solid #fff">
        <span>${glyph}</span>
        ${verified}${fav}${alertBadge}
      </div>
      <div style="height:8px;width:3px;margin-top:-1px;background:linear-gradient(to bottom, ${c.bg}, transparent)"></div>
      ${chip}
    </div>`
}

// Build the HTML for a facility's Leaflet popup card. Buttons carry data-*
// attributes; a single delegated click handler on the map container dispatches
// them to the React callbacks (onSelect / onReport / onToggleFavorite).
function popupHtml(f, { isFavorite }) {
  const condition = facilityCondition(f)
  const top = f.activeAlerts?.[0]
  const accepted = (f.accepted || []).slice(0, 4)
  const statusPanel = top
    ? `<div style="margin-top:8px;border-radius:8px;border:2px solid #fed7aa;background:#fff7ed;padding:8px">
         <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
           <div style="font-size:11px;font-weight:800;color:#7c2d12">⚡ ${escapeHtml(top.label || top.type || 'Live update')}</div>
           <span style="font-size:9px;font-weight:700;color:#c2410c">${f.activeAlertCount || 1} live</span>
         </div>
         ${top.text ? `<div style="margin-top:2px;font-size:10px;font-style:italic;color:#9a3412">“${escapeHtml(top.text)}”</div>` : ''}
         ${top.waitMinutes ? `<div style="margin-top:4px"><span style="border-radius:4px;background:#fff;padding:2px 6px;font-size:10px;font-weight:800;color:#78350f">~${escapeHtml(top.waitMinutes)} min wait</span></div>` : ''}
       </div>`
    : condition
      ? `<div style="margin-top:8px;border-radius:8px;padding:6px 8px;text-align:center;font-size:11px;font-weight:800;color:#fff;background:${CONDITION_COLORS[condition].bg}">${CONDITION_COLORS[condition].label} right now</div>`
      : `<div style="margin-top:8px;border-radius:8px;border:1px dashed #e5e5e5;background:#fafafa;padding:4px 8px;text-align:center;font-size:10px;color:#737373">No live reports · Be the first to post</div>`
  const chips = accepted.length
    ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${accepted
        .map((m) => `<span style="border-radius:4px;background:#eff6ff;padding:2px 6px;font-size:10px;font-weight:600;color:#1d4ed8">${escapeHtml(m)}</span>`)
        .join('')}</div>`
    : ''
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`
  return `
    <div style="width:248px;font-family:inherit">
      <div style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:800;color:#171717">
        <span>${escapeHtml(f.name || 'Facility')}</span>${f.verified ? '<span style="color:#0B4DBA">✓</span>' : ''}
      </div>
      <div style="font-size:11px;color:#737373">${escapeHtml(f.type || '')}</div>
      ${statusPanel}
      <div style="margin-top:6px;font-size:11px;color:#525252">${escapeHtml(f.address || '')}</div>
      <div style="margin-top:6px;font-size:11px;color:#525252">⭐ ${f.rating?.toFixed?.(1) || '—'} · ${f.reviewsCount || 0} reviews${f.distanceKm != null ? ` · ${f.distanceKm.toFixed(1)} km` : ''}</div>
      ${chips}
      <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <a href="${dir}" target="_blank" rel="noreferrer" style="display:flex;align-items:center;justify-content:center;gap:4px;border-radius:6px;background:#0B4DBA;padding:6px;font-size:11px;font-weight:700;color:#fff;text-decoration:none">➤ Directions</a>
        <button data-dm-action="report" data-dm-id="${escapeHtml(f.id)}" style="cursor:pointer;border:0;display:flex;align-items:center;justify-content:center;gap:4px;border-radius:6px;background:#ea580c;padding:6px;font-size:11px;font-weight:700;color:#fff">⚡ Post update</button>
        <button data-dm-action="favorite" data-dm-id="${escapeHtml(f.id)}" style="cursor:pointer;border:1px solid #e5e5e5;display:flex;align-items:center;justify-content:center;gap:4px;border-radius:6px;background:${isFavorite ? '#fff1f2' : '#fff'};padding:6px;font-size:11px;font-weight:700;color:${isFavorite ? '#be123c' : '#404040'}">${isFavorite ? '♥ Saved' : '♡ Save'}</button>
        <button data-dm-action="details" data-dm-id="${escapeHtml(f.id)}" style="cursor:pointer;border:1px solid #e5e5e5;border-radius:6px;background:#fff;padding:6px;font-size:11px;font-weight:700;color:#404040">View details</button>
      </div>
    </div>`
}

export default function MapView({
  facilities = [],
  center = { lat: 37.3382, lng: -121.8863 },
  zoom: initialZoom = 11,
  selectedId = null,
  onSelect = () => {},
  onOpenDetails = null,
  onToggleFavorite = null,
  onReport = null,
  favoriteIds = [],
  userLocation = null,
  loading = false,
  error = null,
  className = '',
  compact = false,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const LRef = useRef(null)
  const markersRef = useRef(new Map()) // id -> L.marker
  const userMarkerRef = useRef(null)
  const didFitRef = useRef(false)

  // A tick bumped when the map finishes initializing, so the sync effect reruns.
  const [ready, setReady] = useState(0)

  // Keep the latest callbacks/props in refs so the delegated popup click handler
  // and marker handlers always see current values without re-binding.
  const cbRef = useRef({})
  cbRef.current = { onSelect, onOpenDetails, onReport, onToggleFavorite, favoriteIds, facilities }

  // ---- Init map once ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    let ro
    import('leaflet').then((mod) => {
      const L = mod.default || mod
      if (cancelled || !containerRef.current) return
      LRef.current = L
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: initialZoom,
        zoomControl: !compact,
        scrollWheelZoom: !compact,
        attributionControl: true,
      })
      mapRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)

      // Delegated click handler for popup action buttons.
      containerRef.current.addEventListener('click', (e) => {
        const btn = e.target.closest?.('[data-dm-action]')
        if (!btn) return
        const id = btn.getAttribute('data-dm-id')
        const action = btn.getAttribute('data-dm-action')
        const { onSelect: os, onOpenDetails: od, onReport: orp, onToggleFavorite: otf, facilities: facs } = cbRef.current
        const fac = facs.find((x) => x.id === id)
        // "View details" navigates to the full facility page; fall back to
        // onSelect if no details handler was provided.
        if (action === 'details') (od || os)?.(id)
        else if (action === 'report') orp?.(fac)
        else if (action === 'favorite') otf?.(id)
      })

      // Staggered refit — the map container inside a flex shell doesn't have its
      // final size on first paint (same issue FacilityMap solves).
      const refit = () => { if (!cancelled && mapRef.current) mapRef.current.invalidateSize() }
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(refit)
        ro.observe(containerRef.current)
      }
      ;[60, 200, 500].forEach((ms) => setTimeout(refit, ms))
      // Trigger the marker-sync effect now that the map exists.
      setReady((n) => n + 1)
    })
    return () => {
      cancelled = true
      if (ro) ro.disconnect()
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      markersRef.current.clear()
      userMarkerRef.current = null
      didFitRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Sync facility markers ----
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return
    const favSet = new Set(favoriteIds)
    const seen = new Set()

    facilities.forEach((f) => {
      if (typeof f.lat !== 'number' || typeof f.lng !== 'number') return
      seen.add(f.id)
      const isFavorite = favSet.has(f.id)
      const isSelected = f.id === selectedId
      const icon = L.divIcon({
        className: 'dm-facility-pin',
        html: markerHtml(f, { isFavorite, isSelected }),
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      })
      let m = markersRef.current.get(f.id)
      if (!m) {
        m = L.marker([f.lat, f.lng], { icon }).addTo(map)
        m.bindPopup(popupHtml(f, { isFavorite }), { closeButton: true, maxWidth: 260, offset: [0, -24] })
        m.on('click', () => cbRef.current.onSelect?.(f.id))
        markersRef.current.set(f.id, m)
      } else {
        m.setLatLng([f.lat, f.lng])
        m.setIcon(icon)
        m.setPopupContent(popupHtml(f, { isFavorite }))
      }
    })

    // Remove markers for facilities no longer present.
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) { map.removeLayer(m); markersRef.current.delete(id) }
    }

    // Fit to markers once, on first load with data.
    if (!didFitRef.current && markersRef.current.size > 0) {
      const group = L.featureGroup([...markersRef.current.values()])
      try { map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 13 }) } catch {}
      didFitRef.current = true
    }
  }, [facilities, favoriteIds, selectedId, ready])

  // ---- Open popup + pan when selectedId changes externally ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const m = markersRef.current.get(selectedId)
    if (m) { map.panTo(m.getLatLng(), { animate: true }); m.openPopup() }
  }, [selectedId, ready])

  // ---- Recenter when parent `center` changes (Near Me / search) ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !center?.lat || !center?.lng) return
    map.panTo([center.lat, center.lng], { animate: true })
  }, [center?.lat, center?.lng])

  // ---- User location marker ----
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return
    if (userMarkerRef.current) { map.removeLayer(userMarkerRef.current); userMarkerRef.current = null }
    if (userLocation?.lat && userLocation?.lng) {
      const icon = L.divIcon({
        className: 'dm-user-dot',
        html: `<span style="display:inline-flex;height:18px;width:18px;border-radius:9999px;border:3px solid #fff;background:#3b82f6;box-shadow:0 0 0 4px rgba(59,130,246,.35)"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon, interactive: false, zIndexOffset: -1000 }).addTo(map)
    }
  }, [userLocation?.lat, userLocation?.lng, ready])

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-xl ${className}`}>
      <div ref={containerRef} className="dm-map-canvas h-full w-full" />

      {/* Live-condition legend — explains the Waze-style pin colors. */}
      {!compact && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[500] -translate-x-1/2 flex items-center gap-3 rounded-full border border-neutral-200 bg-white/95 px-3 py-1.5 text-[10px] font-semibold text-neutral-600 shadow">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CONDITION_COLORS.free.bg }} /> Free</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CONDITION_COLORS.moderate.bg }} /> Moderate</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CONDITION_COLORS.busy.bg }} /> Busy</span>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            Loading facilities…
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-x-0 top-3 z-[600] mx-auto w-fit max-w-[90%] rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 shadow">
          {error}
        </div>
      )}

      {/* Empty hint */}
      {!loading && !error && facilities.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[550] flex items-center justify-center">
          <div className="rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 text-sm font-medium text-neutral-700 shadow">
            No facilities match your filters
          </div>
        </div>
      )}

      <style jsx global>{`
        .dm-map-canvas .leaflet-tile-pane { filter: saturate(0.92) brightness(1.02) contrast(0.98); }
        .dm-map-canvas .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.18); }
        .dm-map-canvas .leaflet-popup-content { margin: 10px 12px; }
        .dm-map-canvas .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,.7); }
        .dm-facility-pin { background: transparent; border: 0; }
      `}</style>
    </div>
  )
}
