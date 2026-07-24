'use client'

// /disposal-intelligence — Phase B → C upgrade.
// Now pulls LIVE stats from /api/receipts/stats when the user has any receipts logged.
// Falls back to "—" placeholders if there is no data yet, with a CTA to open the
// Receipt Center.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import ContractorToolsGate from '@/components/ContractorToolsGate'
import {
  BarChart3, Receipt, Truck, Recycle, ArrowRight, Sparkles, Clock, MapPin,
  DollarSign, Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const authHeaders = () => {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const fmtUSD = (n) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
const fmtTons = (n) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} t`

export default function DisposalIntelligencePage() {
  return (
    <ContractorToolsGate toolName="Disposal Intelligence">
      <DisposalIntelligence />
    </ContractorToolsGate>
  )
}

function DisposalIntelligence() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/receipts/stats', { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => { if (!j.error) setStats(j) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hasData = stats && stats.lifetime?.trips > 0
  const month = stats?.thisMonth || {}
  const lifetime = stats?.lifetime || {}

  return (
    <div className="min-h-[100dvh] bg-neutral-50">
      <AppHeader active="intel" />

      {/* HERO */}
      <section className="container mx-auto px-4 py-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">Phase C · v1 live</div>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight sm:text-3xl">Disposal Intelligence</h1>
            <p className="mt-1 max-w-xl text-sm text-neutral-600">Live analytics powered by your Receipt Center. Track every dump trip, weight, cost, and facility. See your average $/ton and your most-used yards at a glance.</p>
          </div>
          <Link
            href="/receipts"
            className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-bold text-white shadow hover:bg-brand-700"
          >
            <Receipt className="h-4 w-4" /> Open Receipt Center
          </Link>
        </div>
      </section>

      {/* MONTH TILES */}
      <section className="container mx-auto px-4 pb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-600">This month</h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={Truck}      label="Trips this month"      value={hasData ? month.trips : '—'} sub="From your receipts" />
          <StatTile icon={BarChart3}  label="Tons disposed"          value={hasData ? fmtTons(month.totalNetTons) : '—'} sub={hasData ? `${(month.totalNetLb || 0).toLocaleString()} lb net` : 'Gross → tare → net'} />
          <StatTile icon={DollarSign} label="Dump cost"              value={hasData ? fmtUSD(month.totalCost) : '—'} sub={hasData && month.avgCostPerTon ? `~${fmtUSD(month.avgCostPerTon)}/ton` : 'With env-fees'} />
          <StatTile icon={Recycle}    label="Marketplace recovery"   value="—" sub="Coming in Phase C+" />
        </div>
      </section>

      {/* LIFETIME + TOP FACILITIES */}
      {hasData ? (
        <section className="container mx-auto px-4 pb-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-600">All-time</h3>
                <dl className="space-y-2 text-sm">
                  <Row label="Total trips" value={lifetime.trips} />
                  <Row label="Total tons"  value={fmtTons(lifetime.totalNetTons)} />
                  <Row label="Total cost"  value={fmtUSD(lifetime.totalCost)} />
                  <Row label="Avg $/ton"   value={fmtUSD(lifetime.avgCostPerTon)} />
                  <Row label="Avg $/trip"  value={fmtUSD(lifetime.avgCostPerTrip)} />
                </dl>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-600">Top facilities</h3>
                {stats.topFacilities?.length ? (
                  <ul className="space-y-2">
                    {stats.topFacilities.map((f, i) => (
                      <li key={i} className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <MapPin className="h-4 w-4 shrink-0 text-brand-600" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{f.facilityName}</div>
                          <div className="text-[11px] text-neutral-500">{f.trips} trips · {fmtTons(f.totalNetTons)} · {fmtUSD(f.totalCost)}</div>
                        </div>
                        {f.facilityId ? (
                          <Link href={`/facilities/${f.facilityId}`} className="text-xs font-semibold text-brand-700 hover:underline">
                            View →
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-neutral-500">No facility data yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : (
        // EMPTY STATE
        <section className="container mx-auto px-4 pb-10">
          <Card>
            <CardContent className="space-y-3 p-6 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-brand-400" />
              <h2 className="text-base font-bold">No receipts logged yet</h2>
              <p className="text-sm text-neutral-600">Log your first dump trip in the Receipt Center to start seeing live cost and tonnage analytics here.</p>
              <Link href="/receipts" className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700">
                <Receipt className="h-4 w-4" /> Open Receipt Center <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ROADMAP */}
      <section className="container mx-auto px-4 pb-16">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">On the roadmap</h2>
              <Link href="/receipts" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Open Receipt Center <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <ul className="grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
              <li className="rounded-md border border-neutral-200 bg-neutral-50 p-3"><Receipt className="mr-1 inline h-4 w-4 text-brand-600" /> Receipt OCR auto-extract (Phase C+)</li>
              <li className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <Link href="/time-clock" className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline">
                  <Clock className="h-4 w-4" /> Time-in / time-out tracking — open Time Clock <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </li>
              <li className="rounded-md border border-neutral-200 bg-neutral-50 p-3"><BarChart3 className="mr-1 inline h-4 w-4 text-brand-600" /> Charts & exports (CSV / PDF)</li>
              <li className="rounded-md border border-neutral-200 bg-neutral-50 p-3"><Recycle className="mr-1 inline h-4 w-4 text-brand-600" /> Diversion estimate (marketplace recovery)</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function StatTile({ icon: Icon, label, value, sub }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</span>
          <Icon className="h-4 w-4 text-brand-600" />
        </div>
        <div className="mt-2 text-2xl font-extrabold text-neutral-900">{value}</div>
        <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-sm font-bold text-neutral-900">{value}</dd>
    </div>
  )
}
