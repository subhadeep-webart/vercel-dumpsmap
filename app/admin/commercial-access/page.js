'use client'

// Admin → Commercial Access queue
// ---------------------------------------------------------------------------
// Manages /api/admin/commercial-access applications.
// Columns: Applicant | Role | Company | Website | Phone | Status | Date
// Actions: Approve · Deny · Request More Info · Suspend Access · View detail

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Building2, CheckCircle2, XCircle, AlertCircle, Pause, RefreshCw, ExternalLink,
  Phone, Globe, Loader2, ShieldCheck, Mail, Search, Clock, Hammer, Award,
} from 'lucide-react'

const STATUS_TABS = [
  { key: 'pending',        label: 'Pending review',    color: 'amber' },
  { key: 'info_requested', label: 'Info requested',    color: 'blue' },
  { key: 'approved',       label: 'Approved',          color: 'emerald' },
  { key: 'denied',         label: 'Denied',            color: 'red' },
  { key: 'suspended',      label: 'Suspended',         color: 'neutral' },
  { key: 'all',            label: 'All',               color: 'neutral' },
]

const STATUS_BADGE = {
  pending:        { cls: 'bg-amber-100 text-amber-800 border-amber-200',     label: 'Pending' },
  info_requested: { cls: 'bg-blue-100 text-blue-800 border-blue-200',         label: 'Info requested' },
  approved:       { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Approved' },
  denied:         { cls: 'bg-red-100 text-red-800 border-red-200',             label: 'Denied' },
  suspended:      { cls: 'bg-neutral-200 text-neutral-700 border-neutral-300', label: 'Suspended' },
}

const ROLE_LABEL = {
  vendor: 'Vendor',
  facility_owner: 'Facility Owner',
  property_manager: 'Property Manager',
}

function fmtDate(d) { try { return new Date(d).toLocaleString() } catch { return '—' } }
function fmtShortDate(d) { try { return new Date(d).toLocaleDateString() } catch { return '—' } }

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || { cls: 'bg-neutral-100 text-neutral-700 border-neutral-200', label: status || '—' }
  return <Badge variant="outline" className={`border ${cfg.cls}`}>{cfg.label}</Badge>
}

function ActionDialog({ open, onClose, action, application, onConfirm, submitting }) {
  const [note, setNote] = useState('')
  useEffect(() => { if (open) setNote('') }, [open])
  if (!action || !application) return null
  const titleMap = {
    approve:      { title: 'Approve commercial access', desc: 'This applicant will gain full B2B posting, messaging, offer, and reserve permissions.', cta: 'Approve', tone: 'bg-emerald-600 hover:bg-emerald-700', icon: CheckCircle2 },
    deny:         { title: 'Deny application', desc: 'Mark this application as denied. The applicant can re-apply later.', cta: 'Deny', tone: 'bg-red-600 hover:bg-red-700', icon: XCircle },
    request_info: { title: 'Request more information', desc: 'Mark this application as needing more info. Add a note describing what you need.', cta: 'Send request', tone: 'bg-blue-600 hover:bg-blue-700', icon: AlertCircle },
    suspend:      { title: 'Suspend commercial access', desc: 'Revoke commercial posting and messaging permissions for this user.', cta: 'Suspend', tone: 'bg-neutral-700 hover:bg-neutral-800', icon: Pause },
  }
  const cfg = titleMap[action]
  const Icon = cfg.icon
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Icon className="h-5 w-5" /> {cfg.title}</DialogTitle>
          <DialogDescription>{cfg.desc}</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2.5 text-xs">
          <div className="font-bold text-neutral-900">{application.companyName || '(no company)'}</div>
          <div className="text-neutral-600">{application.userEmail} · requested role: <b>{ROLE_LABEL[application.requestedRole] || application.requestedRole}</b></div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-600">Internal note {action === 'request_info' ? '(visible to applicant in future)' : '(optional)'}</label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder={action === 'request_info' ? 'What additional info do you need? e.g., proof of business license' : 'Optional reason or context for the decision log'} className="mt-1" />
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="button" onClick={() => onConfirm(note)} disabled={submitting} className={`text-white ${cfg.tone}`}>
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Icon className="mr-1 h-4 w-4" />}
            {cfg.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminCommercialAccessPage() {
  const { authFetch } = useAdmin()
  const [tab, setTab] = useState('pending')
  const [search, setSearch] = useState('')
  const [apps, setApps] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(false)
  const [openAction, setOpenAction] = useState(null)   // { action, application }
  const [submittingAction, setSubmittingAction] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: tab })
      const r = await authFetch(`/api/admin/commercial-access?${params}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed to load')
      setApps(j.applications || [])
      setCounts(j.counts || {})
    } catch (e) {
      toast.error(e.message || 'Failed to load')
    } finally { setLoading(false) }
  }, [authFetch, tab])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!search.trim()) return apps
    const s = search.trim().toLowerCase()
    return apps.filter((a) =>
      (a.userEmail || '').toLowerCase().includes(s) ||
      (a.userName || '').toLowerCase().includes(s) ||
      (a.companyName || '').toLowerCase().includes(s) ||
      (a.website || '').toLowerCase().includes(s)
    )
  }, [apps, search])

  const handleAction = (action, application) => setOpenAction({ action, application })

  const confirmAction = async (note) => {
    if (!openAction) return
    setSubmittingAction(true)
    try {
      const r = await authFetch(`/api/admin/commercial-access/${openAction.application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: openAction.action, note: note || undefined }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Action failed')
      toast.success(`Application ${openAction.action.replace('_', ' ')}d`)
      setOpenAction(null)
      load()
    } catch (e) {
      toast.error(e.message || 'Action failed')
    } finally { setSubmittingAction(false) }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-indigo-600" />
          <h1 className="text-2xl font-extrabold tracking-tight">Commercial Access Queue</h1>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Review applications for B2B marketplace posting access. Vendors, facility owners, and property managers who don't auto-qualify (via existing verified contractor/recycler status) land here for manual review.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1.5">
        {STATUS_TABS.map((t) => {
          const active = tab === t.key
          const n = counts[t.key] ?? (t.key === 'all' ? null : 0)
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold transition ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-700 hover:bg-neutral-100'}`}
            >
              {t.label}
              {n != null && (
                <span className={`ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-neutral-200 text-neutral-700'}`}>{n}</span>
              )}
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by email, name, company…" className="h-8 w-64 pl-8 text-xs" />
          </div>
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600">
              <tr>
                <th className="px-3 py-2">Applicant</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Website</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="p-8 text-center text-sm text-neutral-500"><Loader2 className="-mt-0.5 mr-1 inline h-4 w-4 animate-spin" /> Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-sm text-neutral-500">No applications in this state.</td></tr>
              )}
              {!loading && filtered.map((a) => {
                const enableApprove = a.status !== 'approved'
                const enableDeny = a.status !== 'denied'
                const enableSuspend = a.currentUser?.commercialAccessStatus !== 'suspended'
                return (
                  <tr key={a.id} className="border-b border-neutral-100 align-top hover:bg-neutral-50">
                    <td className="px-3 py-3">
                      <div className="font-bold text-neutral-900">{a.userName || '—'}</div>
                      <a href={`mailto:${a.userEmail}`} className="flex items-center gap-1 text-xs text-blue-700 hover:underline">
                        <Mail className="h-3 w-3" /> {a.userEmail}
                      </a>
                      {a.currentUser?.verificationLevel && (
                        <div className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                          <ShieldCheck className="h-3 w-3" /> {a.currentUser.verificationLevel.replace(/_/g, ' ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">{ROLE_LABEL[a.requestedRole] || a.requestedRole}</Badge>
                      {a.currentUser?.contractorRoles?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-0.5 text-[10px] text-neutral-600">
                          <Hammer className="h-3 w-3" />
                          {a.currentUser.contractorRoles.slice(0, 3).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <div className="font-semibold text-neutral-900">{a.companyName || '—'}</div>
                      {a.businessDescription && <div className="mt-0.5 line-clamp-2 max-w-[220px] text-[11px] text-neutral-500">{a.businessDescription}</div>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {a.website ? (
                        <a href={a.website.startsWith('http') ? a.website : `https://${a.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-blue-700 hover:underline">
                          <Globe className="h-3 w-3" /> <span className="max-w-[160px] truncate">{a.website.replace(/^https?:\/\//, '')}</span> <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {a.phone ? (
                        <a href={`tel:${a.phone}`} className="inline-flex items-center gap-0.5 text-neutral-800 hover:underline">
                          <Phone className="h-3 w-3" /> {a.phone}
                        </a>
                      ) : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-3 py-3 text-xs text-neutral-600">
                      <Clock className="-mt-0.5 mr-0.5 inline h-3 w-3" />
                      {fmtShortDate(a.submittedAt)}
                      {a.decidedBy && (
                        <div className="mt-0.5 text-[10px] text-neutral-500" title={fmtDate(a.decidedAt)}>
                          <Award className="-mt-0.5 mr-0.5 inline h-3 w-3" />
                          by {a.decidedBy}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-xs">
                      <div className="inline-flex gap-1">
                        <Button onClick={() => handleAction('approve', a)} disabled={!enableApprove} size="sm" className="h-7 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700 disabled:opacity-40">Approve</Button>
                        <Button onClick={() => handleAction('deny', a)} disabled={!enableDeny} size="sm" variant="outline" className="h-7 px-2 text-xs">Deny</Button>
                        <Button onClick={() => handleAction('request_info', a)} size="sm" variant="ghost" className="h-7 px-2 text-xs">Info</Button>
                        <Button onClick={() => handleAction('suspend', a)} disabled={!enableSuspend} size="sm" variant="ghost" className="h-7 px-2 text-xs text-neutral-700">Suspend</Button>
                      </div>
                      {a.decisionNote && (
                        <div className="mt-1 max-w-[280px] truncate text-right text-[10px] italic text-neutral-500" title={a.decisionNote}>
                          “{a.decisionNote}”
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ActionDialog
        open={!!openAction}
        onClose={() => setOpenAction(null)}
        action={openAction?.action}
        application={openAction?.application}
        onConfirm={confirmAction}
        submitting={submittingAction}
      />
    </div>
  )
}
