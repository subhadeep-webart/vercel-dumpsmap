'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, MapPin, Store, Briefcase, Activity, Flag,
  CheckCircle2, AlertTriangle, XCircle, TrendingUp, Clock, Hand,
} from 'lucide-react'
import Link from 'next/link'
import NeedsAttentionWidget from '@/components/admin/NeedsAttentionWidget'

function Kpi({ icon: Icon, label, value, sub, color = 'green', href }) {
  const colorMap = {
    green:  'border-brand-200 bg-brand-50 text-brand-700',
    amber:  'border-amber-200 bg-amber-50 text-amber-700',
    red:    'border-red-200 bg-red-50 text-red-700',
    blue:   'border-blue-200 bg-blue-50 text-blue-700',
    neutral:'border-neutral-200 bg-neutral-50 text-neutral-700',
  }
  const inner = (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-brand-400 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
        {sub != null && <div className="text-[11px] text-neutral-500">{sub}</div>}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-neutral-900">{value ?? '—'}</div>
      <div className="text-xs font-medium text-neutral-500">{label}</div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default function AdminOverview() {
  const { authFetch, user } = useAdmin()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch('/api/admin/overview')
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'load failed')
        setData(j)
      } catch (e) { setErr(String(e.message || e)) }
    })()
  }, [authFetch])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="inline-flex items-center gap-2 text-2xl font-extrabold tracking-tight">Welcome, {user?.name?.split(' ')[0] || 'admin'} <Hand className="h-5 w-5 text-amber-500" /></h1>
        <p className="text-sm text-neutral-500">Platform pulse, moderation queue and activity at a glance.</p>
      </div>

      {err && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      {/* NEEDS ATTENTION */}
      <NeedsAttentionWidget />

      {/* USERS */}
      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
          <Users className="h-3.5 w-3.5" /> Users
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi icon={Users} label="Total users" value={data?.kpis.users.total} href="/admin/users" />
          <Kpi icon={CheckCircle2} label="Active" value={data?.kpis.users.active} color="green" href="/admin/users?status=active" />
          <Kpi icon={AlertTriangle} label="Suspended" value={data?.kpis.users.suspended} color="amber" href="/admin/users?status=suspended" />
          <Kpi icon={XCircle} label="Banned" value={data?.kpis.users.banned} color="red" href="/admin/users?status=banned" />
          <Kpi icon={CheckCircle2} label="Verified" value={data?.kpis.users.verified} color="blue" />
        </div>
      </section>

      {/* FACILITIES */}
      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
          <MapPin className="h-3.5 w-3.5" /> Facilities
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi icon={MapPin} label="Total" value={data?.kpis.facilities.total} href="/admin/facilities" />
          <Kpi icon={Clock} label="Pending review" value={data?.kpis.facilities.pending} color="amber" href="/admin/facilities?status=pending" />
          <Kpi icon={CheckCircle2} label="Approved" value={data?.kpis.facilities.approved} color="green" />
          <Kpi icon={XCircle} label="Rejected" value={data?.kpis.facilities.rejected} color="red" />
        </div>
      </section>

      {/* MARKETPLACE / JOBS / ALERTS */}
      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
          <TrendingUp className="h-3.5 w-3.5" /> Content & activity
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi icon={Store} label="Marketplace listings" value={data?.kpis.marketplace.total} sub={`${data?.kpis.marketplace.flagged || 0} flagged`} href="/admin/marketplace" />
          <Kpi icon={Briefcase} label="Jobs open" value={data?.kpis.jobs.open} sub={`${data?.kpis.jobs.hotSpots || 0} hot spots`} href="/admin/jobs" color="blue" />
          <Kpi icon={Activity} label="Active alerts" value={data?.kpis.alerts.active} sub={`${data?.kpis.alerts.last24h || 0} in 24h`} href="/admin/feed" />
          <Kpi icon={Flag} label="Reports open" value={data?.kpis.reports.open} sub={`${data?.kpis.reports.total || 0} total`} color={data?.kpis.reports.open ? 'red' : 'neutral'} href="/admin/reports?status=open" />
        </div>
      </section>

      {/* RECENT ACTIVITY */}
      <section>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent moderation activity</CardTitle>
          </CardHeader>
          <CardContent>
            {!data && <div className="text-sm text-neutral-500">Loading…</div>}
            {data && data.recentActivity.length === 0 && (
              <div className="text-sm text-neutral-500">No activity yet. Moderation actions will appear here.</div>
            )}
            <ul className="divide-y divide-neutral-100">
              {data?.recentActivity?.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-neutral-900">{a.action} — <span className="font-normal text-neutral-500">{a.targetLabel || a.targetId}</span></div>
                    <div className="text-[11px] text-neutral-500">{a.actorEmail} · {a.targetKind}</div>
                  </div>
                  <div className="shrink-0 text-[11px] text-neutral-400">{new Date(a.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-right">
              <Link href="/admin/activity-log" className="text-xs font-semibold text-brand-700 hover:underline">View full activity log →</Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
