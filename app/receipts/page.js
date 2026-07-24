'use client'

// /receipts — Receipt Center v1 (Phase C)
//
// Lets contractors / haulers manually log every dump trip: gross / tare / net
// weight, $/ton, total cost, facility, photo. Shows monthly KPIs and a
// recent-receipts table. Backed by /api/receipts + /api/receipts/stats.

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import ContractorToolsGate from '@/components/ContractorToolsGate'
import {
  Receipt, Plus, Truck, BarChart3, Recycle, Camera, Loader2, Trash2,
  Pencil, Save, X, Calendar, MapPin, DollarSign, Image as ImageIcon,
  ArrowRight, ChevronDown, ClipboardCheck, TrendingUp, TrendingDown, ScanLine,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

const PAY_METHODS = [
  { v: 'card',    l: 'Card' },
  { v: 'cash',    l: 'Cash' },
  { v: 'check',   l: 'Check' },
  { v: 'account', l: 'Account / invoice' },
  { v: 'other',   l: 'Other' },
]

const LOAD_TYPES = [
  { v: 'mixed',  l: 'Mixed C&D' },
  { v: 'clean',  l: 'Clean (single material)' },
  { v: 'cnd',    l: 'C&D only' },
  { v: 'green',  l: 'Yard waste / green' },
  { v: 'metal',  l: 'Metal' },
  { v: 'other',  l: 'Other' },
]

const MATERIAL_TYPES = [
  'Mixed C&D', 'Concrete', 'Wood', 'Metal', 'Green Waste', 'Cardboard',
  'E-Waste', 'Appliances', 'Furniture', 'Dirt', 'Household Junk', 'Other',
]

const authHeaders = () => {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const fmtUSD = (n) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
const fmtTons = (n) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} t`

export default function ReceiptsPage() {
  return (
    <ContractorToolsGate toolName="Receipt Center">
      <ReceiptsCenter />
    </ContractorToolsGate>
  )
}

function ReceiptsCenter() {
  const router = useRouter()
  const [stats, setStats] = useState(null)
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, listRes] = await Promise.all([
        fetch('/api/receipts/stats', { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
        fetch('/api/receipts?limit=50', { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ receipts: [] })),
      ])
      if (statsRes && !statsRes.error) setStats(statsRes)
      setReceipts(listRes.receipts || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleSaved = () => {
    setFormOpen(false)
    setEditingId(null)
    loadAll()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this receipt? This cannot be undone.')) return
    const r = await fetch(`/api/receipts/${id}`, { method: 'DELETE', headers: authHeaders() })
    if (r.ok) loadAll()
  }

  const editing = editingId ? receipts.find((r) => r.id === editingId) : null

  return (
    <div className="min-h-[100dvh] bg-neutral-50">
      <AppHeader active="receipts" />

      {/* HERO */}
      <section className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">Phase C · v1</div>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight sm:text-3xl">Receipt Center</h1>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600">Log every dump trip. Track your $/ton, your monthly totals, and your most-used facilities. <span className="font-semibold text-violet-700">New: AI Receipt Scanner</span> auto-extracts fields from a photo in under 10 seconds.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/receipt-scanner">
              <Button className="bg-violet-600 hover:bg-violet-700">
                <ScanLine className="mr-1.5 h-4 w-4" /> Scan receipt <span className="ml-1.5 rounded-sm bg-white/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider">Beta</span>
              </Button>
            </Link>
            <Button onClick={() => { setEditingId(null); setBatchOpen(false); setFormOpen(true) }} className="bg-brand-600 hover:bg-brand-700">
              <Plus className="mr-1.5 h-4 w-4" /> Log a receipt
            </Button>
            <Button variant="outline" onClick={() => { setFormOpen(false); setBatchOpen(true) }}>
              <ClipboardCheck className="mr-1.5 h-4 w-4" /> Batch upload
            </Button>
          </div>
        </div>
      </section>

      {/* KPI TILES */}
      <section className="container mx-auto px-4 pb-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            icon={Truck}
            label="Trips this month"
            value={stats?.thisMonth?.trips ?? '—'}
            sub={stats?.previousMonth?.trips != null ? `vs ${stats.previousMonth.trips} last month` : 'No prior data'}
            loading={loading}
          />
          <KpiTile
            icon={BarChart3}
            label="Tons disposed"
            value={stats ? fmtTons(stats.thisMonth?.totalNetTons) : '—'}
            sub={stats?.thisMonth?.totalNetLb != null ? `${stats.thisMonth.totalNetLb.toLocaleString()} lb net` : ''}
            loading={loading}
          />
          <KpiTile
            icon={DollarSign}
            label="Dump cost"
            value={stats ? fmtUSD(stats.thisMonth?.totalCost) : '—'}
            sub={stats?.thisMonth?.avgCostPerTon ? `~${fmtUSD(stats.thisMonth.avgCostPerTon)}/ton` : ''}
            loading={loading}
          />
          <KpiTile
            icon={Recycle}
            label="Avg cost / trip"
            value={stats ? fmtUSD(stats.thisMonth?.avgCostPerTrip) : '—'}
            sub="This month"
            loading={loading}
          />
        </div>
      </section>

      {/* TOP FACILITIES */}
      {stats?.topFacilities?.length > 0 && (
        <section className="container mx-auto px-4 pb-6">
          <Card>
            <CardContent className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold">Your most-used facilities</h2>
                <span className="text-[11px] text-neutral-500">All-time</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {stats.topFacilities.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <MapPin className="h-4 w-4 shrink-0 text-brand-600" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{f.facilityName}</div>
                      <div className="text-[11px] text-neutral-500">{f.trips} trips · {fmtTons(f.totalNetTons)} · {fmtUSD(f.totalCost)}{f.avgCostPerTon ? ` · ${fmtUSD(f.avgCostPerTon)}/t` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* FACILITY COMPARISON (cheapest / most-expensive / most-used) */}
      {(stats?.cheapestFacility || stats?.mostExpensiveFacility || stats?.mostUsedFacility) && (
        <section className="container mx-auto px-4 pb-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <ComparisonCard tone="emerald" title="Cheapest facility" facility={stats.cheapestFacility} hint="Lowest avg $/ton (≥2 trips)" />
            <ComparisonCard tone="brand"   title="Most-used facility" facility={stats.mostUsedFacility} hint="Most trips logged" />
            <ComparisonCard tone="red"     title="Most expensive" facility={stats.mostExpensiveFacility} hint="Highest avg $/ton (≥2 trips)" />
          </div>
        </section>
      )}

      {/* MATERIAL BREAKDOWN + MONTHLY TREND */}
      {(stats?.materialBreakdown?.length > 0 || stats?.monthlyTrend?.length > 0) && (
        <section className="container mx-auto px-4 pb-6">
          <div className="grid gap-3 md:grid-cols-2">
            {stats.materialBreakdown?.length > 0 && (
              <Card><CardContent className="p-5">
                <h2 className="mb-3 text-sm font-bold">Material breakdown</h2>
                <MaterialBars items={stats.materialBreakdown} />
              </CardContent></Card>
            )}
            {stats.monthlyTrend?.length > 0 && (
              <Card><CardContent className="p-5">
                <h2 className="mb-3 text-sm font-bold">Monthly disposal trend</h2>
                <MonthlyTrend items={stats.monthlyTrend} />
              </CardContent></Card>
            )}
          </div>
        </section>
      )}

      {/* VEHICLE & JOB BREAKDOWN */}
      {(stats?.vehicleBreakdownThisMonth?.length > 0 || stats?.jobBreakdownThisMonth?.length > 0) && (
        <section className="container mx-auto px-4 pb-6">
          <div className="grid gap-3 md:grid-cols-2">
            {stats.vehicleBreakdownThisMonth?.length > 0 && (
              <Card><CardContent className="p-5">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Truck className="h-4 w-4 text-brand-600" /> Cost per truck (this month)</h2>
                <ul className="space-y-1.5">
                  {stats.vehicleBreakdownThisMonth.map((v) => (
                    <li key={v.vehicleNumber} className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                      <div>
                        <div className="text-sm font-semibold">{v.vehicleNumber}</div>
                        <div className="text-[11px] text-neutral-500">{v.trips} trips · {fmtTons(v.totalNetTons)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{fmtUSD(v.totalCost)}</div>
                        <div className="text-[11px] text-neutral-500">avg {fmtUSD(v.avgCostPerTrip)}/trip</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent></Card>
            )}
            {stats.jobBreakdownThisMonth?.length > 0 && (
              <Card><CardContent className="p-5">
                <h2 className="mb-3 text-sm font-bold">Cost per job (this month)</h2>
                <ul className="space-y-1.5">
                  {stats.jobBreakdownThisMonth.map((j) => (
                    <li key={j.jobName} className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                      <div>
                        <div className="text-sm font-semibold">{j.jobName}</div>
                        <div className="text-[11px] text-neutral-500">{j.trips} trips · {fmtTons(j.totalNetTons)}</div>
                      </div>
                      <div className="text-sm font-bold">{fmtUSD(j.totalCost)}</div>
                    </li>
                  ))}
                </ul>
              </CardContent></Card>
            )}
          </div>
        </section>
      )}

      {/* FORM (inline panel) */}
      {(formOpen || editing) && (
        <section className="container mx-auto px-4 pb-6">
          <ReceiptForm
            initial={editing || null}
            onCancel={() => { setFormOpen(false); setEditingId(null) }}
            onSaved={handleSaved}
          />
        </section>
      )}

      {/* BATCH PANEL */}
      {batchOpen && (
        <section className="container mx-auto px-4 pb-6">
          <ReceiptBatchPanel
            onCancel={() => setBatchOpen(false)}
            onSaved={() => { setBatchOpen(false); loadAll() }}
          />
        </section>
      )}

      {/* HISTORY TABLE */}
      <section className="container mx-auto px-4 pb-16">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Receipt className="h-4 w-4 text-brand-600" /> Recent receipts
              </h2>
              <span className="text-[11px] text-neutral-500">{receipts.length} on file</span>
            </div>
            {loading && (
              <div className="flex items-center gap-2 px-4 py-10 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading receipts…
              </div>
            )}
            {!loading && receipts.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <Receipt className="h-8 w-8 text-neutral-300" />
                <div className="text-sm font-semibold">No receipts yet</div>
                <div className="text-xs text-neutral-500">Log your first dump trip to start seeing your numbers.</div>
                <Button onClick={() => setFormOpen(true)} size="sm" className="mt-2 bg-brand-600 hover:bg-brand-700">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Log a receipt
                </Button>
              </div>
            )}
            {!loading && receipts.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="bg-neutral-50 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Facility</th>
                      <th className="px-4 py-2 text-right">Net</th>
                      <th className="px-4 py-2 text-right">$/ton</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-left">Load</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {receipts.map((r) => (
                      <tr key={r.id} className="hover:bg-neutral-50">
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-neutral-600">{r.dateOf}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {r.photoUrl ? (
                              <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                                <ImageIcon className="h-4 w-4" />
                              </a>
                            ) : null}
                            <span className="font-semibold">{r.facilityName || '—'}</span>
                          </div>
                          {r.notes ? <div className="text-[11px] text-neutral-500">{r.notes}</div> : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-xs">
                          {fmtTons(r.netTons)} <span className="text-neutral-400">({r.netLb} lb)</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-xs">{fmtUSD(r.pricePerTon)}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-sm font-bold">{fmtUSD(r.totalCost)}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-neutral-600">{r.loadType}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => { setEditingId(r.id); setFormOpen(true) }} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" aria-label="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDelete(r.id)} className="rounded-md p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-700" aria-label="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* CROSS-LINK */}
      <section className="container mx-auto px-4 pb-12">
        <Link href="/disposal-intelligence" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          See full Disposal Intelligence analytics <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  )
}

function KpiTile({ icon: Icon, label, value, sub, loading }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</span>
          <Icon className="h-4 w-4 text-brand-600" />
        </div>
        <div className="mt-2 text-2xl font-extrabold text-neutral-900">
          {loading ? <span className="inline-block h-6 w-16 animate-pulse rounded bg-neutral-200" /> : value}
        </div>
        <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>
      </CardContent>
    </Card>
  )
}

// Cheapest / most-used / most-expensive facility tile.
function ComparisonCard({ tone, title, facility, hint }) {
  const toneClass =
    tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/40' :
    tone === 'red'     ? 'border-red-200 bg-red-50/40' :
                          'border-brand-200 bg-brand-50/40'
  const valueClass =
    tone === 'emerald' ? 'text-emerald-700' :
    tone === 'red'     ? 'text-red-700' :
                          'text-brand-700'
  const Icon = tone === 'emerald' ? TrendingDown : tone === 'red' ? TrendingUp : MapPin
  return (
    <Card className={toneClass}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">{title}</span>
          <Icon className={`h-4 w-4 ${valueClass}`} />
        </div>
        {facility ? (
          <>
            <div className={`mt-2 truncate text-base font-extrabold ${valueClass}`}>{facility.facilityName}</div>
            <div className="mt-1 text-xs text-neutral-700">
              {facility.avgCostPerTon ? <><b>{fmtUSD(facility.avgCostPerTon)}</b> per ton · </> : null}{facility.trips} trips · {fmtTons(facility.totalNetTons)}
            </div>
          </>
        ) : (
          <>
            <div className="mt-2 text-sm font-bold text-neutral-400">—</div>
            <div className="mt-1 text-[11px] text-neutral-500">Log at least 2 trips at the same facility</div>
          </>
        )}
        <div className="mt-1 text-[10px] text-neutral-500">{hint}</div>
      </CardContent>
    </Card>
  )
}

// Horizontal bar chart for material breakdown.
function MaterialBars({ items }) {
  const max = Math.max(...items.map((i) => i.totalNetTons || 0), 0.001)
  return (
    <ul className="space-y-2">
      {items.map((m) => {
        const pct = Math.max(2, Math.round(((m.totalNetTons || 0) / max) * 100))
        return (
          <li key={m.material}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">{m.material}</span>
              <span className="text-neutral-500">{fmtTons(m.totalNetTons)} · {fmtUSD(m.totalCost)} · {m.trips} trips</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// Mini bar chart for last-6-month trend.
function MonthlyTrend({ items }) {
  const max = Math.max(...items.map((i) => i.totalCost || 0), 0.001)
  return (
    <div className="flex items-end gap-2">
      {items.map((m) => {
        const pct = Math.max(8, Math.round(((m.totalCost || 0) / max) * 100))
        return (
          <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full" title={`${m.month}: ${fmtUSD(m.totalCost)} · ${fmtTons(m.totalNetTons)} · ${m.trips} trips`}>
              <div className="ml-auto mr-auto h-24 w-full rounded-md bg-brand-100" style={{ position: 'relative' }}>
                <div className="absolute bottom-0 left-0 right-0 rounded-md bg-brand-500" style={{ height: `${pct}%` }} />
              </div>
            </div>
            <div className="text-[10px] font-semibold text-neutral-600">{m.month.slice(5)}</div>
            <div className="text-[10px] text-neutral-500">{fmtUSD(m.totalCost)}</div>
          </div>
        )
      })}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Batch upload panel — let contractors enter up to 10 receipts at once with
// a final review step + the "I confirm" checkbox required by the API.
// -----------------------------------------------------------------------------
const emptyBatchRow = () => ({
  dateOf: new Date().toISOString().slice(0, 10),
  facilityName: '', materialType: 'Mixed C&D',
  grossLb: '', tareLb: '', pricePerTon: '',
  vehicleNumber: '', jobName: '', ticketNumber: '', notes: '',
})

function ReceiptBatchPanel({ onCancel, onSaved }) {
  const [rows, setRows] = useState([emptyBatchRow(), emptyBatchRow()])
  const [phase, setPhase] = useState('entry') // 'entry' | 'review'
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const updateRow = (i, patch) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const addRow = () => setRows((rs) => rs.length < 10 ? [...rs, emptyBatchRow()] : rs)
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const validRows = rows.filter((r) => r.facilityName && r.facilityName.trim())
  const calcNetTons = (r) => {
    const net = Math.max(0, (Number(r.grossLb) || 0) - (Number(r.tareLb) || 0))
    return net / 2000
  }
  const calcTotal = (r) => Number((calcNetTons(r) * (Number(r.pricePerTon) || 0)).toFixed(2))

  const submit = async () => {
    if (!confirmed) { setError('Please confirm accuracy before submitting.'); return }
    if (validRows.length === 0) { setError('Add at least one receipt with a facility name.'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        confirm: true,
        receipts: validRows.map((r) => ({
          ...r,
          grossLb: Number(r.grossLb) || 0,
          tareLb: Number(r.tareLb) || 0,
          pricePerTon: Number(r.pricePerTon) || 0,
        })),
      }
      const res = await fetch('/api/receipts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Batch save failed')
      onSaved?.(j)
    } catch (e) { setError(String(e.message || e)) } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Batch upload receipts</h3>
            <p className="text-xs text-neutral-500">Up to 10 receipts in one go. Review before saving.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
        </div>

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}

        {phase === 'entry' && (
          <>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="rounded-md border border-neutral-200 bg-neutral-50/40 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-neutral-500">Row {i + 1}</span>
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(i)} className="text-[11px] text-red-600 hover:underline">Remove</button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Input placeholder="Facility name *" value={r.facilityName} onChange={(e) => updateRow(i, { facilityName: e.target.value })} required />
                    <Input type="date" value={r.dateOf} onChange={(e) => updateRow(i, { dateOf: e.target.value })} />
                    <Input type="number" inputMode="numeric" placeholder="Gross lb" value={r.grossLb} onChange={(e) => updateRow(i, { grossLb: e.target.value })} />
                    <Input type="number" inputMode="numeric" placeholder="Tare lb" value={r.tareLb} onChange={(e) => updateRow(i, { tareLb: e.target.value })} />
                    <Input type="number" inputMode="decimal" placeholder="$/ton" value={r.pricePerTon} onChange={(e) => updateRow(i, { pricePerTon: e.target.value })} />
                    <Input placeholder="Material" value={r.materialType} onChange={(e) => updateRow(i, { materialType: e.target.value })} />
                    <Input placeholder="Truck #" value={r.vehicleNumber} onChange={(e) => updateRow(i, { vehicleNumber: e.target.value })} />
                    <Input placeholder="Job name" value={r.jobName} onChange={(e) => updateRow(i, { jobName: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" disabled={rows.length >= 10} onClick={addRow}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add row ({rows.length}/10)
              </Button>
              <Button type="button" size="sm" disabled={validRows.length === 0} onClick={() => setPhase('review')} className="bg-brand-600 hover:bg-brand-700">
                Review {validRows.length} receipt{validRows.length === 1 ? '' : 's'} <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}

        {phase === 'review' && (
          <>
            <div className="overflow-x-auto rounded-md border border-neutral-200">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 text-left text-[10px] uppercase text-neutral-500">
                  <tr><th className="px-2 py-1.5">Date</th><th className="px-2 py-1.5">Facility</th><th className="px-2 py-1.5">Material</th><th className="px-2 py-1.5 text-right">Net</th><th className="px-2 py-1.5 text-right">$/ton</th><th className="px-2 py-1.5 text-right">Total</th><th className="px-2 py-1.5">Truck</th><th className="px-2 py-1.5">Job</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {validRows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">{r.dateOf}</td>
                      <td className="px-2 py-1.5 font-semibold">{r.facilityName}</td>
                      <td className="px-2 py-1.5">{r.materialType || '—'}</td>
                      <td className="px-2 py-1.5 text-right">{calcNetTons(r).toFixed(2)} t</td>
                      <td className="px-2 py-1.5 text-right">{fmtUSD(r.pricePerTon || 0)}</td>
                      <td className="px-2 py-1.5 text-right font-bold">{fmtUSD(calcTotal(r))}</td>
                      <td className="px-2 py-1.5">{r.vehicleNumber || '—'}</td>
                      <td className="px-2 py-1.5">{r.jobName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/40 p-3 text-xs">
              <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} className="mt-0.5" />
              <span className="text-amber-900">I confirm these receipt records are accurate to the best of my knowledge.</span>
            </label>
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPhase('entry')}>← Back to edit</Button>
              <Button type="button" size="sm" disabled={saving || !confirmed} onClick={submit} className="bg-brand-600 hover:bg-brand-700">
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Save batch ({validRows.length})
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Receipt form (create + edit). Uses /api/upload for photo persistence.
// -----------------------------------------------------------------------------
function ReceiptForm({ initial, onCancel, onSaved }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    dateOf: initial?.dateOf || new Date().toISOString().slice(0, 10),
    facilityId: initial?.facilityId || '',
    facilityName: initial?.facilityName || '',
    grossLb: initial?.grossLb ?? '',
    tareLb: initial?.tareLb ?? '',
    pricePerTon: initial?.pricePerTon ?? '',
    totalCost: '', // start empty so we auto-compute by default; user can override
    paymentMethod: initial?.paymentMethod || 'card',
    materialType: initial?.materialType || '',
    loadType: initial?.loadType || 'mixed',
    photoUrl: initial?.photoUrl || '',
    notes: initial?.notes || '',
    // Contractor Ops v2 fields
    ticketNumber: initial?.ticketNumber || '',
    timeIn: initial?.timeIn || '',
    timeOut: initial?.timeOut || '',
    environmentalFee: initial?.environmentalFee ?? '',
    vehicleNumber: initial?.vehicleNumber || '',
    jobName: initial?.jobName || '',
  })
  // Flag: did the user *explicitly* type a totalCost? If false, we always
  // submit the field as blank so the backend re-computes from weights × $/ton.
  const [totalCostManual, setTotalCostManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [facilitySearch, setFacilitySearch] = useState('')
  const [facilityResults, setFacilityResults] = useState([])
  const [facilityOpen, setFacilityOpen] = useState(false)

  const netLb = useMemo(() => {
    const g = Number(form.grossLb) || 0
    const t = Number(form.tareLb) || 0
    return Math.max(0, g - t)
  }, [form.grossLb, form.tareLb])
  const netTons = netLb / 2000
  const computedTotal = useMemo(() => {
    const p = Number(form.pricePerTon) || 0
    return Number((netTons * p).toFixed(2))
  }, [netTons, form.pricePerTon])

  // Facility search
  useEffect(() => {
    if (!facilitySearch || facilitySearch.length < 2) { setFacilityResults([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/facilities?q=${encodeURIComponent(facilitySearch)}`)
        const j = await r.json()
        setFacilityResults((j.facilities || []).slice(0, 6))
      } catch { setFacilityResults([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [facilitySearch])

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders(), body: fd })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Upload failed')
      update('photoUrl', j.url || j.fileUrl || j.path)
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        grossLb: Number(form.grossLb) || 0,
        tareLb: Number(form.tareLb) || 0,
        pricePerTon: Number(form.pricePerTon) || 0,
        environmentalFee: form.environmentalFee === '' ? 0 : Number(form.environmentalFee) || 0,
        // Only send totalCost when the user explicitly typed a custom value.
        totalCost: totalCostManual && form.totalCost !== '' ? Number(form.totalCost) || 0 : undefined,
      }
      if (payload.totalCost === undefined) delete payload.totalCost
      const url = isEdit ? `/api/receipts/${initial.id}` : '/api/receipts'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Save failed')
      onSaved?.(j.receipt)
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">{isEdit ? 'Edit receipt' : 'Log a new dump receipt'}</h3>
            <button type="button" onClick={onCancel} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
          )}

          {/* Date + facility */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Date <Calendar className="ml-1 inline h-3 w-3 text-neutral-400" /></Label>
              <Input type="date" value={form.dateOf} onChange={(e) => update('dateOf', e.target.value)} className="mt-1" required />
            </div>
            <div className="relative">
              <Label className="text-xs">Facility name</Label>
              <Input
                value={form.facilityName}
                onChange={(e) => { update('facilityName', e.target.value); setFacilitySearch(e.target.value); setFacilityOpen(true) }}
                onFocus={() => setFacilityOpen(true)}
                placeholder="Search or type facility name…"
                className="mt-1"
                required
              />
              {facilityOpen && facilityResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
                  {facilityResults.map((f) => (
                    <button
                      type="button"
                      key={f.id}
                      onClick={() => {
                        update('facilityId', f.id)
                        update('facilityName', f.name)
                        setFacilityOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-neutral-50"
                    >
                      <MapPin className="h-3.5 w-3.5 text-brand-600" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{f.name}</div>
                        <div className="truncate text-[10px] text-neutral-500">{f.address}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Weights */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Gross weight (lb)</Label>
              <Input type="number" inputMode="numeric" value={form.grossLb} onChange={(e) => update('grossLb', e.target.value)} placeholder="e.g. 8400" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Tare weight (lb)</Label>
              <Input type="number" inputMode="numeric" value={form.tareLb} onChange={(e) => update('tareLb', e.target.value)} placeholder="e.g. 5200" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Net (auto)</Label>
              <div className="mt-1 flex h-10 items-center rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm">
                <span className="font-bold">{netLb.toLocaleString()} lb</span>
                <span className="ml-2 text-xs text-neutral-500">({netTons.toFixed(2)} t)</span>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Price per ton ($)</Label>
              <Input type="number" inputMode="decimal" value={form.pricePerTon} onChange={(e) => update('pricePerTon', e.target.value)} placeholder="e.g. 75" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Total cost ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={form.totalCost}
                onChange={(e) => { update('totalCost', e.target.value); setTotalCostManual(e.target.value !== '') }}
                placeholder={`auto: $${computedTotal.toFixed(2)}`}
                className="mt-1"
              />
              <p className="mt-0.5 text-[10px] text-neutral-500">
                {totalCostManual
                  ? <button type="button" onClick={() => { update('totalCost', ''); setTotalCostManual(false) }} className="text-brand-700 underline">Reset to auto</button>
                  : 'Leave blank to auto-compute from net × $/ton.'}
              </p>
            </div>
            <div>
              <Label className="text-xs">Payment method</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => update('paymentMethod', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAY_METHODS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Material + load */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Material type</Label>
              <Select value={form.materialType} onValueChange={(v) => update('materialType', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select material…" /></SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Load type</Label>
              <Select value={form.loadType} onValueChange={(v) => update('loadType', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOAD_TYPES.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contractor Ops v2: optional metadata for cost-tracking */}
          <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50/40 p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Optional · for accurate per-truck &amp; per-job analytics</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">Ticket #</Label>
                <Input value={form.ticketNumber} onChange={(e) => update('ticketNumber', e.target.value)} placeholder="e.g. NRY-12345" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Time in</Label>
                <Input type="time" value={form.timeIn} onChange={(e) => update('timeIn', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Time out</Label>
                <Input type="time" value={form.timeOut} onChange={(e) => update('timeOut', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Truck / vehicle #</Label>
                <Input value={form.vehicleNumber} onChange={(e) => update('vehicleNumber', e.target.value)} placeholder="e.g. Truck #3" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Job name</Label>
                <Input value={form.jobName} onChange={(e) => update('jobName', e.target.value)} placeholder="e.g. Project Alpha" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Environmental fee ($)</Label>
                <Input type="number" inputMode="decimal" value={form.environmentalFee} onChange={(e) => update('environmentalFee', e.target.value)} placeholder="0" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Photo + notes */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Receipt photo (optional)</Label>
              <div className="mt-1 flex items-center gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 text-brand-600" />}
                  {uploading ? 'Uploading…' : 'Upload photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                </label>
                {form.photoUrl ? (
                  <a href={form.photoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 underline">View</a>
                ) : null}
                {form.photoUrl ? (
                  <button type="button" onClick={() => update('photoUrl', '')} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={2} placeholder="Optional notes (covered load, time-in/out, hazards…)" className="mt-1" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              {isEdit ? 'Save changes' : 'Save receipt'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
