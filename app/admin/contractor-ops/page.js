'use client'

// /admin/contractor-ops — admin view of contractor Receipts + Vehicle
// Inspections. Lets staff browse all records, flag suspicious receipts,
// and drill into damage / dashboard-light reports.

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Receipt, Truck, AlertTriangle, ShieldAlert, Loader2, Filter, Calendar, RefreshCw,
} from 'lucide-react'

const fmtUSD = (n) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
const fmtTons = (n) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} t`

export default function AdminContractorOpsPage() {
  return <ContractorOpsAdmin />
}

function ContractorOpsAdmin() {
  const { authFetch } = useAdmin()
  const [tab, setTab] = useState('receipts')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Contractor Ops</h1>
          <p className="text-sm text-neutral-500">Receipt records, vehicle inspections, suspicious entries, and damage reports.</p>
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-neutral-200 bg-white text-sm">
          {[['receipts', 'Receipts', Receipt], ['inspections', 'Inspections', Truck]].map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${tab === k ? 'bg-brand-50 font-bold text-brand-700' : 'text-neutral-600 hover:bg-neutral-50'}`}>
              <Icon className="h-3.5 w-3.5" /> {l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'receipts' ? <ReceiptsAdmin authFetch={authFetch} /> : <InspectionsAdmin authFetch={authFetch} />}
    </div>
  )
}

function ReceiptsAdmin({ authFetch }) {
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [suspiciousOnly, setSuspiciousOnly] = useState(false)
  const [userId, setUserId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const qp = new URLSearchParams({ limit: '200' })
    if (suspiciousOnly) qp.set('suspicious', '1')
    if (userId) qp.set('userId', userId)
    const [r, s] = await Promise.all([
      authFetch(`/api/admin/receipts?${qp}`).then((x) => x.json()),
      authFetch('/api/admin/receipts/stats').then((x) => x.json()),
    ])
    setRows(r.receipts || [])
    setStats(s)
    setLoading(false)
  }, [authFetch, suspiciousOnly, userId])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <AdminTile icon={Receipt} label="Total in window" value={stats?.totalReceiptsInWindow ?? '—'} loading={loading} />
        <AdminTile icon={Receipt} label="This month trips" value={stats?.thisMonth?.trips ?? 0} sub={`${fmtUSD(stats?.thisMonth?.totalCost || 0)} · ${fmtTons(stats?.thisMonth?.totalNetTons || 0)}`} loading={loading} />
        <AdminTile icon={Receipt} label="Recent batches" value={stats?.recentBatches?.length ?? 0} sub={`${stats?.manualCount || 0} manual entries`} loading={loading} />
        <AdminTile icon={AlertTriangle} label="Flagged receipts" value={stats?.flagged?.length ?? 0} loading={loading} tone="red" />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <input id="susp" type="checkbox" checked={suspiciousOnly} onChange={(e) => setSuspiciousOnly(e.target.checked)} />
          <label htmlFor="susp" className="cursor-pointer">Suspicious only</label>
        </div>
        <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Filter by userId…" className="h-9 w-56" />
        <Button onClick={load} variant="outline" size="sm"><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">No receipts match.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Facility</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2">Material / Truck</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((r) => (
                    <tr key={r.id} className={r.suspicious ? 'bg-red-50/30' : ''}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">{r.dateOf}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-semibold">{r.userName || r.userEmail || '—'}</div>
                        <div className="text-[10px] text-neutral-500">{r.userEmail} · {r.userRole}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.facilityName}
                        {r.batchId && <div className="text-[10px] text-neutral-500">batch {r.batchId.slice(0, 8)}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-xs">{fmtTons(r.netTons)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-bold">{fmtUSD(r.totalCost)}</td>
                      <td className="px-3 py-2 text-[11px] text-neutral-600">
                        {r.materialType || '—'}{r.vehicleNumber ? ` · ${r.vehicleNumber}` : ''}{r.jobName ? ` · ${r.jobName}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.suspicious && <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Suspicious</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InspectionsAdmin({ authFetch }) {
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [issuesOnly, setIssuesOnly] = useState(false)
  const [date, setDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const qp = new URLSearchParams({ limit: '200' })
    if (issuesOnly) qp.set('issuesOnly', '1')
    if (date) qp.set('date', date)
    const [r, s] = await Promise.all([
      authFetch(`/api/admin/vehicle-inspections?${qp}`).then((x) => x.json()),
      authFetch('/api/admin/vehicle-inspections/stats').then((x) => x.json()),
    ])
    setRows(r.inspections || [])
    setStats(s)
    setLoading(false)
  }, [authFetch, issuesOnly, date])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <AdminTile icon={Truck} label="Today completed" value={stats?.todayCompleted ?? '—'} loading={loading} />
        <AdminTile icon={ShieldAlert} label="Today w/ issues" value={stats?.todayWithIssues ?? '—'} loading={loading} tone="red" />
        <AdminTile icon={AlertTriangle} label="Lifetime issues" value={stats?.totalWithIssues ?? '—'} loading={loading} />
        <AdminTile icon={Truck} label="Recent damage reports" value={(stats?.recentDamageReports || []).length} loading={loading} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <input id="iss" type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} />
          <label htmlFor="iss" className="cursor-pointer">Issues only</label>
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-44" />
        <Button onClick={load} variant="outline" size="sm"><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">No inspections match.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Driver / User</th>
                    <th className="px-3 py-2">Vehicle</th>
                    <th className="px-3 py-2 text-right">Miles</th>
                    <th className="px-3 py-2">Issues</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((r) => (
                    <tr key={r.id} className={r.issuesFlag ? 'bg-red-50/30' : ''}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">{r.date} {r.startTime ? `· ${r.startTime}` : ''}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-semibold">{r.driverName}</div>
                        <div className="text-[10px] text-neutral-500">{r.userEmail}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">{r.vehicleNumber}{r.vehicleType ? ` · ${r.vehicleType}` : ''}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-xs">{(r.milesDriven || 0).toLocaleString()} mi</td>
                      <td className="px-3 py-2 text-[11px]">
                        {r.dashboardLightsReported && <Badge className="mr-1 bg-amber-100 text-amber-700 hover:bg-amber-100">Lights</Badge>}
                        {r.damageReported && <Badge className="mr-1 bg-red-100 text-red-700 hover:bg-red-100">Damage</Badge>}
                        {!r.issuesFlag && <span className="text-emerald-700">Clean</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/vehicle-inspections/${r.id}`} className="text-xs font-semibold text-brand-700 hover:underline">View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AdminTile({ icon: Icon, label, value, sub, loading, tone }) {
  const valueClass = tone === 'red' ? 'text-red-700' : 'text-neutral-900'
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</span>
        <Icon className={`h-4 w-4 ${tone === 'red' ? 'text-red-600' : 'text-brand-600'}`} />
      </div>
      <div className={`mt-1.5 text-2xl font-extrabold ${valueClass}`}>{loading ? <span className="inline-block h-6 w-14 animate-pulse rounded bg-neutral-200" /> : value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </CardContent></Card>
  )
}
