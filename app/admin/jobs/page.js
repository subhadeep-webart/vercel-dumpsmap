'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Search, Star, CheckCircle2, Flame, Trash2 } from 'lucide-react'

export default function AdminJobs() {
  const { authFetch } = useAdmin()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (status) p.set('status', status); if (q) p.set('q', q)
    const r = await authFetch(`/api/admin/jobs?${p}`)
    const j = await r.json()
    setJobs(j.jobs || []); setLoading(false)
  }
  useEffect(() => { load() }, [status])

  const act = async (id, action) => {
    const r = await authFetch(`/api/admin/jobs/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) })
    if (r.ok) { toast.success(action); load() } else toast.error('Failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Jobs & Hot Spots</h1>
          <p className="text-sm text-neutral-500">Verify jobs, feature urgent posts, remove fake jobs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Search…" className="w-56 pl-8" />
          </div>
          <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="pending_verification">Pending verify</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="removed">Removed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {loading && <div className="rounded-lg border border-dashed p-6 text-center text-neutral-500">Loading…</div>}
        {!loading && jobs.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-neutral-500">No jobs.</div>}
        {jobs.map((j) => (
          <div key={j.id} className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{j.title}</div>
                  <Badge variant="outline">{j.status}</Badge>
                  {j.hotSpot && <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-800"><Flame className="mr-1 h-3 w-3" />Hot</Badge>}
                  {j.featured && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                </div>
                <div className="text-xs text-neutral-500">{j.category} · {j.urgency || 'normal'} · {j.location || '—'}</div>
                {j.description && <div className="mt-1 line-clamp-2 text-xs text-neutral-600">{j.description}</div>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {j.status === 'pending_verification' && <Button size="sm" onClick={() => act(j.id, 'verify')} className="bg-brand-600 hover:bg-brand-700"><CheckCircle2 className="mr-1 h-4 w-4" /> Verify</Button>}
                <Button size="sm" variant="outline" onClick={() => act(j.id, j.featured ? 'unfeature' : 'feature')}><Star className="mr-1 h-4 w-4" /> {j.featured ? 'Unfeature' : 'Feature'}</Button>
                <Button size="sm" variant="outline" onClick={() => act(j.id, 'mark_completed')}>Mark done</Button>
                <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => act(j.id, 'remove')}><Trash2 className="mr-1 h-4 w-4" /> Remove</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
