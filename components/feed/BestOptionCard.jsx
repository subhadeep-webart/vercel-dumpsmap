'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Target, MapPin, Clock, CheckCircle2, AlertTriangle, ChevronRight, Navigation,
  Sparkles, RefreshCw, ShieldCheck, Flame, Star, CircleDollarSign,
} from 'lucide-react'

const MATERIAL_OPTIONS = [
  { v: 'any', label: 'Any material' },
  { v: 'construction debris', label: 'Construction debris' },
  { v: 'concrete', label: 'Concrete' },
  { v: 'wood', label: 'Wood' },
  { v: 'metal', label: 'Metal / scrap' },
  { v: 'green waste', label: 'Green / yard waste' },
  { v: 'mattresses', label: 'Mattresses' },
  { v: 'appliances', label: 'Appliances' },
  { v: 'e-waste', label: 'E-waste / electronics' },
  { v: 'CRV bottles', label: 'CRV bottles / cans' },
  { v: 'paint', label: 'Paint / HHW' },
  { v: 'clothing', label: 'Clothing / donations' },
]

export default function BestOptionCard({ lat, lng, onOpenFacility }) {
  const [material, setMaterial] = useState('any')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showAlts, setShowAlts] = useState(false)
  const hasLocation = lat != null && lng != null

  const load = async () => {
    if (!hasLocation) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        lat: String(lat), lng: String(lng), maxKm: '50', limit: '5',
      })
      if (material && material !== 'any') params.set('material', material)
      const r = await fetch(`/api/recommendations/best-option?${params}`)
      if (r.ok) setData(await r.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [lat, lng, material])

  if (!hasLocation) {
    return (
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <div className="text-sm font-semibold text-neutral-900">Best Option Right Now</div>
              <div className="mt-0.5 text-xs text-neutral-600">Share your location to see the smartest dump-stop nearby — factors in wait times, open status, materials, and recent reports.</div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const top = data?.topPick
  const alts = data?.alternatives || []
  const sig = data?.signals || {}

  return (
    <Card className="overflow-hidden border-2 border-brand-300 bg-gradient-to-br from-brand-50 via-white to-brand-50/30 shadow-sm">
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Target className="h-5 w-5 text-brand-600" />
              <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-amber-500" />
            </div>
            <div className="text-sm font-bold text-neutral-900">Best Option Right Now</div>
            <Badge variant="outline" className="border-brand-200 bg-white text-[10px] text-brand-700">AI-ranked</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={material} onValueChange={setMaterial}>
              <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="Any material" /></SelectTrigger>
              <SelectContent>
                {MATERIAL_OPTIONS.map((m) => <SelectItem key={m.v || 'any'} value={m.v}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Top pick */}
        {loading && !top && (
          <div className="rounded-lg border border-brand-200/50 bg-white/60 p-4 text-center text-xs text-neutral-500">
            Scoring nearby facilities…
          </div>
        )}
        {!loading && !top && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {sig.reason || 'No eligible facilities found right now. Try widening your material filter.'}
          </div>
        )}
        {top && (
          <button
            onClick={() => onOpenFacility?.(top.facility)}
            className="group block w-full rounded-lg border-2 border-brand-300 bg-white p-3 text-left transition hover:border-brand-500 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-neutral-900">{top.facility.name}</span>
                  {top.facility.verified && (
                    <Badge variant="outline" className="border-brand-200 bg-brand-50 text-[10px] text-brand-800">
                      <ShieldCheck className="mr-0.5 h-2.5 w-2.5" /> Verified
                    </Badge>
                  )}
                  <Badge variant="outline" className="border-brand-300 bg-brand-100 text-[10px] text-brand-900">
                    score {top.score}/100
                  </Badge>
                </div>
                <div className="mt-0.5 text-xs text-neutral-600">
                  <MapPin className="mr-0.5 inline h-3 w-3" />
                  {top.facility.address}{top.facility.city ? `, ${top.facility.city}` : ''}
                  {top.facility.distanceKm != null && <span className="ml-1 font-semibold text-neutral-700">· {top.facility.distanceKm.toFixed(1)} km</span>}
                </div>
                {/* Reasons */}
                {top.reasons.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {top.reasons.slice(0, 4).map((r, i) => (
                      <span key={i} className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-800">{r}</span>
                    ))}
                  </div>
                )}
                {top.penalties.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {top.penalties.slice(0, 2).map((p, i) => (
                      <span key={i} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">{p}</span>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-brand-600 transition group-hover:translate-x-0.5" />
            </div>
            {top.facility.lat && top.facility.lng && (
              <div className="mt-2 flex justify-end">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${top.facility.lat},${top.facility.lng}`}
                  target="_blank" rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  <Navigation className="h-3 w-3" /> Directions
                </a>
              </div>
            )}
          </button>
        )}

        {/* Alternatives (collapsible) */}
        {alts.length > 0 && (
          <div>
            <button
              onClick={() => setShowAlts((s) => !s)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <span>{showAlts ? 'Hide' : `Show ${alts.length} alternative${alts.length === 1 ? '' : 's'}`}</span>
              <ChevronRight className={`h-3.5 w-3.5 transition ${showAlts ? 'rotate-90' : ''}`} />
            </button>
            {showAlts && (
              <div className="mt-1.5 space-y-1.5">
                {alts.map((a) => (
                  <button
                    key={a.facility.id}
                    onClick={() => onOpenFacility?.(a.facility)}
                    className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-xs hover:border-brand-300 hover:bg-brand-50/50"
                  >
                    <Target className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    <span className="min-w-0 flex-1 truncate font-semibold text-neutral-900">{a.facility.name}</span>
                    <span className="shrink-0 text-neutral-500">{a.facility.distanceKm?.toFixed(1)}km</span>
                    <Badge variant="outline" className="shrink-0 border-neutral-300 text-[10px]">sc {a.score}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Signals footer */}
        {sig.totalConsidered != null && (
          <div className="border-t border-brand-200/40 pt-2 text-[10px] text-neutral-500">
            Ranked from {sig.totalConsidered} facilities within {sig.maxKm}km · {sig.eligibleCount} eligible{sig.nearbyJobCount > 0 ? ` · ${sig.nearbyJobCount} hot-spot job${sig.nearbyJobCount === 1 ? '' : 's'} nearby` : ''}{sig.userIsContractor ? ' · contractor mode' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
