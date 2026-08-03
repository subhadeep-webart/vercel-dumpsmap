'use client'

// Resident (Personal) Dashboard — daily-driver view for everyday users.
// Rewards balance, recent check-ins, saved posts, nearby facilities.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardShell, { KpiGrid, KpiTile, SectionHeader } from '@/components/DashboardShell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Award, Bookmark, MapPin, Receipt, Activity, ArrowRight, Heart, Gift, ChevronDown, ChevronUp, PenLine } from 'lucide-react'
import { api } from '@/lib/api-client'

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

// How many community posts to reveal per "Load more" click.
const POSTS_STEP = 4

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
  const [visiblePosts, setVisiblePosts] = useState(POSTS_STEP)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [rb, sv, rc, ah] = await Promise.all([
          api.get('/api/users/me/rewards/balance').catch(() => null),
          api.get('/api/activity-hub/saved').catch(() => null),
          api.get('/api/receipts?limit=3').catch(() => null),
          api.get('/api/activity-hub/feed?limit=12').catch(() => null),
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
        <KpiTile index={0} icon={Award} label="Rewards balance" value={loading ? '—' : (rewards?.balance || 0).toLocaleString()} sub={`≈ ${money((rewards?.balance || 0) / 100)} cash`} loading={loading} tone="emerald" />
        <KpiTile index={1} icon={Heart} label="Lifetime earned" value={loading ? '—' : (rewards?.lifetimeEarned || 0).toLocaleString()} sub="pts earned all-time" loading={loading} tone="brand" />
        <KpiTile index={2} icon={Bookmark} label="Saved posts" value={loading ? '—' : saved.length} sub="from Activity Hub" loading={loading} tone="violet" />
        <KpiTile index={3} icon={Receipt} label="Recent receipts" value={loading ? '—' : receipts.length} sub="Last 30 days" loading={loading} tone="amber" />
      </KpiGrid>

      <SectionHeader icon={Bookmark} title="Your saved posts" subtitle="Posts you bookmarked from the Activity Hub" action={<Link href="/activity-hub?filter=saved" className="group inline-flex items-center gap-1 text-xs font-bold text-emerald-700 transition-colors hover:text-emerald-800">View all <ArrowRight className="dm-nudge-x h-3.5 w-3.5" /></Link>} />
      {loading ? (
        <PostGridSkeleton count={3} />
      ) : saved.length === 0 ? (
        <EmptyCard>You haven&apos;t saved anything yet. Tap the bookmark icon on any post to add it here.</EmptyCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {saved.slice(0, 6).map((p, i) => (
            <SavedPostCard key={p.id} post={p} index={i} />
          ))}
        </div>
      )}

      <SectionHeader icon={Activity} title="Latest in your community" subtitle="Live updates from the Activity Hub" action={<Link href="/activity-hub" className="group inline-flex items-center gap-1 text-xs font-bold text-emerald-700 transition-colors hover:text-emerald-800">Open feed <ArrowRight className="dm-nudge-x h-3.5 w-3.5" /></Link>} />
      {loading ? (
        <PostGridSkeleton count={4} />
      ) : recentPosts.length === 0 ? (
        <EmptyCard>No recent activity. Be the first to post! <Link href="/activity-hub" className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800"><PenLine className="h-3.5 w-3.5" /> Compose</Link></EmptyCard>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {recentPosts.slice(0, visiblePosts).map((p, i) => (
              <CommunityPostCard key={p.id} post={p} index={i % POSTS_STEP} />
            ))}
          </div>
          {(recentPosts.length > POSTS_STEP) && (
            <div className="mt-3 flex justify-center">
              {visiblePosts < recentPosts.length ? (
                <Button
                  variant="outline"
                  className="dm-lift group gap-1.5 border-neutral-200 bg-white text-sm font-bold text-emerald-700 shadow-sm hover:border-emerald-300 hover:text-emerald-800"
                  onClick={() => setVisiblePosts((v) => Math.min(v + POSTS_STEP, recentPosts.length))}
                >
                  Load more
                  <ChevronDown className="dm-nudge-y h-4 w-4" />
                  <span className="ml-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    {recentPosts.length - visiblePosts}
                  </span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="group gap-1.5 border-neutral-200 bg-white text-sm font-bold text-neutral-600 shadow-sm hover:text-neutral-900"
                  onClick={() => setVisiblePosts(POSTS_STEP)}
                >
                  Show less
                  <ChevronUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}

// A saved-post card — accent bar + hover lift + staggered reveal.
function SavedPostCard({ post, index }) {
  return (
    <Link href={post.href || `/community/posts/${post.id}`} className="group block dm-rise-in" style={{ '--dm-i': index }}>
      <Card className="dm-lift dm-accent relative h-full overflow-hidden border-neutral-200/80 group-hover:border-emerald-300" style={{ '--dm-accent-from': '16 185 129', '--dm-accent-to': '5 150 105' }}>
        <CardContent className="space-y-1.5 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">{String(post.type || 'post').replace(/_/g, ' ')}</span>
            <Bookmark className="h-3.5 w-3.5 shrink-0 fill-emerald-500 text-emerald-500" />
          </div>
          <div className="truncate text-sm font-bold text-neutral-900 transition-colors group-hover:text-emerald-700">{post.title || 'Saved post'}</div>
          {post.description && <p className="line-clamp-2 text-[11px] leading-relaxed text-neutral-500">{post.description}</p>}
        </CardContent>
      </Card>
    </Link>
  )
}

// A community feed card — icon badge, location meta, nudging arrow.
function CommunityPostCard({ post, index }) {
  const place = [post.location?.city, post.location?.state].filter(Boolean).join(', ')
  return (
    <Link href={post.href || `/community/posts/${post.id}`} className="group block dm-rise-in" style={{ '--dm-i': index }}>
      <Card className="dm-lift relative h-full overflow-hidden border-neutral-200/80 group-hover:border-emerald-300">
        <CardContent className="flex items-center gap-3 p-3.5">
          <span className="dm-badge inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700">
            <Activity className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-neutral-900 transition-colors group-hover:text-emerald-700">{post.title || 'Update'}</div>
            {place ? (
              <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-neutral-500"><MapPin className="h-3 w-3" /> {place}</div>
            ) : (
              <div className="mt-0.5 text-[11px] text-neutral-400">Community update</div>
            )}
          </div>
          <ArrowRight className="dm-nudge h-4 w-4 shrink-0 text-neutral-300 transition-colors group-hover:text-emerald-600" />
        </CardContent>
      </Card>
    </Link>
  )
}

function EmptyCard({ children }) {
  return (
    <Card className="border-dashed border-neutral-300 bg-neutral-50/50">
      <CardContent className="p-5 text-center text-sm text-neutral-500">{children}</CardContent>
    </Card>
  )
}

// Shimmer placeholders so the sections don't collapse/jump while loading.
function PostGridSkeleton({ count = 3 }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-neutral-200/80">
          <CardContent className="space-y-2 p-3.5">
            <div className="h-3 w-16 animate-pulse rounded-full bg-neutral-200" />
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-full animate-pulse rounded bg-neutral-100" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
