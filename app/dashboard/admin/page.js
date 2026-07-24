'use client'

// Super Admin Dashboard — platform health, feature flags, users, reports.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardShell, { KpiGrid, KpiTile, SectionHeader } from '@/components/DashboardShell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Users, AlertTriangle, Activity, ToggleRight, BarChart3, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api-client'

export default function AdminDashboard() {
  return (
    <DashboardShell
      role="admin"
      requireRole={['super_admin', 'admin']}
      title="Super Admin"
      subtitle="Platform health, feature flags, users, and reports."
      actions={
        <div className="flex gap-2">
          <Link href="/admin/feature-controls"><Button variant="outline" className="gap-1"><ToggleRight className="h-4 w-4" /> Feature Controls</Button></Link>
          <Link href="/admin"><Button className="gap-1 bg-brand-600 hover:bg-brand-700"><ShieldCheck className="h-4 w-4" /> Admin Panel</Button></Link>
        </div>
      }
    >
      {({ user }) => <AdminBody user={user} />}
    </DashboardShell>
  )
}

function AdminBody() {
  const [flags, setFlags] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [f, s] = await Promise.all([
          api.get('/api/admin/feature-flags').catch(() => null),
          api.get('/api/admin/stats').catch(() => null),
        ])
        if (cancelled) return
        setFlags(f?.flags || []); setStats(s)
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const byStatus = flags.reduce((acc, f) => {
    acc[f.globalStatus] = (acc[f.globalStatus] || 0) + 1
    return acc
  }, {})
  const liveCount = byStatus.live || 0
  const pausedCount = byStatus.paused || 0
  const hiddenCount = byStatus.not_active || 0
  const betaCount = byStatus.beta || 0

  return (
    <>
      <KpiGrid>
        <KpiTile icon={Users} label="Total users" value={stats?.userCount || '—'} sub={stats?.activeUserCount ? `${stats.activeUserCount} active` : 'live'} loading={loading} tone="brand" />
        <KpiTile icon={ToggleRight} label="Features live" value={liveCount} sub={`${flags.length} total · ${betaCount} beta · ${pausedCount} paused · ${hiddenCount} hidden`} loading={loading} tone="emerald" />
        <KpiTile icon={AlertTriangle} label="Open reports" value={stats?.openReportCount || 0} sub="Awaiting moderation" loading={loading} tone="red" />
        <KpiTile icon={Activity} label="Posts (30d)" value={stats?.postCount30d || 0} sub="Activity Hub volume" loading={loading} tone="violet" />
      </KpiGrid>

      <SectionHeader icon={ToggleRight} title="Feature flag status" subtitle="Click any feature to toggle status" action={<Link href="/admin/feature-controls" className="text-xs font-bold text-brand-700 hover:underline">Open controls →</Link>} />
      {loading ? (
        <Card><CardContent className="p-4 text-sm text-neutral-500">Loading…</CardContent></Card>
      ) : flags.length === 0 ? (
        <Card><CardContent className="p-4 text-sm text-neutral-500">No flags loaded. The admin endpoint may require additional auth — open the Feature Controls page directly.</CardContent></Card>
      ) : (
        <Card><CardContent className="p-0"><div className="grid divide-y divide-neutral-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div>
            <ul className="divide-y divide-neutral-100">
              {flags.filter((f) => ['paused', 'not_active', 'demo'].includes(f.globalStatus)).slice(0, 8).map((f) => (
                <li key={f.key} className="flex items-center justify-between p-3 text-sm">
                  <div><div className="font-bold text-neutral-900">{f.name}</div><div className="text-[11px] text-neutral-500">{f.category}</div></div>
                  <Badge className={`text-[10px] uppercase ${f.globalStatus === 'paused' ? 'bg-amber-100 text-amber-800' : f.globalStatus === 'not_active' ? 'bg-neutral-200 text-neutral-700' : 'bg-violet-100 text-violet-800'}`}>{f.globalStatus.replace('_', ' ')}</Badge>
                </li>
              ))}
              {flags.filter((f) => ['paused', 'not_active', 'demo'].includes(f.globalStatus)).length === 0 && <li className="p-3 text-sm text-neutral-500">All features live 🎉</li>}
            </ul>
          </div>
          <div>
            <ul className="divide-y divide-neutral-100">
              {flags.filter((f) => ['beta'].includes(f.globalStatus)).slice(0, 8).map((f) => (
                <li key={f.key} className="flex items-center justify-between p-3 text-sm">
                  <div><div className="font-bold text-neutral-900">{f.name}</div><div className="text-[11px] text-neutral-500">{f.category}</div></div>
                  <Badge className="bg-violet-100 text-[10px] uppercase text-violet-800">Beta</Badge>
                </li>
              ))}
              {flags.filter((f) => f.globalStatus === 'beta').length === 0 && <li className="p-3 text-sm text-neutral-500">No features in beta</li>}
            </ul>
          </div>
        </div></CardContent></Card>
      )}

      <SectionHeader icon={BarChart3} title="Quick admin links" />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Feature Controls', href: '/admin/feature-controls', icon: ToggleRight },
          { label: 'Reports queue',     href: '/admin/reports',          icon: AlertTriangle },
          { label: 'Users',              href: '/admin/users',            icon: Users },
          { label: 'Activity audit',     href: '/admin/audit',            icon: Activity },
        ].map((link) => {
          const Icon = link.icon
          return (
            <Link href={link.href} key={link.href}>
              <Card className="transition hover:border-brand-300 hover:shadow-sm">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-brand-600" /><span className="font-bold text-neutral-900">{link.label}</span></div>
                  <ArrowRight className="h-4 w-4 text-neutral-400" />
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}
