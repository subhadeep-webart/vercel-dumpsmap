'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Search, KeyRound } from 'lucide-react'

const FEATURES = [
  { key: 'claimListing',   label: 'Claim listing' },
  { key: 'updatePricing',  label: 'Update pricing' },
  { key: 'postClosures',   label: 'Post closures' },
  { key: 'manageMessages', label: 'Manage messages' },
  { key: 'paymentPilot',   label: 'Accept payment pilot' },
  { key: 'uploadDocs',     label: 'Upload documents' },
]

export default function AdminFacilityOwners() {
  const { authFetch } = useAdmin()
  const [q, setQ] = useState('')
  const [users, setUsers] = useState([])
  const [editing, setEditing] = useState(null)

  const load = async () => {
    const p = new URLSearchParams({ limit: '200' })
    if (q) p.set('q', q)
    const r = await authFetch(`/api/admin/users?${p}`)
    const j = await r.json()
    // narrow to facility-owner-ish users
    const filtered = (j.users || []).filter((u) => u.verificationLevel === 'verified_facility_owner' || (u.ownedFacilities && u.ownedFacilities.length > 0) || u.role !== 'normal_user' || u.facilityOwnerFlags)
    setUsers(filtered.length ? filtered : (j.users || []))
  }
  useEffect(() => { load() }, [])

  const saveFlags = async (userId, flags) => {
    const r = await authFetch(`/api/admin/facility-owner-flags/${userId}`, { method: 'PATCH', body: JSON.stringify(flags) })
    if (r.ok) { toast.success('Saved'); setEditing(null); load() }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Facility Owner Tools</h1>
          <p className="text-sm text-neutral-500">Per-user feature flags. Platform-wide defaults live in <a className="text-brand-700 hover:underline" href="/admin/platform-settings">Platform Settings</a>.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Search…" className="w-56 pl-8" />
          </div>
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Verification</th>
              <th className="px-3 py-2">Owned facilities</th>
              <th className="px-3 py-2">Enabled features</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-500">No users.</td></tr>}
            {users.map((u) => {
              const flags = u.facilityOwnerFlags || {}
              const on = Object.entries(flags).filter(([k, v]) => v).map(([k]) => k)
              return (
                <tr key={u.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    <div className="font-medium">{u.name || '—'}</div>
                    <div className="text-xs text-neutral-500">{u.email}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-600">{u.verificationLevel?.replace('_', ' ') || 'none'}</td>
                  <td className="px-3 py-2 text-xs">{(u.ownedFacilities || []).length}</td>
                  <td className="px-3 py-2">
                    {on.length === 0 ? <span className="text-xs text-neutral-400">none</span> : (
                      <div className="flex flex-wrap gap-1">{on.map((k) => <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(u)}><KeyRound className="mr-1 h-4 w-4" /> Permissions</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing?.email} — permissions</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-1">
              {FEATURES.map((f) => {
                const flags = editing.facilityOwnerFlags || {}
                return (
                  <div key={f.key} className="flex items-center justify-between border-b border-neutral-100 py-2">
                    <div className="text-sm font-medium">{f.label}</div>
                    <Switch checked={!!flags[f.key]} onCheckedChange={(v) => setEditing({ ...editing, facilityOwnerFlags: { ...flags, [f.key]: v } })} />
                  </div>
                )
              })}
              <Button onClick={() => saveFlags(editing.id, editing.facilityOwnerFlags || {})} className="mt-3 w-full">Save permissions</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
