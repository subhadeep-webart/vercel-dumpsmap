'use client'

// Admin — Leads (Beta signups + Business inquiries)
// Consumes GET /api/admin/beta-signups (super_admin/admin/moderator).
// Lets staff mark leads as contacted and mark queued email notifications as sent.

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Inbox, User as UserIcon, Building2, MapPin, Mail, Phone, ExternalLink,
  CheckCircle2, Clock, Search, RefreshCw, Send, ChevronRight, Sparkles, AlertTriangle,
} from 'lucide-react'

export default function AdminLeadsPage() {
  const { user, isStaff, authFetch } = useAdmin()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ betaSignups: [], businessInquiries: [], notifications: [] })
  const [tab, setTab] = useState('beta')
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await authFetch('/api/admin/beta-signups')
      const j = await r.json()
      if (r.ok) {
        setData({
          betaSignups:       j.betaSignups || [],
          businessInquiries: j.businessInquiries || [],
          notifications:     j.notifications || [],
        })
      } else {
        toast.error(j.error || 'Failed to load leads')
      }
    } catch (e) {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isStaff) load() }, [isStaff])

  const markLead = async (kind, id, status, notes) => {
    try {
      const r = await authFetch('/api/admin/leads/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, status, notes }),
      })
      if (r.ok) {
        toast.success('Updated')
        load()
        setDetail(null)
      } else {
        toast.error('Failed to update')
      }
    } catch (e) {
      toast.error('Network error')
    }
  }

  const markNotifSent = async (id) => {
    try {
      const r = await authFetch('/api/admin/leads/mark-notif-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (r.ok) { toast.success('Marked as sent'); load() }
    } catch (e) {
      toast.error('Network error')
    }
  }

  if (!isStaff) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-neutral-500">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-500" />
            You must be a staff member to view leads.
          </CardContent>
        </Card>
      </div>
    )
  }

  const filterFn = (arr, keys) => arr.filter((row) => {
    if (!q.trim()) return true
    const needle = q.toLowerCase()
    return keys.some((k) => String(row[k] || '').toLowerCase().includes(needle))
  })
  const filteredBeta = filterFn(data.betaSignups, ['email', 'fullName', 'city', 'state', 'role'])
  const filteredBiz  = filterFn(data.businessInquiries, ['businessName', 'contactName', 'email', 'city', 'businessType', 'interest'])

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Inbox className="h-6 w-6 text-emerald-600" /> Leads &amp; Inquiries
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            New signups from the beta waitlist and business partnership form. Contact these people directly — real email delivery is pending SendGrid/Resend integration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email, name, city…"
              className="h-10 w-64 pl-8"
            />
          </div>
          <Button onClick={load} variant="outline" className="h-10">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Notifications strip (unsent queue) */}
      {data.notifications.length > 0 && (
        <Card className="mb-5 border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-amber-800">
              <Mail className="h-4 w-4" /> {data.notifications.length} pending email notification{data.notifications.length === 1 ? '' : 's'}
              <Badge className="ml-2 bg-amber-200 text-amber-900 hover:bg-amber-200">MOCKED — real email delivery TBD</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {data.notifications.slice(0, 20).map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-3 rounded border border-amber-100 bg-white p-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{n.title}</div>
                    <div className="truncate text-[12px] text-neutral-500">{n.summary}</div>
                    <div className="mt-0.5 text-[10px] text-neutral-400">
                      To: {n.emailTo} · {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markNotifSent(n.id)}
                    className="h-8 shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Send className="mr-1 h-3 w-3" /> Mark Sent
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 grid w-full grid-cols-2 md:w-auto">
          <TabsTrigger value="beta" className="gap-2">
            <UserIcon className="h-4 w-4" /> Beta Waitlist
            <Badge variant="secondary" className="ml-1">{data.betaSignups.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="h-4 w-4" /> Business Inquiries
            <Badge variant="secondary" className="ml-1">{data.businessInquiries.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="beta">
          <Card>
            <CardHeader><CardTitle className="text-base">Beta signups ({filteredBeta.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-center text-sm text-neutral-500">Loading…</div>
              ) : filteredBeta.length === 0 ? (
                <div className="p-8 text-center text-sm text-neutral-500">
                  <Sparkles className="mx-auto mb-2 h-6 w-6 text-neutral-300" />
                  No beta signups yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
                      <tr>
                        <th className="px-4 py-2 text-left">Email / Name</th>
                        <th className="px-4 py-2 text-left">Role</th>
                        <th className="px-4 py-2 text-left">Location</th>
                        <th className="px-4 py-2 text-left">Interests</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">When</th>
                        <th className="px-4 py-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBeta.map((row) => (
                        <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold">{row.fullName || '—'}</div>
                            <div className="text-[12px] text-neutral-500">{row.email}</div>
                          </td>
                          <td className="px-4 py-2.5"><span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-medium">{row.role || '—'}</span></td>
                          <td className="px-4 py-2.5 text-[12px] text-neutral-600">{[row.city, row.state].filter(Boolean).join(', ') || '—'}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(row.interests || []).slice(0, 3).map((t) => (
                                <span key={t} className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">{t}</span>
                              ))}
                              {row.interests && row.interests.length > 3 && (
                                <span className="text-[10px] text-neutral-400">+{row.interests.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">{statusBadge(row.status)}</td>
                          <td className="px-4 py-2.5 text-[12px] text-neutral-500">{when(row.createdAt)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Button size="sm" variant="ghost" onClick={() => setDetail({ kind: 'beta', row })} className="h-8 gap-1">
                              View <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business">
          <Card>
            <CardHeader><CardTitle className="text-base">Business inquiries ({filteredBiz.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-center text-sm text-neutral-500">Loading…</div>
              ) : filteredBiz.length === 0 ? (
                <div className="p-8 text-center text-sm text-neutral-500">
                  <Building2 className="mx-auto mb-2 h-6 w-6 text-neutral-300" />
                  No business inquiries yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
                      <tr>
                        <th className="px-4 py-2 text-left">Business</th>
                        <th className="px-4 py-2 text-left">Contact</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Location</th>
                        <th className="px-4 py-2 text-left">Interest</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">When</th>
                        <th className="px-4 py-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBiz.map((row) => (
                        <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold">{row.businessName}</div>
                            {row.website && (
                              <a href={row.website} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-700 hover:underline">
                                <ExternalLink className="h-3 w-3" /> {row.website}
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="text-[13px]">{row.contactName || '—'}</div>
                            <div className="text-[11px] text-neutral-500">{row.email}</div>
                            {row.phone && <div className="text-[11px] text-neutral-500">{row.phone}</div>}
                          </td>
                          <td className="px-4 py-2.5"><span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-medium">{row.businessType || '—'}</span></td>
                          <td className="px-4 py-2.5 text-[12px] text-neutral-600">{[row.city, row.state].filter(Boolean).join(', ') || '—'}</td>
                          <td className="px-4 py-2.5 text-[12px]"><span className="rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">{row.interest || '—'}</span></td>
                          <td className="px-4 py-2.5">{statusBadge(row.status)}</td>
                          <td className="px-4 py-2.5 text-[12px] text-neutral-500">{when(row.createdAt)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Button size="sm" variant="ghost" onClick={() => setDetail({ kind: 'business', row })} className="h-8 gap-1">
                              View <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <LeadDetailDialog detail={detail} onClose={() => setDetail(null)} onMark={markLead} />
    </div>
  )
}

function statusBadge(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'contacted') return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><CheckCircle2 className="mr-1 h-3 w-3" />Contacted</Badge>
  if (s === 'closed')    return <Badge className="bg-neutral-200 text-neutral-700 hover:bg-neutral-200">Closed</Badge>
  if (s === 'new')       return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">New</Badge>
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><Clock className="mr-1 h-3 w-3" />{status || 'pending'}</Badge>
}

function when(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = Date.now()
  const diff = (now - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString()
}

function LeadDetailDialog({ detail, onClose, onMark }) {
  const [status, setStatus] = useState('contacted')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (detail) {
      setStatus(detail.row.status === 'contacted' ? 'contacted' : 'contacted')
      setNotes(detail.row.internalNotes || '')
    }
  }, [detail])

  if (!detail) return null
  const { kind, row } = detail
  const isBeta = kind === 'beta'
  const email = row.email

  return (
    <Dialog open={!!detail} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBeta ? <><UserIcon className="h-5 w-5" /> Beta signup</> : <><Building2 className="h-5 w-5" /> Business inquiry</>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {!isBeta && (
            <Row label="Business" value={row.businessName} />
          )}
          <Row label="Name" value={row.fullName || row.contactName || '—'} />
          <Row label="Email" value={<a href={`mailto:${email}`} className="text-emerald-700 hover:underline">{email}</a>} />
          {row.phone && <Row label="Phone" value={<a href={`tel:${row.phone}`} className="text-emerald-700 hover:underline">{row.phone}</a>} />}
          {row.website && <Row label="Website" value={<a href={row.website} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">{row.website}</a>} />}
          {isBeta && <Row label="Role" value={row.role || '—'} />}
          {!isBeta && <Row label="Business Type" value={row.businessType || '—'} />}
          {!isBeta && <Row label="Interest" value={row.interest || '—'} />}
          <Row label="Location" value={[row.city, row.state].filter(Boolean).join(', ') || '—'} />
          {isBeta && (row.interests || []).length > 0 && (
            <Row label="Interests" value={
              <div className="flex flex-wrap gap-1">
                {(row.interests || []).map((t) => (
                  <span key={t} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{t}</span>
                ))}
              </div>
            } />
          )}
          {(row.notes || row.message) && <Row label={isBeta ? 'Notes' : 'Message'} value={<div className="whitespace-pre-wrap rounded bg-neutral-50 p-2 text-[13px]">{row.notes || row.message}</div>} />}
          <Row label="Received" value={new Date(row.createdAt).toLocaleString()} />
          <Row label="Status" value={statusBadge(row.status)} />

          <div className="border-t border-neutral-100 pt-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Internal notes</div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a follow-up note…" className="min-h-[80px]" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="outline" onClick={() => onMark(kind, row.id, 'closed', notes)} className="border-neutral-300">Mark closed</Button>
          <Button onClick={() => onMark(kind, row.id, 'contacted', notes)} className="bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="mr-1 h-4 w-4" /> Mark contacted
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="min-w-0 text-[13px] text-neutral-800">{value}</div>
    </div>
  )
}
