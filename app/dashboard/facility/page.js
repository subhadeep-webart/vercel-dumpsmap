'use client'

// Facility Owner Dashboard — operational signals for their facility.
// Live status, recent activity, owner updates, claim status.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardShell, { KpiGrid, KpiTile, SectionHeader } from '@/components/DashboardShell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Activity, Star, MessageSquare, Building2, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react'
import { timeAgo } from '@/lib/community-categories'
import { api } from '@/lib/api-client'

const SIGNAL_TONE = {
  busy:           'bg-amber-100 text-amber-800',
  slow:           'bg-emerald-100 text-emerald-800',
  not_busy:       'bg-emerald-100 text-emerald-800',
  closed:         'bg-red-100 text-red-800',
  accepting:      'bg-emerald-100 text-emerald-800',
  not_accepting:  'bg-red-100 text-red-800',
  long_wait:      'bg-amber-100 text-amber-800',
  scale_issue:    'bg-red-100 text-red-800',
  gate_closed:    'bg-red-100 text-red-800',
  price_update:   'bg-violet-100 text-violet-800',
  safety_alert:   'bg-red-100 text-red-800',
}

export default function FacilityDashboard() {
  return (
    <DashboardShell
      role="facility"
      title="Facility Owner Ops"
      subtitle="Live status, customer activity, and reviews for facilities you own or manage."
      actions={<Link href="/facilities"><Button variant="outline" className="gap-1"><Building2 className="h-4 w-4" /> Browse Facilities</Button></Link>}
    >
      {({ user }) => <FacilityBody user={user} />}
    </DashboardShell>
  )
}

function FacilityBody({ user }) {
  const [owned, setOwned] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const j = await api.get('/api/facilities/mine').catch(() => null)
        if (cancelled) return
        if (j) { setOwned(j?.facilities || []) }
        else {
          // Fallback: query all facilities and filter by claimedByUserId/ownerId
          const all = await api.get('/api/facilities').catch(() => null)
          const mine = (all?.facilities || []).filter((f) => f.claimedByUserId === user.id || f.ownerId === user.id)
          setOwned(mine)
        }
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [user])

  const totalChecks = owned.reduce((s, f) => s + (f.checkInCount || 0), 0)
  const avgRating = owned.length ? (owned.reduce((s, f) => s + (f.averageRating || 0), 0) / owned.length).toFixed(1) : '—'

  return (
    <>
      <KpiGrid>
        <KpiTile icon={Building2} label="Facilities owned" value={owned.length} sub={loading ? 'Loading…' : owned.length === 0 ? 'None yet' : `${owned.length} active`} loading={loading} tone="brand" />
        <KpiTile icon={Activity} label="Total check-ins" value={totalChecks} sub="All-time across your facilities" loading={loading} tone="emerald" />
        <KpiTile icon={Star} label="Average rating" value={avgRating} sub="All facilities combined" loading={loading} tone="amber" />
        <KpiTile icon={MessageSquare} label="Pending updates" value={owned.filter((f) => f.liveStatus).length} sub="Live status currently set" loading={loading} tone="violet" />
      </KpiGrid>

      <SectionHeader icon={Building2} title="My facilities" subtitle="Live status + recent activity" />
      {loading ? (
        <Card><CardContent className="p-6 text-sm text-neutral-500">Loading…</CardContent></Card>
      ) : owned.length === 0 ? (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="space-y-2 p-6">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
            <h3 className="text-base font-extrabold tracking-tight">You don&apos;t own a facility yet</h3>
            <p className="text-sm text-neutral-600">Find your facility in the directory and click <b>Claim ownership</b>. Once verified, you&apos;ll see check-ins, reviews, and customer messages here.</p>
            <Link href="/facilities"><Button className="mt-1 gap-1 bg-brand-600 hover:bg-brand-700"><ArrowRight className="h-4 w-4" /> Browse facilities</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {owned.map((f) => (
            <Card key={f.id} className="transition hover:border-brand-300">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><h3 className="truncate text-base font-extrabold tracking-tight text-neutral-900">{f.name}</h3>{f.verified && <ShieldCheck className="h-4 w-4 text-emerald-600" />}</div>
                  <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-neutral-500"><MapPin className="h-3 w-3" /> {[f.city, f.state].filter(Boolean).join(', ') || f.address}</div>
                  {f.liveStatus && (
                    <div className="mt-2 inline-flex items-center gap-1">
                      <Badge className={`text-[10px] uppercase ${SIGNAL_TONE[f.liveStatus] || 'bg-neutral-100 text-neutral-700'}`}>{String(f.liveStatus).replace(/_/g, ' ')}</Badge>
                      <span className="text-[11px] text-neutral-500">· updated {timeAgo(f.liveStatusUpdatedAt)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-600">
                  <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> {f.checkInCount || 0} check-ins</span>
                  <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" /> {(f.averageRating || 0).toFixed(1)}</span>
                  <Link href={`/facilities/${f.id}`} className="font-bold text-brand-700 hover:underline">Open →</Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
