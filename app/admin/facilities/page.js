'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Search, CheckCircle2, XCircle, BadgeCheck, Trash2, ToggleRight } from 'lucide-react'
import FeatureGrantsDrawer from '@/components/admin/FeatureGrantsDrawer'

export default function AdminFacilities() {
  const { authFetch } = useAdmin()
  const [status, setStatus] = useState('pending')
  const [q, setQ] = useState('')
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(false)
  const [grantsFor, setGrantsFor] = useState(null) // facility object → opens drawer

  const load = async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (q) p.set('q', q)
    const r = await authFetch(`/api/admin/facilities?${p}`)
    const j = await r.json()
    setFacilities(j.facilities || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [status])

  const moderate = async (id, payload) => {
    const r = await authFetch(`/api/admin/facilities/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    if (r.ok) { toast.success('Updated'); load() } else { toast.error('Failed') }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Facilities</h1>
          <p className="text-sm text-neutral-500">Approve, verify, edit, and moderate facility listings.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Search…" className="w-56 pl-8" />
          </div>
          <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {loading && <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-neutral-500">Loading…</div>}
        {!loading && facilities.length === 0 && <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-neutral-500">No facilities match.</div>}
        {facilities.map((f) => (
          <div key={f.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{f.name}</div>
                  {f.verified && <BadgeCheck className="h-4 w-4 text-brand-600" />}
                  <Badge variant="outline" className={f.status === 'pending' ? 'border-amber-300 bg-amber-50 text-amber-800' : f.status === 'approved' ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-red-300 bg-red-50 text-red-800'}>
                    {f.status}
                  </Badge>
                </div>
                <div className="text-xs text-neutral-500">{f.type} · {f.address}</div>
                <div className="mt-1 text-xs text-neutral-600">
                  {f.accepted?.length > 0 && <span><b>Accepts:</b> {f.accepted.slice(0, 5).join(', ')}{f.accepted.length > 5 ? '…' : ''}</span>}
                </div>
                {f.notAccepted?.length > 0 && <div className="text-xs text-red-700"><b>No:</b> {f.notAccepted.slice(0, 4).join(', ')}</div>}
                {f.contractorNotes?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {f.contractorNotes.slice(0, 5).map((n) => <span key={n} className="rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800">{n}</span>)}
                  </div>
                )}
                <div className="mt-1 text-[11px] text-neutral-400">Submitted {f.submittedAt ? new Date(f.submittedAt).toLocaleDateString() : '—'} · by {f.submittedBy || 'guest'}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {f.status !== 'approved' && <Button size="sm" onClick={() => moderate(f.id, { status: 'approved' })} className="bg-brand-600 hover:bg-brand-700"><CheckCircle2 className="mr-1 h-4 w-4" /> Approve</Button>}
                {f.status !== 'rejected' && <Button size="sm" variant="outline" onClick={() => moderate(f.id, { status: 'rejected' })} className="border-red-300 text-red-700"><XCircle className="mr-1 h-4 w-4" /> Reject</Button>}
                {!f.verified && <Button size="sm" variant="outline" onClick={() => moderate(f.id, { verified: true })}><BadgeCheck className="mr-1 h-4 w-4" /> Verify</Button>}
                <Button size="sm" variant="outline" onClick={() => setGrantsFor(f)} className="border-violet-300 text-violet-700 hover:bg-violet-50"><ToggleRight className="mr-1 h-4 w-4" /> Features</Button>
                <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => { if (confirm('Delete this facility permanently?')) moderate(f.id, { delete: true }) }}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Phase B — per-facility feature grants drawer */}
      <FeatureGrantsDrawer
        open={!!grantsFor}
        onClose={() => setGrantsFor(null)}
        scope="facility"
        scopeId={grantsFor?.id}
        scopeLabel={grantsFor?.name || grantsFor?.id}
        onChange={() => load()}
      />
    </div>
  )
}
