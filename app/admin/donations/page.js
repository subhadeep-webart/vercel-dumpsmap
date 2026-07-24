'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { HeartHandshake, Mail, Repeat, DollarSign, AlertTriangle, Check, Download } from 'lucide-react'

function KPI({ icon: Icon, title, value, color = 'green' }) {
  const map = { green: 'bg-brand-50 text-brand-700 border-brand-200', amber: 'bg-amber-50 text-amber-700 border-amber-200', blue: 'bg-blue-50 text-blue-700 border-blue-200' }
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border ${map[color]}`}><Icon className="h-4 w-4" /></div>
      <div className="text-2xl font-extrabold text-neutral-900">{value ?? '—'}</div>
      <div className="text-xs font-medium text-neutral-500">{title}</div>
    </div>
  )
}

export default function AdminDonations() {
  const { authFetch } = useAdmin()
  const [data, setData] = useState(null)
  const [q, setQ] = useState('')

  const load = async () => {
    const r = await authFetch('/api/admin/donations')
    const j = await r.json()
    setData(j)
  }
  useEffect(() => { load() }, [])

  const markIntent = async (id, status) => {
    const note = prompt('Admin note (optional)', '')
    const r = await authFetch(`/api/admin/donations/intents/${id}`, { method: 'PATCH', body: JSON.stringify({ status, adminNote: note || '' }) })
    if (r.ok) { toast.success('Updated'); load() } else toast.error('Failed')
  }

  const exportCsv = async (scope = 'all') => {
    try {
      const r = await authFetch(`/api/admin/donations/export?scope=${encodeURIComponent(scope)}`)
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `Export failed (${r.status})`)
      }
      const blob = await r.blob()
      const filenameHeader = r.headers.get('Content-Disposition') || ''
      const m = filenameHeader.match(/filename="?([^"]+)"?/i)
      const filename = m ? m[1] : `dumpmaps-donations-${new Date().toISOString().slice(0, 10)}.csv`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported ${scope === 'all' ? 'all donations' : scope}`)
    } catch (e) {
      toast.error(e.message || 'Export failed')
    }
  }

  const filterFn = (e) => {
    if (!q) return true
    const s = q.toLowerCase()
    return (e.email || '').toLowerCase().includes(s) || (e.name || '').toLowerCase().includes(s)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Donations</h1>
          <p className="text-sm text-neutral-500">Supporter list, donation intents, and Stripe payment logs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supporter…" className="w-56" />
          <Button variant="outline" onClick={load}>Refresh</Button>
          <Button variant="outline" onClick={() => exportCsv('all')}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className={data?.stripeReady ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-amber-300 bg-amber-50 text-amber-800'}>
          {data?.stripeReady ? '✅ Stripe connected' : '⚠ Stripe not yet wired — intents are queued'}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <KPI icon={DollarSign}     title="Total raised"        value={`$${(data?.stats?.totalRaised || 0).toLocaleString()}`} />
        <KPI icon={HeartHandshake} title="Donations"           value={data?.stats?.donationCount ?? 0} />
        <KPI icon={Repeat}         title="Recurring supporters" value={data?.stats?.recurringCount ?? 0} color="blue" />
        <KPI icon={AlertTriangle}  title="Queued intents"       value={data?.stats?.intentCount ?? 0} color="amber" />
      </div>

      {/* Donations */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Donations (Stripe)</CardTitle></CardHeader>
        <CardContent>
          {(!data?.donations || data.donations.length === 0) ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-neutral-500">No Stripe donations yet — they’ll appear here once payments are enabled.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Supporter</th>
                    <th className="px-3 py-2">Tier</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.donations.filter(filterFn).map((d) => (
                    <tr key={d.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 text-xs text-neutral-500">{new Date(d.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{d.name || '—'}</div>
                        <div className="text-xs text-neutral-500">{d.email}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">{d.tier || '—'}{d.recurring && ' · monthly'}</td>
                      <td className="px-3 py-2 text-right font-bold">${d.amount}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{d.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Intents */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Queued intents (pre-Stripe)</CardTitle></CardHeader>
        <CardContent>
          {(!data?.intents || data.intents.length === 0) ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-neutral-500">No queued intents yet. New donation form submissions will land here until Stripe is wired.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Supporter</th>
                    <th className="px-3 py-2">Tier</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Message</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.intents.filter(filterFn).map((d) => (
                    <tr key={d.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 text-xs text-neutral-500">{new Date(d.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{d.name || '—'}</div>
                        <div className="text-xs text-neutral-500">{d.email}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">{d.tier || '—'}{d.recurring && ' · monthly'}</td>
                      <td className="px-3 py-2 text-right font-bold">${d.amount}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className={d.status === 'contacted' ? 'border-brand-300 bg-brand-50 text-brand-800' : d.status === 'converted' ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-amber-300 bg-amber-50 text-amber-800'}>{d.status}</Badge></td>
                      <td className="px-3 py-2 text-xs text-neutral-600 max-w-[260px] truncate">{d.message || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => markIntent(d.id, 'contacted')} className="mr-1"><Mail className="mr-1 h-3 w-3" /> Contacted</Button>
                        <Button size="sm" variant="outline" onClick={() => markIntent(d.id, 'converted')}><Check className="mr-1 h-3 w-3" /> Converted</Button>
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
