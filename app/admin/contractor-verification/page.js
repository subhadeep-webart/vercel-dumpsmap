'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { BadgeCheck, CheckCircle2, XCircle, FileText } from 'lucide-react'

export default function AdminContractorVerification() {
  const { authFetch } = useAdmin()
  const [users, setUsers] = useState([])
  const [verifications, setVerifications] = useState([])
  const [editing, setEditing] = useState(null)
  const [statusFilter, setStatusFilter] = useState('pending')

  const loadUsers = async () => {
    const r = await authFetch('/api/admin/users?limit=200')
    const j = await r.json()
    setUsers(j.users || [])
  }
  const loadVerifications = async () => {
    const p = new URLSearchParams()
    if (statusFilter) p.set('status', statusFilter)
    const r = await authFetch(`/api/admin/contractor-verifications?${p}`)
    const j = await r.json()
    setVerifications(j.verifications || [])
  }
  useEffect(() => { loadUsers() }, [])
  useEffect(() => { loadVerifications() }, [statusFilter])

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  const submit = async (payload) => {
    const r = await authFetch('/api/admin/contractor-verifications', { method: 'POST', body: JSON.stringify(payload) })
    if (r.ok) { toast.success('Saved'); setEditing(null); loadVerifications(); loadUsers() } else toast.error('Failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Contractor Verification</h1>
          <p className="text-sm text-neutral-500">License, insurance, business, service area, payout eligibility.</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setEditing({ userId: '', status: 'pending' })}><BadgeCheck className="mr-1 h-4 w-4" /> New verification</Button>
        </div>
      </div>

      <div className="space-y-2">
        {verifications.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-neutral-500">No verifications.</div>}
        {verifications.map((v) => {
          const u = userMap[v.userId] || {}
          return (
            <Card key={v.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{v.businessName || u.name || u.email || v.userId}</div>
                    <Badge variant="outline" className={v.status === 'approved' ? 'border-brand-300 bg-brand-50 text-brand-800' : v.status === 'rejected' ? 'border-red-300 bg-red-50 text-red-700' : 'border-amber-300 bg-amber-50 text-amber-800'}>{v.status}</Badge>
                    {v.payoutEligible && <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800">Payout eligible</Badge>}
                  </div>
                  <div className="text-xs text-neutral-500">{u.email || v.email}</div>
                  <div className="mt-1 grid grid-cols-1 gap-x-3 gap-y-0.5 text-xs text-neutral-700 md:grid-cols-2">
                    <div><b>License:</b> {v.licenseNumber || '—'}</div>
                    <div><b>Insurance:</b> {v.insuranceProvider || '—'} {v.insurancePolicy && `(${v.insurancePolicy})`}</div>
                    <div><b>Phone:</b> {v.phone || '—'}</div>
                    <div><b>Service area:</b> {(v.serviceArea || []).join(', ') || '—'}</div>
                    <div><b>Documents:</b> {(v.documents || []).length || 0}</div>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing(v)}>Review</Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Contractor verification</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold">User ID</div>
                <Input value={editing.userId || ''} onChange={(e) => setEditing({ ...editing, userId: e.target.value })} placeholder="User UUID" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><div className="mb-1 text-xs font-semibold">License #</div><Input value={editing.licenseNumber || ''} onChange={(e) => setEditing({ ...editing, licenseNumber: e.target.value })} /></div>
                <div><div className="mb-1 text-xs font-semibold">Business name</div><Input value={editing.businessName || ''} onChange={(e) => setEditing({ ...editing, businessName: e.target.value })} /></div>
                <div><div className="mb-1 text-xs font-semibold">Insurance provider</div><Input value={editing.insuranceProvider || ''} onChange={(e) => setEditing({ ...editing, insuranceProvider: e.target.value })} /></div>
                <div><div className="mb-1 text-xs font-semibold">Policy #</div><Input value={editing.insurancePolicy || ''} onChange={(e) => setEditing({ ...editing, insurancePolicy: e.target.value })} /></div>
                <div><div className="mb-1 text-xs font-semibold">Phone</div><Input value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                <div><div className="mb-1 text-xs font-semibold">Email</div><Input value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold">Service area (comma-separated)</div>
                <Input
                  value={(editing.serviceArea || []).join(', ')}
                  onChange={(e) => setEditing({ ...editing, serviceArea: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  placeholder="San Jose, Sunnyvale, Santa Clara"
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-neutral-200 p-2">
                <div className="text-sm font-semibold">Payout eligible</div>
                <Switch checked={!!editing.payoutEligible} onCheckedChange={(v) => setEditing({ ...editing, payoutEligible: v })} />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => submit({ ...editing, status: 'approved' })} className="flex-1 bg-brand-600 hover:bg-brand-700"><CheckCircle2 className="mr-1 h-4 w-4" /> Approve</Button>
                <Button onClick={() => submit({ ...editing, status: 'rejected' })} variant="outline" className="flex-1 border-red-300 text-red-700"><XCircle className="mr-1 h-4 w-4" /> Reject</Button>
                <Button onClick={() => submit({ ...editing, status: 'pending' })} variant="outline" className="flex-1">Save as pending</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
