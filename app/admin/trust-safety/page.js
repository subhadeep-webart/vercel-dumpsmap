'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Shield, AlertOctagon, Flag, MessagesSquare, BadgeAlert } from 'lucide-react'
import Link from 'next/link'

export default function AdminTrustSafety() {
  const { authFetch } = useAdmin()
  const [warnings, setWarnings] = useState([])
  const [flags, setFlags] = useState([])
  const [disputes, setDisputes] = useState([])
  const [openReports, setOpenReports] = useState(0)
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueUserId, setIssueUserId] = useState('')
  const [issueReason, setIssueReason] = useState('')
  const [issueSeverity, setIssueSeverity] = useState('warning')

  const load = async () => {
    const [a, b, c, d] = await Promise.all([
      authFetch('/api/admin/warnings').then((r) => r.json()),
      authFetch('/api/admin/fraud-flags').then((r) => r.json()),
      authFetch('/api/admin/disputes').then((r) => r.json()),
      authFetch('/api/admin/reports?status=open').then((r) => r.json()),
    ])
    setWarnings(a.warnings || [])
    setFlags(b.flags || [])
    setDisputes(c.disputes || [])
    setOpenReports((d.reports || []).length)
  }
  useEffect(() => { load() }, [])

  const issueWarning = async () => {
    if (!issueUserId || !issueReason) return toast.error('User ID + reason required')
    const r = await authFetch('/api/admin/warnings', { method: 'POST', body: JSON.stringify({ userId: issueUserId, reason: issueReason, severity: issueSeverity }) })
    if (r.ok) { toast.success('Warning issued'); setIssueOpen(false); setIssueUserId(''); setIssueReason(''); load() } else toast.error('Failed')
  }

  const resolveFlag = async (id) => {
    const note = prompt('Resolution note?', '')
    const r = await authFetch(`/api/admin/fraud-flags/${id}`, { method: 'PATCH', body: JSON.stringify({ resolution: note || '' }) })
    if (r.ok) { toast.success('Resolved'); load() }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Trust &amp; Safety</h1>
          <p className="text-sm text-neutral-500">Warnings, fraud flags, disputes, and reported content.</p>
        </div>
        <Button onClick={() => setIssueOpen(true)}><BadgeAlert className="mr-1 h-4 w-4" /> Issue warning</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <KPI icon={BadgeAlert} title="Warnings issued" value={warnings.length} color="amber" />
        <KPI icon={AlertOctagon} title="Open fraud flags" value={flags.length} color="red" />
        <KPI icon={MessagesSquare} title="Active disputes" value={disputes.filter((d) => d.status === 'open').length} color="blue" />
        <KPI icon={Flag} title="Open reports" value={openReports} color="red" href="/admin/reports?status=open" />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent fraud flags</CardTitle></CardHeader>
        <CardContent className="divide-y divide-neutral-100">
          {flags.length === 0 && <div className="py-2 text-sm text-neutral-500">No open flags.</div>}
          {flags.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0 text-sm">
                <Badge variant="outline" className="mr-1 border-red-300 bg-red-50 text-red-700">{f.type}</Badge>
                <span className="text-neutral-600">{f.targetKind} #{f.targetId}</span>
                {f.note && <span className="ml-2 text-xs italic text-neutral-500">“{f.note}”</span>}
              </div>
              <Button size="sm" variant="outline" onClick={() => resolveFlag(f.id)}>Resolve</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent warnings</CardTitle></CardHeader>
        <CardContent className="divide-y divide-neutral-100">
          {warnings.length === 0 && <div className="py-2 text-sm text-neutral-500">No warnings issued.</div>}
          {warnings.slice(0, 20).map((w) => (
            <div key={w.id} className="py-2 text-sm">
              <Badge variant="outline" className={w.severity === 'strike' ? 'mr-1 border-red-300 bg-red-50 text-red-700' : 'mr-1 border-amber-300 bg-amber-50 text-amber-800'}>{w.severity}</Badge>
              <span className="text-neutral-700">User <code className="rounded bg-neutral-100 px-1 text-[11px]">{w.userId}</code></span> · <span className="text-neutral-500">{w.reason}</span>
              <span className="ml-1 text-[11px] text-neutral-400">· by {w.issuedByEmail} · {new Date(w.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Disputes</CardTitle></CardHeader>
        <CardContent className="divide-y divide-neutral-100">
          {disputes.length === 0 && <div className="py-2 text-sm text-neutral-500">No disputes.</div>}
          {disputes.map((d) => (
            <div key={d.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <Badge variant="outline" className="mr-1">{d.kind}</Badge>
                <span className="text-neutral-700">{d.relatedId}</span> · <span className="text-neutral-500">{d.status}</span>
              </div>
              <Link href={`/admin/reports?status=open`} className="text-xs font-semibold text-brand-700 hover:underline">Open queue →</Link>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Issue warning</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="User ID" value={issueUserId} onChange={(e) => setIssueUserId(e.target.value)} />
            <Textarea rows={3} placeholder="Reason for warning…" value={issueReason} onChange={(e) => setIssueReason(e.target.value)} />
            <div className="flex gap-2">
              {['warning', 'strike'].map((v) => (
                <button key={v} onClick={() => setIssueSeverity(v)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${issueSeverity === v ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-neutral-200 bg-white text-neutral-600'}`}>{v}</button>
              ))}
            </div>
            <Button onClick={issueWarning} className="w-full">Issue</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KPI({ icon: Icon, title, value, color = 'green', href }) {
  const colorMap = {
    green: 'border-brand-200 bg-brand-50 text-brand-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red:   'border-red-200 bg-red-50 text-red-700',
    blue:  'border-blue-200 bg-blue-50 text-blue-700',
  }
  const inner = (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 transition hover:border-brand-400">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border ${colorMap[color]}`}><Icon className="h-4 w-4" /></div>
      <div className="text-2xl font-extrabold">{value ?? '—'}</div>
      <div className="text-xs font-medium text-neutral-500">{title}</div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
