'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { CheckCircle2, XCircle, MessageSquare, RotateCcw, ExternalLink } from 'lucide-react'

export default function AdminFacilityClaims() {
  const { authFetch } = useAdmin()
  const [status, setStatus] = useState('pending')
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    const r = await authFetch(`/api/admin/facility-claims?${p}`)
    const j = await r.json()
    setClaims(j.claims || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [status])

  const act = async (id, action) => {
    const adminNote = (action === 'reject' || action === 'needs_more_info' || action === 'revoke') ? (prompt('Admin note for the claimant:', '') || '') : ''
    const r = await authFetch(`/api/admin/facility-claims/${id}`, { method: 'PATCH', body: JSON.stringify({ action, adminNote }) })
    if (r.ok) { toast.success(action); load() } else { const j = await r.json(); toast.error(j.error || 'Failed') }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Facility Claims</h1>
          <p className="text-sm text-neutral-500">Verify business owners and grant ownership of facility listings.</p>
        </div>
        <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="needs_more_info">Needs more info</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && <div className="rounded-lg border border-dashed p-6 text-center text-neutral-500">Loading…</div>}
      {!loading && claims.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-neutral-500">No claims to show.</div>}
      <div className="space-y-2">
        {claims.map((c) => {
          const statusColor = {
            pending:         'border-amber-300 bg-amber-50 text-amber-800',
            needs_more_info: 'border-amber-300 bg-amber-50 text-amber-800',
            approved:        'border-brand-300 bg-brand-50 text-brand-800',
            rejected:        'border-red-300 bg-red-50 text-red-700',
            revoked:         'border-neutral-300 bg-neutral-50 text-neutral-600',
          }[c.status] || ''
          return (
            <Card key={c.id}>
              <CardContent className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold">{c.claimantName || c.userEmail}</div>
                      <Badge variant="outline" className={statusColor}>{c.status}</Badge>
                      <Link href={`/facilities/${c.facilityId}`} className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                        {c.facilityName} <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="mt-1 grid grid-cols-1 gap-x-3 gap-y-0.5 text-xs text-neutral-700 md:grid-cols-2">
                      <div><b>Role:</b> {c.businessRole || '—'}</div>
                      <div><b>Business email:</b> {c.businessEmail || '—'}</div>
                      <div><b>Phone:</b> {c.phone || '—'}</div>
                      <div><b>Website:</b> {c.website || '—'}</div>
                      <div className="md:col-span-2"><b>Proof notes:</b> <span className="italic">{c.proofNotes || '—'}</span></div>
                      {c.message && <div className="md:col-span-2"><b>Message:</b> {c.message}</div>}
                      {c.adminNote && <div className="md:col-span-2"><b>Admin note:</b> {c.adminNote}</div>}
                    </div>
                    <div className="mt-1 text-[11px] text-neutral-400">Account: {c.userEmail} · Submitted {new Date(c.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['pending', 'needs_more_info'].includes(c.status) && (
                      <>
                        <Button size="sm" onClick={() => act(c.id, 'approve')} className="bg-brand-600 hover:bg-brand-700"><CheckCircle2 className="mr-1 h-4 w-4" /> Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => act(c.id, 'needs_more_info')}><MessageSquare className="mr-1 h-4 w-4" /> Request info</Button>
                        <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => act(c.id, 'reject')}><XCircle className="mr-1 h-4 w-4" /> Reject</Button>
                      </>
                    )}
                    {c.status === 'approved' && (
                      <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => act(c.id, 'revoke')}><RotateCcw className="mr-1 h-4 w-4" /> Revoke ownership</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
