'use client'

// Contractor Dashboard — operational view for haulers / cleanup pros.
// Shows time-clock, jobs, work orders, bounties, receipts, earnings.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardShell, { KpiGrid, KpiTile, SectionHeader } from '@/components/DashboardShell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, Briefcase, ClipboardList, Receipt, CircleDollarSign, Award, ArrowRight, Truck, MapPin } from 'lucide-react'
import { api } from '@/lib/api-client'

const fmtHrs = (m) => `${((m || 0) / 60).toFixed(1)}h`
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

export default function ContractorDashboard() {
  return (
    <DashboardShell
      role="contractor"
      title="Contractor Ops"
      subtitle="Your jobs, hours, earnings, and bounties at a glance."
      actions={
        <div className="flex gap-2">
          <Link href="/time-clock"><Button variant="outline" className="gap-1"><Clock className="h-4 w-4" /> Time Clock</Button></Link>
          <Link href="/jobs"><Button className="gap-1 bg-brand-600 hover:bg-brand-700"><Briefcase className="h-4 w-4" /> Browse Jobs</Button></Link>
        </div>
      }
    >
      {({ user }) => <ContractorBody user={user} />}
    </DashboardShell>
  )
}

function ContractorBody({ user }) {
  const [summary, setSummary] = useState(null)
  const [jobs, setJobs] = useState([])
  const [bounties, setBounties] = useState([])
  const [receipts, setReceipts] = useState([])
  const [rewards, setRewards] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [s, j, b, r, rb] = await Promise.all([
          api.get('/api/time-clock/summary').catch(() => null),
          api.get('/api/jobs?state=open&limit=5').catch(() => null),
          api.get('/api/bounties?state=goal_reached&limit=5').catch(() => null),
          api.get('/api/receipts?limit=5').catch(() => null),
          api.get('/api/users/me/rewards/balance').catch(() => null),
        ])
        if (cancelled) return
        setSummary(s); setJobs(j?.jobs || []); setBounties(b?.bounties || [])
        setReceipts(r?.receipts || []); setRewards(rb)
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const earnings = summary?.settings?.defaultRate > 0 && summary?.week?.net
    ? `$${(((summary.week.net) / 60) * summary.settings.defaultRate).toFixed(0)}` : '—'

  return (
    <>
      <KpiGrid>
        <KpiTile icon={Clock} label="Hours this week" value={loading ? '—' : fmtHrs(summary?.week?.net)} sub={`${summary?.week?.daysWorked || 0} days worked`} loading={loading} tone="brand" />
        <KpiTile icon={CircleDollarSign} label="Est. earnings (week)" value={loading ? '—' : earnings} sub={summary?.settings?.defaultRate > 0 ? `@ $${summary.settings.defaultRate}/hr` : 'Set rate in Time Clock settings'} loading={loading} tone="emerald" />
        <KpiTile icon={Award} label="Rewards balance" value={loading ? '—' : (rewards?.balance || 0).toLocaleString()} sub={`pts · lifetime ${rewards?.lifetimeEarned || 0}`} loading={loading} tone="amber" />
        <KpiTile icon={Receipt} label="Receipts (30d)" value={loading ? '—' : receipts.length} sub="Last 5 shown below" loading={loading} tone="violet" />
      </KpiGrid>

      <SectionHeader icon={Briefcase} title="Open jobs near you" subtitle="Fresh leads from the Jobs board" action={<Link href="/jobs" className="text-xs font-bold text-brand-700 hover:underline">View all →</Link>} />
      {jobs.length === 0 ? (
        <Card><CardContent className="p-4 text-sm text-neutral-500">No open jobs right now. Try widening your service area in Profile → Service Area.</CardContent></Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.slice(0, 6).map((j) => (
            <Link href={`/jobs/${j.id}`} key={j.id}>
              <Card className="transition hover:border-brand-300 hover:shadow-sm">
                <CardContent className="space-y-1 p-3">
                  <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-brand-700">JOB</span><span className="text-base font-extrabold text-emerald-700">{money(j.budget)}</span></div>
                  <div className="truncate text-sm font-bold text-neutral-900">{j.title}</div>
                  {j.location?.city && <div className="inline-flex items-center gap-1 text-[11px] text-neutral-500"><MapPin className="h-3 w-3" /> {[j.location.city, j.location.state].filter(Boolean).join(', ')}</div>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <SectionHeader icon={CircleDollarSign} title="Bounties ready to claim" subtitle="Goal-reached community cleanups" action={<Link href="/bounties" className="text-xs font-bold text-brand-700 hover:underline">View all →</Link>} />
      {bounties.length === 0 ? (
        <Card><CardContent className="p-4 text-sm text-neutral-500">No bounties ready to claim yet. <Link href="/bounties" className="font-bold text-brand-700 hover:underline">Browse all →</Link></CardContent></Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {bounties.slice(0, 6).map((b) => (
            <Link href="/bounties" key={b.id}>
              <Card className="border-emerald-200 transition hover:shadow-sm">
                <CardContent className="space-y-1 p-3">
                  <Badge className="bg-emerald-100 text-[10px] uppercase text-emerald-800">Goal Reached</Badge>
                  <div className="truncate text-sm font-bold text-neutral-900">{b.title}</div>
                  <div className="text-xs text-neutral-600">{money(b.fundedUsd)} funded · {(b.contributors || []).length} contributors</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <SectionHeader icon={Receipt} title="Recent receipts" action={<Link href="/receipts" className="text-xs font-bold text-brand-700 hover:underline">View all →</Link>} />
      {receipts.length === 0 ? (
        <Card><CardContent className="p-4 text-sm text-neutral-500">No receipts yet. <Link href="/receipt-scanner" className="font-bold text-brand-700 hover:underline">Scan one →</Link></CardContent></Card>
      ) : (
        <Card><CardContent className="p-0"><ul className="divide-y divide-neutral-100">
          {receipts.slice(0, 5).map((rc) => (
            <li key={rc.id} className="flex items-center justify-between p-3 text-sm">
              <div><div className="font-bold text-neutral-900">{rc.vendor || 'Receipt'}</div><div className="text-[11px] text-neutral-500">{rc.date ? new Date(rc.date).toLocaleDateString() : ''}</div></div>
              <div className="font-mono font-bold">{money(rc.totalAmount || rc.total)}</div>
            </li>
          ))}
        </ul></CardContent></Card>
      )}
    </>
  )
}
