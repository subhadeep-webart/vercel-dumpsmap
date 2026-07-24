'use client'

// Resident (Personal) Dashboard — daily-driver view for everyday users.
// Rewards balance, recent check-ins, saved posts, nearby facilities.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardShell, { KpiGrid, KpiTile, SectionHeader } from '@/components/DashboardShell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Award, Bookmark, MapPin, Receipt, Activity, ArrowRight, Heart, Gift } from 'lucide-react'
import { api } from '@/lib/api-client'

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function ResidentDashboard() {
  return (
    <DashboardShell
      role="resident"
      title="Your Dashboard"
      subtitle="Rewards, saved posts, recent activity, and nearby facilities."
      actions={
        <div className="flex gap-2">
          <Link href="/rewards"><Button variant="outline" className="gap-1"><Gift className="h-4 w-4" /> Rewards</Button></Link>
          <Link href="/activity-hub"><Button className="gap-1 bg-brand-600 hover:bg-brand-700"><Activity className="h-4 w-4" /> Activity Hub</Button></Link>
        </div>
      }
    >
      {({ user }) => <ResidentBody user={user} />}
    </DashboardShell>
  )
}

function ResidentBody({ user }) {
  const [rewards, setRewards] = useState(null)
  const [saved, setSaved] = useState([])
  const [receipts, setReceipts] = useState([])
  const [recentPosts, setRecentPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [rb, sv, rc, ah] = await Promise.all([
          api.get('/api/users/me/rewards/balance').catch(() => null),
          api.get('/api/activity-hub/saved').catch(() => null),
          api.get('/api/receipts?limit=3').catch(() => null),
          api.get('/api/activity-hub/feed?limit=4').catch(() => null),
        ])
        if (cancelled) return
        setRewards(rb); setSaved(sv?.feed || []); setReceipts(rc?.receipts || []); setRecentPosts(ah?.feed || [])
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <KpiGrid>
        <KpiTile icon={Award} label="Rewards balance" value={loading ? '—' : (rewards?.balance || 0).toLocaleString()} sub={`≈ ${money((rewards?.balance || 0) / 100)} cash`} loading={loading} tone="emerald" />
        <KpiTile icon={Heart} label="Lifetime earned" value={loading ? '—' : (rewards?.lifetimeEarned || 0).toLocaleString()} sub="pts earned all-time" loading={loading} tone="brand" />
        <KpiTile icon={Bookmark} label="Saved posts" value={loading ? '—' : saved.length} sub="from Activity Hub" loading={loading} tone="violet" />
        <KpiTile icon={Receipt} label="Recent receipts" value={loading ? '—' : receipts.length} sub="Last 30 days" loading={loading} tone="amber" />
      </KpiGrid>

      <SectionHeader icon={Bookmark} title="Your saved posts" subtitle="Posts you bookmarked from the Activity Hub" action={<Link href="/activity-hub?filter=saved" className="text-xs font-bold text-brand-700 hover:underline">View all →</Link>} />
      {saved.length === 0 ? (
        <Card><CardContent className="p-4 text-sm text-neutral-500">You haven&apos;t saved anything yet. Tap the bookmark icon on any post to add it here.</CardContent></Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {saved.slice(0, 6).map((p) => (
            <Link href={p.href || `/community/posts/${p.id}`} key={p.id}>
              <Card className="transition hover:border-brand-300 hover:shadow-sm">
                <CardContent className="space-y-1 p-3">
                  <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">{String(p.type || 'post').replace(/_/g, ' ')}</span></div>
                  <div className="truncate text-sm font-bold text-neutral-900">{p.title || 'Saved post'}</div>
                  {p.description && <p className="line-clamp-2 text-[11px] text-neutral-500">{p.description}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <SectionHeader icon={Activity} title="Latest in your community" subtitle="Live updates from the Activity Hub" action={<Link href="/activity-hub" className="text-xs font-bold text-brand-700 hover:underline">Open feed →</Link>} />
      {recentPosts.length === 0 ? (
        <Card><CardContent className="p-4 text-sm text-neutral-500">No recent activity. Be the first to post! <Link href="/activity-hub" className="font-bold text-brand-700 hover:underline">Compose →</Link></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {recentPosts.slice(0, 4).map((p) => (
            <Link href={p.href || `/community/posts/${p.id}`} key={p.id}>
              <Card className="transition hover:border-brand-300 hover:shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-neutral-900">{p.title || 'Update'}</div>
                      {p.location?.city && <div className="inline-flex items-center gap-1 text-[11px] text-neutral-500"><MapPin className="h-3 w-3" /> {[p.location.city, p.location.state].filter(Boolean).join(', ')}</div>}
                    </div>
                    <ArrowRight className="h-4 w-4 text-neutral-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
