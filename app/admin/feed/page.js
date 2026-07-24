'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Pin, PinOff, CheckCircle2, Trash2, Activity } from 'lucide-react'

export default function AdminFeed() {
  const { authFetch } = useAdmin()
  const [status, setStatus] = useState('active')
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    const r = await authFetch(`/api/admin/alerts?${p}`)
    const j = await r.json()
    setAlerts(j.alerts || []); setLoading(false)
  }
  useEffect(() => { load() }, [status])

  const act = async (id, action) => {
    const r = await authFetch(`/api/admin/alerts/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) })
    if (r.ok) { toast.success(action); load() } else toast.error('Failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Live Feed Moderation</h1>
          <p className="text-sm text-neutral-500">Pin trustworthy reports, verify wait times, remove fake alerts.</p>
        </div>
        <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="removed">Removed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {loading && <div className="rounded-lg border border-dashed p-6 text-center text-neutral-500">Loading…</div>}
        {!loading && alerts.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-neutral-500">No alerts.</div>}
        {alerts.map((a) => (
          <div key={a.id} className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-brand-600" />
                  <div className="font-semibold">{a.type}</div>
                  <Badge variant="outline">{a.status}</Badge>
                  {a.pinned && <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800"><Pin className="mr-1 h-3 w-3" />Pinned</Badge>}
                  {a.adminVerified && <Badge variant="outline" className="border-brand-300 bg-brand-50 text-brand-800"><CheckCircle2 className="mr-1 h-3 w-3" />Verified</Badge>}
                </div>
                <div className="text-xs text-neutral-600">{a.text || a.message || '—'}</div>
                <div className="mt-1 text-[11px] text-neutral-400">Facility {a.facilityId} · by {a.userId || 'anon'} · {new Date(a.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => act(a.id, a.pinned ? 'unpin' : 'pin')}>{a.pinned ? <PinOff className="mr-1 h-4 w-4" /> : <Pin className="mr-1 h-4 w-4" />}{a.pinned ? 'Unpin' : 'Pin'}</Button>
                {!a.adminVerified && <Button size="sm" variant="outline" onClick={() => act(a.id, 'verify')}><CheckCircle2 className="mr-1 h-4 w-4" /> Verify</Button>}
                <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => act(a.id, 'remove')}><Trash2 className="mr-1 h-4 w-4" /> Remove</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
