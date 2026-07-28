'use client'

// FacilityMap — interactive OpenStreetMap (Leaflet) styled like a Google-Maps
// place map.
//
// Replaces the old static OSM <iframe>. Renders a real, pan/zoom-able map with
// a custom brand teardrop marker, a name/address popup, tasteful rounded
// controls, and a floating "Directions" button. Leaflet touches `window`, so
// this component is client-only and its parent imports it via next/dynamic with
// ssr:false.
//
// Tiles: standard OSM raster tiles (no API key). The "Maps-style" look comes
// from a light CSS treatment (muted saturation, rounded frame, soft controls)
// rather than a paid vector style, so it stays free and self-hosted-friendly.

import { useEffect, useRef } from 'react'
import { Navigation, Plus, Minus, Locate, ExternalLink } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

// Brand teardrop pin as an inline SVG data-URI so we don't depend on Leaflet's
// default marker image assets (which break under bundlers without extra config).
function pinSvg(color = '#0B4DBA') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12 17 29 17 29s17-17 17-29C34 7.6 26.4 0 17 0z" fill="${color}"/>
    <circle cx="17" cy="17" r="6.5" fill="#fff"/>
  </svg>`
  return `data:image/svg+xml;base64,${typeof window !== 'undefined' ? window.btoa(svg) : ''}`
}

export default function FacilityMap({ facility, directionsUrl, className = '' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  const lat = typeof facility?.lat === 'number' ? facility.lat : null
  const lng = typeof facility?.lng === 'number' ? facility.lng : null
  const hasCoords = lat != null && lng != null

  useEffect(() => {
    if (!hasCoords || !containerRef.current || mapRef.current) return
    let map
    let cancelled = false
    let ro
    const timers = []

    // Dynamically import leaflet so it never runs on the server.
    import('leaflet').then((mod) => {
      const L = mod.default || mod
      if (cancelled || !containerRef.current) return

      map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,       // we render our own Maps-style buttons
        attributionControl: true,
        scrollWheelZoom: false,   // avoid hijacking page scroll; drag+buttons still work
      })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)

      const icon = L.icon({
        iconUrl: pinSvg(),
        iconSize: [34, 46],
        iconAnchor: [17, 46],
        popupAnchor: [0, -42],
      })
      L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div style="font-weight:700;font-size:13px;color:#111">${escapeHtml(facility?.name || 'Facility')}</div>` +
          (facility?.address ? `<div style="font-size:12px;color:#555;margin-top:2px">${escapeHtml(facility.address)}</div>` : '')
        )

      // Keep the map sized to its container. A tall container inside a sticky
      // rail (h-[calc(100vh-…)]) doesn't have its final height on the first
      // paint, so a single early invalidateSize() would leave the lower half
      // as un-tiled grey. A ResizeObserver re-measures whenever the box settles
      // or the window resizes; the staggered timers cover the very first mount
      // and recenter so the pin stays framed after each resize.
      const refit = () => {
        if (cancelled || !mapRef.current) return
        mapRef.current.invalidateSize()
        mapRef.current.setView([lat, lng], mapRef.current.getZoom(), { animate: false })
      }
      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        ro = new ResizeObserver(() => mapRef.current && mapRef.current.invalidateSize())
        ro.observe(containerRef.current)
      }
      ;[60, 200, 500].forEach((ms) => timers.push(setTimeout(refit, ms)))
    })

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      if (ro) ro.disconnect()
      if (map) { map.remove() }
      mapRef.current = null
    }
  }, [hasCoords, lat, lng, facility?.name, facility?.address])

  const zoomIn = () => mapRef.current?.zoomIn()
  const zoomOut = () => mapRef.current?.zoomOut()
  const recenter = () => hasCoords && mapRef.current?.setView([lat, lng], 15, { animate: true })

  // "Open in Google Maps" — opens the PLACE (not directions). Prefer a
  // name+address query so Google resolves the actual business listing; fall
  // back to raw coordinates.
  const placeQuery = [facility?.name, facility?.address].filter(Boolean).join(' ') || (hasCoords ? `${lat},${lng}` : '')
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}`

  if (!hasCoords) {
    return (
      <div className={`flex h-full min-h-[240px] w-full items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-500 ${className}`}>
        Location unavailable
      </div>
    )
  }

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-neutral-200 shadow-sm ${className}`}>
      {/* Map canvas */}
      <div ref={containerRef} className="facility-leaflet h-full min-h-[240px] w-full" />

      {/* "Open in Google Maps" pill (top-left) — jumps to the full Google Maps
          place listing in a new tab, like a Maps place card. */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute left-3 top-3 z-[400] inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-md backdrop-blur transition hover:bg-white hover:text-brand-700"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Open in Google Maps
      </a>

      {/* Maps-style zoom + recenter controls */}
      <div className="absolute right-3 top-3 z-[400] flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-md">
        <button onClick={zoomIn} aria-label="Zoom in" className="flex h-9 w-9 items-center justify-center text-neutral-700 hover:bg-neutral-50">
          <Plus className="h-4 w-4" />
        </button>
        <div className="h-px bg-neutral-200" />
        <button onClick={zoomOut} aria-label="Zoom out" className="flex h-9 w-9 items-center justify-center text-neutral-700 hover:bg-neutral-50">
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <button
        onClick={recenter}
        aria-label="Recenter"
        className="absolute bottom-16 right-3 z-[400] flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-md hover:bg-neutral-50"
      >
        <Locate className="h-4 w-4" />
      </button>

      {/* Floating directions button (Maps-style) */}
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 left-3 z-[400] inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-brand-700"
      >
        <Navigation className="h-4 w-4" /> Directions
      </a>

      {/* Light "Maps" tint on the raster tiles */}
      <style jsx global>{`
        .facility-leaflet .leaflet-tile-pane {
          filter: saturate(0.9) brightness(1.02) contrast(0.98);
        }
        .facility-leaflet .leaflet-control-attribution {
          font-size: 9px;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 6px 0 0 0;
        }
        .facility-leaflet .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  )
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
