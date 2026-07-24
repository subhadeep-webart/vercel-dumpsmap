'use client'

// /vehicle-inspections — Vehicle Inspection dashboard + list.
// Contractor-only. Shows today's status (completed / missing / issues),
// known vehicles, recent inspections. Big "Start inspection" CTA.

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import ContractorToolsGate from '@/components/ContractorToolsGate'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Truck, ClipboardCheck, AlertTriangle, Plus, Loader2, Calendar, Gauge, Fuel,
  CheckCircle2, ChevronRight, ShieldAlert, Camera, Receipt, BarChart3,
} from 'lucide-react'

const FUEL_LABEL = { empty: 'Empty', '1_4': '¼', '1_2': '½', '3_4': '¾', full: 'Full' }
const LOAD_LABEL = { empty: 'Empty', half: 'Half full', full: 'Full' }

const authHeaders = () => {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function VehicleInspectionsPage() {
  return (
    <ContractorToolsGate toolName="Vehicle Inspections">
      <VehicleInspections />
    </ContractorToolsGate>
  )
}

function VehicleInspections() {
  const router = useRouter()
  const [stats, setStats] = useState(null)
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, l] = await Promise.all([
        fetch('/api/vehicle-inspections/stats', { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
        fetch('/api/vehicle-inspections?limit=30', { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ inspections: [] })),
      ])
      if (s && !s.error) setStats(s)
      setInspections(l.inspections || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-[100dvh] bg-neutral-50">
      <AppHeader active="receipts" />

      {/* Hero */}
      <section className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">Contractor Ops · Vehicle Inspections</div>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight sm:text-3xl">Vehicle Inspections</h1>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600">Daily pre-shift &amp; post-shift truck inspections. Log mileage, fuel, damages, dashboard lights, and the safety checklist. All saved permanently.</p>
          </div>
          <Button asChild className="bg-brand-600 hover:bg-brand-700">
            <Link href="/vehicle-inspections/new"><Plus className="mr-1.5 h-4 w-4" /> Start inspection</Link>
          </Button>
        </div>
      </section>

      {/* Today's status */}
      <section className="container mx-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile icon={ClipboardCheck} label="Completed today" value={stats?.completed ?? 0} sub={stats?.date || ''} loading={loading} tone="emerald" />
          <KpiTile icon={Truck} label="Missing today" value={stats?.missing ?? 0} sub={(stats?.missingVehicles || []).slice(0, 2).join(', ') || 'All inspected'} loading={loading} tone="amber" />
          <KpiTile icon={AlertTriangle} label="With issues" value={stats?.issues ?? 0} sub="Today" loading={loading} tone="red" />
          <KpiTile icon={Truck} label="Known vehicles" value={(stats?.knownVehicles || []).length} sub="All-time" loading={loading} tone="brand" />
        </div>
      </section>

      {/* Mobile quick actions */}
      <section className="container mx-auto px-4 pb-4 sm:hidden">
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" className="h-12 justify-start"><Link href="/vehicle-inspections/new"><Camera className="mr-2 h-4 w-4" /> Start inspection</Link></Button>
          <Button asChild variant="outline" className="h-12 justify-start"><Link href="/receipts"><Receipt className="mr-2 h-4 w-4" /> Receipts</Link></Button>
        </div>
      </section>

      {/* Recent inspections */}
      <section className="container mx-auto px-4 pb-16">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <ClipboardCheck className="h-4 w-4 text-brand-600" /> Recent inspections
              </h2>
              <span className="text-[11px] text-neutral-500">{inspections.length} on file</span>
            </div>
            {loading && (
              <div className="flex items-center gap-2 px-4 py-10 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading inspections…
              </div>
            )}
            {!loading && inspections.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <Truck className="h-8 w-8 text-neutral-300" />
                <div className="text-sm font-semibold">No inspections yet</div>
                <div className="text-xs text-neutral-500">Log your first pre-shift inspection to start tracking your fleet.</div>
                <Button asChild size="sm" className="mt-2 bg-brand-600 hover:bg-brand-700">
                  <Link href="/vehicle-inspections/new"><Plus className="mr-1 h-3.5 w-3.5" /> Start inspection</Link>
                </Button>
              </div>
            )}
            {!loading && inspections.length > 0 && (
              <ul className="divide-y divide-neutral-100">
                {inspections.map((ins) => (
                  <li key={ins.id}>
                    <Link href={`/vehicle-inspections/${ins.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50">
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ins.issuesFlag ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'}`}>
                        {ins.issuesFlag ? <ShieldAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold">{ins.vehicleNumber}</span>
                          <Badge variant="outline" className="text-[10px]">{ins.phase === 'both' ? 'Pre + Post' : ins.phase === 'post_shift' ? 'Post-shift' : 'Pre-shift'}</Badge>
                          {ins.issuesFlag && <Badge className="bg-red-100 text-[10px] text-red-700 hover:bg-red-100">Issues</Badge>}
                        </div>
                        <div className="mt-0.5 text-xs text-neutral-600">{ins.driverName} · {ins.date}{ins.startTime ? ` · ${ins.startTime}` : ''}</div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
                          <span><Gauge className="mr-0.5 inline h-3 w-3" /> {ins.mileageStart?.toLocaleString() || '—'}{ins.mileageEnd != null ? ` → ${ins.mileageEnd.toLocaleString()}` : ''} mi</span>
                          <span><Fuel className="mr-0.5 inline h-3 w-3" /> {FUEL_LABEL[ins.fuelStart]}{ins.fuelEnd ? ` → ${FUEL_LABEL[ins.fuelEnd]}` : ''}</span>
                          <span>{LOAD_LABEL[ins.loadStatus]}</span>
                          {ins.dashboardLightsReported && <span className="text-red-700">⚠ {ins.dashboardLights.join(', ') || 'Light reported'}</span>}
                          {ins.damageReported && <span className="text-red-700">⚠ Damage reported</span>}
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-neutral-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function KpiTile({ icon: Icon, label, value, sub, loading, tone = 'brand' }) {
  const toneClass =
    tone === 'red'     ? 'text-red-700' :
    tone === 'amber'   ? 'text-amber-700' :
    tone === 'emerald' ? 'text-emerald-700' :
                          'text-brand-600'
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</span>
          <Icon className={`h-4 w-4 ${toneClass}`} />
        </div>
        <div className="mt-2 text-2xl font-extrabold text-neutral-900">
          {loading ? <span className="inline-block h-6 w-12 animate-pulse rounded bg-neutral-200" /> : value}
        </div>
        <div className="mt-0.5 line-clamp-1 text-[11px] text-neutral-500">{sub}</div>
      </CardContent>
    </Card>
  )
}
