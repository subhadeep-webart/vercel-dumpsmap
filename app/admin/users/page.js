'use client'

// Admin → Users V2
// ---------------------------------------------------------------------------
// Full bulk-ops console:
//   • Selection (checkbox per row + select-all)
//   • Bulk: role / verification / membership / suspend / archive / tags / trial / email / soft-delete
//   • Filters: q, role, verification, membership, status, company, createdFrom/To, lastLoginFrom/To, tag, onTrial
//   • Tag chips on each row
//   • CSV export (respects current filters)
//   • Super-admin-only permanent purge (type-to-confirm)
//
// All bulk endpoints log to admin_audit_log via the backend handler.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAdmin } from '@/components/admin/AdminContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Search, Shield, Ban, UserCheck, Archive, Trash2, Mail, Tag as TagIcon,
  Download, RotateCcw, Filter, Loader2, AlertTriangle, ChevronDown, Clock,
  CheckCircle2, MoreHorizontal, Building2, Award, Hammer, ToggleRight,
} from 'lucide-react'
import FeatureGrantsDrawer from '@/components/admin/FeatureGrantsDrawer'

const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString() } catch { return '—' } }
const fmtRelDate = (d) => { if (!d) return '—'; try { const ms = Date.now() - new Date(d).getTime(); const days = Math.floor(ms / 86400000); if (days < 1) return 'today'; if (days < 30) return `${days}d ago`; if (days < 365) return `${Math.floor(days / 30)}mo ago`; return `${Math.floor(days / 365)}y ago` } catch { return '—' } }

const STATUS_STYLE = {
  active:    { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200',  label: 'Active' },
  suspended: { cls: 'bg-amber-100 text-amber-800 border-amber-200',         label: 'Suspended' },
  archived:  { cls: 'bg-neutral-200 text-neutral-700 border-neutral-300',   label: 'Archived' },
  deleted:   { cls: 'bg-red-100 text-red-800 border-red-200',               label: 'Deleted' },
}

const MEMBERSHIP_STYLE = {
  free:                { cls: 'bg-neutral-100 text-neutral-700 border-neutral-200',   label: 'Free' },
  verified_commercial: { cls: 'bg-blue-100 text-blue-800 border-blue-200',             label: 'Verified' },
  pro_commercial:      { cls: 'bg-amber-100 text-amber-900 border-amber-200',          label: 'Pro' },
  enterprise:          { cls: 'bg-purple-100 text-purple-800 border-purple-200',       label: 'Enterprise' },
  // legacy fallback during migration window
  verified:            { cls: 'bg-blue-100 text-blue-800 border-blue-200',             label: 'Verified (legacy)' },
  pro:                 { cls: 'bg-amber-100 text-amber-900 border-amber-200',          label: 'Pro (legacy)' },
}

const TAG_STYLE = {
  'test-account':      'bg-yellow-100 text-yellow-800 border-yellow-200',
  vendor:              'bg-indigo-100 text-indigo-800 border-indigo-200',
  reseller:            'bg-pink-100 text-pink-800 border-pink-200',
  contractor:          'bg-blue-100 text-blue-800 border-blue-200',
  'facility-owner':    'bg-emerald-100 text-emerald-800 border-emerald-200',
  'property-manager':  'bg-cyan-100 text-cyan-800 border-cyan-200',
  recycler:            'bg-lime-100 text-lime-800 border-lime-200',
}

function StatusBadge({ status }) { const cfg = STATUS_STYLE[status] || STATUS_STYLE.active; return <Badge variant="outline" className={`border ${cfg.cls}`}>{cfg.label}</Badge> }
function MembershipBadge({ m }) { const k = m || 'free'; const cfg = MEMBERSHIP_STYLE[k] || MEMBERSHIP_STYLE.free; return <Badge variant="outline" className={`border ${cfg.cls}`}>{cfg.label}</Badge> }

export default function AdminUsersV2() {
  const { authFetch, isSuperAdmin } = useAdmin()
  // Filters
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [verification, setVerification] = useState('')
  const [membership, setMembership] = useState('')
  const [status, setStatus] = useState('')
  const [company, setCompany] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [lastLoginFrom, setLastLoginFrom] = useState('')
  const [lastLoginTo, setLastLoginTo] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [onTrial, setOnTrial] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Data
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [facets, setFacets] = useState({})
  const [meta, setMeta] = useState({ statuses: [], roles: [], memberships: [], tags: [], verificationLevels: [] })
  const [loading, setLoading] = useState(false)

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set())
  const allSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id))

  // Dialog state
  const [bulkAction, setBulkAction] = useState(null) // 'role'|'verification'|'membership'|'suspend'|'archive'|'tags'|'trial'|'email'|'delete'
  const [purgeFor, setPurgeFor] = useState(null) // user object
  const [grantsFor, setGrantsFor] = useState(null) // user object → opens FeatureGrantsDrawer

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ limit: '200' })
    if (q) p.set('q', q)
    if (role) p.set('role', role)
    if (verification) p.set('verification', verification)
    if (membership) p.set('membership', membership)
    if (status) p.set('status', status)
    if (company) p.set('company', company)
    if (createdFrom) p.set('createdFrom', createdFrom)
    if (createdTo) p.set('createdTo', createdTo)
    if (lastLoginFrom) p.set('lastLoginFrom', lastLoginFrom)
    if (lastLoginTo) p.set('lastLoginTo', lastLoginTo)
    if (tagFilter) p.set('tag', tagFilter)
    if (onTrial) p.set('onTrial', 'true')
    if (includeArchived) p.set('includeArchived', 'true')
    if (includeDeleted) p.set('includeDeleted', 'true')
    return p
  }, [q, role, verification, membership, status, company, createdFrom, createdTo, lastLoginFrom, lastLoginTo, tagFilter, onTrial, includeArchived, includeDeleted])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await authFetch(`/api/admin/users/v2?${buildParams()}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Load failed')
      setUsers(j.users || []); setTotal(j.total || 0); setFacets(j.facets || {}); setMeta(j.filterMeta || {})
      setSelectedIds(new Set())
    } catch (e) { toast.error(e.message || 'Load failed') } finally { setLoading(false) }
  }, [authFetch, buildParams])

  useEffect(() => { load() }, [role, verification, membership, status, tagFilter, onTrial, includeArchived, includeDeleted]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (id) => setSelectedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSelectAll = () => setSelectedIds((s) => allSelected ? new Set() : new Set(users.map((u) => u.id)))

  const exportCSV = async () => {
    try {
      const r = await authFetch(`/api/admin/users/export?${buildParams()}`)
      if (!r.ok) { toast.error('Export failed'); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `dumpmaps_users_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      toast.success(`Exported ${total} users`)
    } catch (e) { toast.error(e.message || 'Export failed') }
  }

  const ids = useMemo(() => Array.from(selectedIds), [selectedIds])

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Users</h1>
          <p className="text-sm text-neutral-600">Bulk-manage roles, verification, membership, tags, suspension, and archival. Export to CSV anytime.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/memberships" className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50">
            <Building2 className="h-3.5 w-3.5" /> Memberships dashboard
          </Link>
          <Button onClick={exportCSV} variant="outline" size="sm" className="h-9">
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={load} variant="outline" size="sm" className="h-9" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Search bar + facet summary */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Search email, name, company…" className="h-9 pl-8" />
        </div>
        <Button onClick={load} className="h-9 bg-brand-600 hover:bg-brand-700">Search</Button>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="h-9">
          <Filter className="mr-1 h-3.5 w-3.5" /> Filters
          {(role || verification || membership || status || company || tagFilter || createdFrom || createdTo || lastLoginFrom || lastLoginTo || onTrial) && (
            <span className="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">Active</span>
          )}
          <ChevronDown className={`ml-1 h-3.5 w-3.5 transition ${showFilters ? 'rotate-180' : ''}`} />
        </Button>
        <span className="ml-auto text-xs text-neutral-600">
          {loading ? 'Loading…' : <><b>{users.length}</b> shown · <b>{total}</b> total</>}
        </span>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-2 md:grid-cols-4">
          <FilterSelect label="Role" value={role} onChange={setRole} options={['', ...(meta.roles || [])]} />
          <FilterSelect label="Verification" value={verification} onChange={setVerification} options={['', ...(meta.verificationLevels || [])]} />
          <FilterSelect label="Membership" value={membership} onChange={setMembership} options={['', ...(meta.memberships || [])]} />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={['', ...(meta.statuses || [])]} />
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Company</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} className="mt-0.5 h-8" placeholder="Acme…" />
          </div>
          <FilterSelect label="Tag" value={tagFilter} onChange={setTagFilter} options={['', ...(meta.tags || [])]} />
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Created</Label>
            <div className="mt-0.5 flex gap-1">
              <Input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} className="h-8 text-xs" />
              <Input type="date" value={createdTo}   onChange={(e) => setCreatedTo(e.target.value)}   className="h-8 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Last Login</Label>
            <div className="mt-0.5 flex gap-1">
              <Input type="date" value={lastLoginFrom} onChange={(e) => setLastLoginFrom(e.target.value)} className="h-8 text-xs" />
              <Input type="date" value={lastLoginTo}   onChange={(e) => setLastLoginTo(e.target.value)}   className="h-8 text-xs" />
            </div>
          </div>
          <div className="col-span-2 flex flex-wrap items-center gap-3 md:col-span-4">
            <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={onTrial} onChange={(e) => setOnTrial(e.target.checked)} /> On trial only</label>
            <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} /> Include archived</label>
            <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} /> Include deleted</label>
            <Button size="sm" onClick={load} className="ml-auto h-7 bg-brand-600 px-2 hover:bg-brand-700">Apply</Button>
            <Button size="sm" variant="ghost" onClick={() => { setRole(''); setVerification(''); setMembership(''); setStatus(''); setCompany(''); setCreatedFrom(''); setCreatedTo(''); setLastLoginFrom(''); setLastLoginTo(''); setTagFilter(''); setOnTrial(false); setIncludeArchived(false); setIncludeDeleted(false) }} className="h-7 px-2">Reset</Button>
          </div>
        </div>
      )}

      {/* Bulk toolbar */}
      {ids.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 p-2 shadow-sm">
          <span className="px-2 text-sm font-bold text-brand-900">{ids.length} selected</span>
          <Button size="sm" onClick={() => setBulkAction('role')}        variant="outline" className="h-8 text-xs"><Shield className="mr-1 h-3.5 w-3.5" /> Role</Button>
          <Button size="sm" onClick={() => setBulkAction('verification')} variant="outline" className="h-8 text-xs"><UserCheck className="mr-1 h-3.5 w-3.5" /> Verify</Button>
          <Button size="sm" onClick={() => setBulkAction('membership')}   variant="outline" className="h-8 text-xs"><Award className="mr-1 h-3.5 w-3.5" /> Membership</Button>
          <Button size="sm" onClick={() => setBulkAction('tags')}         variant="outline" className="h-8 text-xs"><TagIcon className="mr-1 h-3.5 w-3.5" /> Tags</Button>
          <Button size="sm" onClick={() => setBulkAction('trial')}        variant="outline" className="h-8 text-xs"><Clock className="mr-1 h-3.5 w-3.5" /> Trial</Button>
          <Button size="sm" onClick={() => setBulkAction('email')}        variant="outline" className="h-8 text-xs"><Mail className="mr-1 h-3.5 w-3.5" /> Email</Button>
          <Button size="sm" onClick={() => setBulkAction('suspend')}      variant="outline" className="h-8 border-amber-300 bg-amber-50 text-xs text-amber-900 hover:bg-amber-100"><Ban className="mr-1 h-3.5 w-3.5" /> Suspend</Button>
          <Button size="sm" onClick={() => setBulkAction('archive')}      variant="outline" className="h-8 border-neutral-300 text-xs"><Archive className="mr-1 h-3.5 w-3.5" /> Archive</Button>
          <Button size="sm" onClick={() => setBulkAction('delete')}       variant="outline" className="h-8 border-red-300 bg-red-50 text-xs text-red-800 hover:bg-red-100"><Trash2 className="mr-1 h-3.5 w-3.5" /> Soft-delete</Button>
          <Button size="sm" variant="ghost"   onClick={() => setSelectedIds(new Set())} className="ml-auto h-8 text-xs">Clear</Button>
        </div>
      )}

      {/* Users table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600">
              <tr>
                <th className="w-8 px-2 py-2"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Membership</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Last login</th>
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (<tr><td colSpan={10} className="p-8 text-center text-sm text-neutral-500"><Loader2 className="-mt-0.5 mr-1 inline h-4 w-4 animate-spin" /> Loading users…</td></tr>)}
              {!loading && users.length === 0 && (<tr><td colSpan={10} className="p-8 text-center text-sm text-neutral-500">No users match these filters.</td></tr>)}
              {!loading && users.map((u) => {
                const trialActive = u.commercialTrialEndsAt && new Date(u.commercialTrialEndsAt) > new Date()
                return (
                  <tr key={u.id} className={`border-b border-neutral-100 hover:bg-neutral-50 ${selectedIds.has(u.id) ? 'bg-brand-50/50' : ''}`}>
                    <td className="px-2 py-2"><input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} /></td>
                    <td className="px-3 py-2">
                      <div className="font-bold text-neutral-900">{u.name || u.email}</div>
                      <div className="text-[11px] text-neutral-500">{u.email}</div>
                    </td>
                    <td className="px-3 py-2 text-xs"><Badge variant="outline">{u.role || 'user'}</Badge>{u.verificationLevel && u.verificationLevel !== 'none' && <div className="mt-0.5 text-[10px] text-blue-700">{u.verificationLevel.replace(/_/g, ' ')}</div>}</td>
                    <td className="px-3 py-2 text-xs"><MembershipBadge m={u.commercialMembership} />{trialActive && <div className="mt-0.5 text-[10px] font-bold text-amber-700">Trial until {fmtDate(u.commercialTrialEndsAt)}</div>}</td>
                    <td className="px-3 py-2 text-xs"><StatusBadge status={u.accountStatus || 'active'} /></td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex flex-wrap gap-0.5">
                        {(u.tags || []).slice(0, 4).map((t) => (
                          <span key={t} className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${TAG_STYLE[t] || 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}>{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-700">{u.companyName || u.commercialCompanyName || <span className="text-neutral-400">—</span>}</td>
                    <td className="px-3 py-2 text-xs text-neutral-600" title={u.createdAt}>{fmtRelDate(u.createdAt)}</td>
                    <td className="px-3 py-2 text-xs text-neutral-600" title={u.lastLoginAt}>{fmtRelDate(u.lastLoginAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                      <Button onClick={() => setGrantsFor(u)} size="sm" variant="ghost" className="mr-1 h-6 px-1 text-xs text-violet-700 hover:bg-violet-50" title="Manage feature access">
                        <ToggleRight className="h-3 w-3" />
                      </Button>
                      <Link href={`/admin/users/${u.id}`} className="text-blue-700 hover:underline">Open</Link>
                      {isSuperAdmin && u.accountStatus === 'deleted' && (
                        <Button onClick={() => setPurgeFor(u)} size="sm" variant="ghost" className="ml-2 h-6 px-1 text-xs text-red-700 hover:bg-red-50">
                          <Trash2 className="h-3 w-3" /> Purge
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk action dialogs */}
      <BulkActionDialog
        action={bulkAction}
        userIds={ids}
        onClose={() => setBulkAction(null)}
        onDone={() => { setBulkAction(null); load() }}
        meta={meta}
        authFetch={authFetch}
      />
      <PurgeUserDialog user={purgeFor} onClose={() => setPurgeFor(null)} onDone={() => { setPurgeFor(null); load() }} authFetch={authFetch} />
      {/* Phase B — per-user feature grants drawer */}
      <FeatureGrantsDrawer
        open={!!grantsFor}
        onClose={() => setGrantsFor(null)}
        scope="user"
        scopeId={grantsFor?.id}
        scopeLabel={grantsFor?.email || grantsFor?.name || grantsFor?.id}
        onChange={() => load()}
      />
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-0.5 h-8 w-full rounded-md border border-neutral-300 bg-white px-2 text-xs">
        {options.map((o) => <option key={o} value={o}>{o === '' ? 'Any' : o.replace(/_/g, ' ')}</option>)}
      </select>
    </div>
  )
}

function BulkActionDialog({ action, userIds, onClose, onDone, meta, authFetch }) {
  const [busy, setBusy] = useState(false)
  const [role, setRole] = useState('user')
  const [verification, setVerification] = useState('none')
  const [membership, setMembership] = useState('free')
  const [addTags, setAddTags] = useState([])
  const [removeTags, setRemoveTags] = useState([])
  const [days, setDays] = useState(14)
  const [revokeTrial, setRevokeTrial] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [suspendReason, setSuspendReason] = useState('')
  const [unsuspend, setUnsuspend] = useState(false)
  const [unarchive, setUnarchive] = useState(false)

  useEffect(() => { if (action) { setBusy(false); setSubject(''); setBody(''); setSuspendReason(''); setUnsuspend(false); setUnarchive(false); setAddTags([]); setRemoveTags([]); setRevokeTrial(false) } }, [action])
  if (!action) return null

  const run = async () => {
    setBusy(true)
    try {
      let url = ''
      let payload = { userIds }
      switch (action) {
        case 'role':         url = '/api/admin/users/bulk/role';         payload.role = role; break
        case 'verification': url = '/api/admin/users/bulk/verification'; payload.verificationLevel = verification; break
        case 'membership':   url = '/api/admin/users/bulk/membership';   payload.membership = membership; break
        case 'suspend':      url = '/api/admin/users/bulk/suspend';      payload.suspend = !unsuspend; payload.reason = suspendReason; break
        case 'archive':      url = '/api/admin/users/bulk/archive';      payload.archive = !unarchive; break
        case 'tags':         url = '/api/admin/users/bulk/tags';         payload.addTags = addTags; payload.removeTags = removeTags; break
        case 'trial':        url = '/api/admin/users/bulk/trial';        if (revokeTrial) payload.revoke = true; else payload.days = days; break
        case 'email':        url = '/api/admin/users/bulk/email';        payload.subject = subject; payload.body = body; break
        case 'delete':       url = '/api/admin/users/bulk/delete'; break
        default: throw new Error('Unknown action')
      }
      const r = await authFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Action failed')
      toast.success(j.note || `Updated ${j.modified ?? j.recipientCount ?? userIds.length} users`)
      onDone()
    } catch (e) { toast.error(e.message || 'Action failed') } finally { setBusy(false) }
  }

  const titles = {
    role: 'Assign role', verification: 'Set verification level', membership: 'Change membership',
    suspend: 'Suspend / Unsuspend', archive: 'Archive / Restore', tags: 'Edit tags',
    trial: 'Grant / Revoke trial', email: 'Send bulk email', delete: 'Soft-delete (move to trash)',
  }

  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={action === 'email' ? 'max-w-xl' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle>{titles[action]}</DialogTitle>
          <DialogDescription>Applies to <b>{userIds.length}</b> selected user{userIds.length === 1 ? '' : 's'}.</DialogDescription>
        </DialogHeader>

        {action === 'role' && (<div><Label className="text-xs">New role</Label><select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 h-9 w-full rounded-md border px-2 text-sm">{(meta.roles || []).map((r) => <option key={r} value={r}>{r}</option>)}</select></div>)}
        {action === 'verification' && (<div><Label className="text-xs">Verification level</Label><select value={verification} onChange={(e) => setVerification(e.target.value)} className="mt-1 h-9 w-full rounded-md border px-2 text-sm">{(meta.verificationLevels || []).map((v) => <option key={v} value={v}>{v}</option>)}</select></div>)}
        {action === 'membership' && (<div><Label className="text-xs">New membership</Label><select value={membership} onChange={(e) => setMembership(e.target.value)} className="mt-1 h-9 w-full rounded-md border px-2 text-sm">{(meta.memberships || []).map((m) => <option key={m} value={m}>{m}</option>)}</select></div>)}

        {action === 'suspend' && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={unsuspend} onChange={(e) => setUnsuspend(e.target.checked)} /> Unsuspend instead (restore to active)</label>
            {!unsuspend && (<div><Label className="text-xs">Reason (internal)</Label><Textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} rows={2} maxLength={500} className="mt-1" /></div>)}
          </div>
        )}

        {action === 'archive' && (<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={unarchive} onChange={(e) => setUnarchive(e.target.checked)} /> Restore from archive instead</label>)}

        {action === 'tags' && (
          <div className="space-y-2">
            <div><Label className="text-xs">Add tags</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {(meta.tags || []).map((t) => (
                  <button key={t} type="button" onClick={() => setAddTags((a) => a.includes(t) ? a.filter((x) => x !== t) : [...a, t])} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${addTags.includes(t) ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-neutral-200 text-neutral-700'}`}>+{t}</button>
                ))}
              </div>
            </div>
            <div><Label className="text-xs">Remove tags</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {(meta.tags || []).map((t) => (
                  <button key={t} type="button" onClick={() => setRemoveTags((a) => a.includes(t) ? a.filter((x) => x !== t) : [...a, t])} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${removeTags.includes(t) ? 'border-red-400 bg-red-50 text-red-800' : 'border-neutral-200 text-neutral-700'}`}>−{t}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {action === 'trial' && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={revokeTrial} onChange={(e) => setRevokeTrial(e.target.checked)} /> Revoke trial instead</label>
            {!revokeTrial && (<div><Label className="text-xs">Trial length (days)</Label><Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-1 h-9" /></div>)}
          </div>
        )}

        {action === 'email' && (
          <div className="space-y-2">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-900"><AlertTriangle className="-mt-0.5 mr-0.5 inline h-3 w-3" /> Emails are <b>mocked</b> right now (stored in DB, not sent). Real delivery activates once SendGrid/Resend is configured.</div>
            <div><Label className="text-xs">Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className="mt-1 h-9" /></div>
            <div><Label className="text-xs">Body</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} maxLength={10000} className="mt-1" /></div>
          </div>
        )}

        {action === 'delete' && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-900">
            <AlertTriangle className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            This moves users to the Trash. Their content stays visible but flagged. A Super Admin can permanently purge them later. <b>This is NOT a hard delete.</b>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={run} disabled={busy || (action === 'email' && (!subject || !body))} className="bg-brand-600 hover:bg-brand-700">
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PurgeUserDialog({ user, onClose, onDone, authFetch }) {
  const [emailConfirm, setEmailConfirm] = useState('')
  const [understand, setUnderstand] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (user) { setEmailConfirm(''); setUnderstand(false) } }, [user])
  if (!user) return null
  const canPurge = emailConfirm.trim().toLowerCase() === String(user.email || '').toLowerCase() && understand
  const run = async () => {
    setBusy(true)
    try {
      const r = await authFetch(`/api/admin/users/${user.id}/purge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmEmail: emailConfirm, iUnderstandIrreversible: true }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Purge failed')
      toast.success(`Purged ${j.purgedEmail} (cascade: ${Object.values(j.cascade || {}).reduce((a, b) => a + b, 0)} related records flagged)`)
      onDone()
    } catch (e) { toast.error(e.message || 'Purge failed') } finally { setBusy(false) }
  }
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-5 w-5" /> Permanently purge user</DialogTitle>
          <DialogDescription>This is irreversible. The user document will be hard-deleted; their listings, jobs, alerts, inspections, and receipts will be flagged as removed (preserving audit trail).</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs"><b>{user.name || user.email}</b><div className="text-neutral-700">{user.email}</div></div>
        <div><Label className="text-xs">Type the user's email to confirm</Label><Input value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} placeholder={user.email} className="mt-1 h-9 font-mono" /></div>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={understand} onChange={(e) => setUnderstand(e.target.checked)} className="mt-0.5" /><span>I understand this is <b>irreversible</b> and that all related content will be flagged as removed.</span></label>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={run} disabled={!canPurge || busy} className="bg-red-600 text-white hover:bg-red-700">
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />} Permanently purge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
