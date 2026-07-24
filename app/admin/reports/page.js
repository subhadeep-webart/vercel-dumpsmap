'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Flag, Check, X } from 'lucide-react'

const KINDS = ['facility', 'marketplace', 'job', 'alert', 'profile', 'message']

export default function AdminReports() {
  const { authFetch } = useAdmin()
  const [status, setStatus] = useState('open')
  const [kind, setKind] = useState('')
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (status) p.set('status', status); if (kind) p.set('kind', kind)
    const r = await authFetch(`/api/admin/reports?${p}`)
    const j = await r.json()
    setReports(j.reports || []); setLoading(false)
  }
  useEffect(() => { load() }, [status, kind])

  const act = async (id, body) => {
    const r = await authFetch(`/api/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    if (r.ok) { toast.success('Updated'); load() } else toast.error('Failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
          <p className="text-sm text-neutral-500">Universal report queue — facilities, listings, jobs, alerts, profiles, messages.</p>
        </div>
        <div className="flex gap-2">
          <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={kind || 'all'} onValueChange={(v) => setKind(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Kind" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              {KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {loading && <div className="rounded-lg border border-dashed p-6 text-center text-neutral-500">Loading…</div>}
        {!loading && reports.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-neutral-500">No reports.</div>}
        {reports.map((r) => (
          <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-red-600" />
                  <div className="font-semibold uppercase tracking-wide text-[11px]">{r.targetKind}</div>
                  <Badge variant="outline">{r.status}</Badge>
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{r.reason}</Badge>
                </div>
                <div className="mt-1 text-sm">Target: <code className="rounded bg-neutral-100 px-1 text-[11px]">{r.targetId}</code></div>
                {r.detail && <div className="mt-1 rounded bg-neutral-50 p-2 text-xs text-neutral-700">{r.detail}</div>}
                <div className="mt-1 text-[11px] text-neutral-400">Reported by {r.reportedByEmail} · {new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" onClick={() => act(r.id, { status: 'resolved', resolution: 'action_taken' })} className="bg-brand-600 hover:bg-brand-700"><Check className="mr-1 h-4 w-4" /> Resolve</Button>
                <Button size="sm" variant="outline" onClick={() => act(r.id, { status: 'dismissed', resolution: 'no_action' })}><X className="mr-1 h-4 w-4" /> Dismiss</Button>
                <Button size="sm" variant="outline" onClick={() => act(r.id, { status: 'reviewing' })}>Reviewing</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
