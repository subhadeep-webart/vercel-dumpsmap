'use client'

// /activity-hub — DumpMaps Activity Hub (Option 2 redesign)
//
// Logged-in home feed. Replaces separate Live Feed + Community surfaces.
// Mobile-first; clean visual cards; story-style filter bar; FAB composer.

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import PageShell from '@/components/PageShell'
import SafeImage from '@/components/SafeImage'
import MediaUploader from '@/components/MediaUploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  Plus, PenLine, Camera, Video, AlertTriangle, Briefcase, CircleDollarSign, Heart, Building2,
  Gift, MessageSquare, Globe, Lightbulb, Landmark, Loader2, X, MapPin, Eye,
  ThumbsUp, Send, Sparkles, ChevronDown, Bookmark, Share2, UserRound,
} from 'lucide-react'
import { useRequireAuth, SoftLoginModal } from '@/components/SoftLoginModal'
import RouteFeatureLock from '@/components/RouteFeatureLock'
import PostOwnerMenu from '@/components/community/detail/PostOwnerMenu'
import EditPostModal from '@/components/community/detail/EditPostModal'

const FILTERS = [
  { key: 'all',        label: 'All',         icon: Globe,         tone: 'text-brand-600 bg-brand-100' },
  { key: 'alerts',     label: 'Alerts',      icon: AlertTriangle, tone: 'text-red-600 bg-red-100' },
  { key: 'jobs',       label: 'Jobs',        icon: Briefcase,     tone: 'text-blue-600 bg-blue-100' },
  { key: 'bounties',   label: 'Bounties',    icon: CircleDollarSign,    tone: 'text-green-600 bg-green-100' },
  { key: 'donations',  label: 'Donations',   icon: Heart,         tone: 'text-rose-600 bg-rose-100' },
  { key: 'facilities', label: 'Facilities',  icon: Building2,     tone: 'text-amber-600 bg-amber-100' },
  { key: 'tips',       label: 'Tips',        icon: Lightbulb,     tone: 'text-yellow-600 bg-yellow-100' },
  { key: 'government', label: 'Gov',         icon: Landmark,      tone: 'text-purple-600 bg-purple-100' },
]

const POST_TYPES = [
  { value: 'general',          label: 'General Post',     icon: MessageSquare, tone: 'text-neutral-700 bg-neutral-100', desc: 'Share something with the community' },
  { value: 'safety_alert',     label: 'Alert',            icon: AlertTriangle, tone: 'text-red-600 bg-red-50',           desc: 'Report a safety issue or alert' },
  { value: 'job',              label: 'Job',              icon: Briefcase,     tone: 'text-blue-600 bg-blue-50',         desc: 'Post a job for contractors', href: '/jobs/new' },
  { value: 'bounty',           label: 'Bounty',           icon: CircleDollarSign,    tone: 'text-green-600 bg-green-50',       desc: 'Start a community bounty', href: '/bounties/new' },
  { value: 'donation_need',    label: 'Donation Need',    icon: Heart,         tone: 'text-rose-600 bg-rose-50',         desc: 'Request donations' },
  { value: 'free_item',        label: 'Free Item',        icon: Gift,          tone: 'text-orange-600 bg-orange-50',     desc: 'Give away or offer for free' },
  { value: 'facility_update',  label: 'Facility Update',  icon: Building2,     tone: 'text-amber-600 bg-amber-50',       desc: 'Post facility status (owners only)' },
  { value: 'contractor_tip',   label: 'Contractor Tip',   icon: Lightbulb,     tone: 'text-yellow-600 bg-yellow-50',     desc: 'Share a tip (verified contractors)' },
  { value: 'government_notice', label: 'Gov Notice',       icon: Landmark,      tone: 'text-purple-600 bg-purple-50',     desc: 'Official notice (gov accounts)' },
]

const FEED_TYPE_META = {
  facility_update:    { label: 'FACILITY UPDATE', tone: 'bg-amber-100 text-amber-800',     icon: Building2 },
  job:                { label: 'JOB POSTED',      tone: 'bg-blue-100 text-blue-800',       icon: Briefcase },
  bounty:             { label: 'BOUNTY',          tone: 'bg-green-100 text-green-800',     icon: CircleDollarSign },
  donation_need:      { label: 'DONATION NEED',   tone: 'bg-rose-100 text-rose-800',       icon: Heart },
  free_item:          { label: 'FREE ITEM',       tone: 'bg-orange-100 text-orange-800',   icon: Gift },
  illegal_dumping:    { label: 'ILLEGAL DUMPING', tone: 'bg-red-100 text-red-800',         icon: AlertTriangle },
  safety_alert:       { label: 'SAFETY ALERT',    tone: 'bg-red-100 text-red-800',         icon: AlertTriangle },
  contractor_tip:     { label: 'CONTRACTOR TIP',  tone: 'bg-yellow-100 text-yellow-800',   icon: Lightbulb },
  government_notice:  { label: 'GOV NOTICE',      tone: 'bg-purple-100 text-purple-800',   icon: Landmark },
  general:            { label: 'POST',            tone: 'bg-neutral-100 text-neutral-700', icon: MessageSquare },
}

export default function ActivityHubPage() {
  return (
    <RouteFeatureLock featureKey="activityHub">
      {/* Suspense boundary required by Next 15 for useSearchParams() inside
          ActivityHubInner (reads ?filter= from the URL). */}
      <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}>
        <ActivityHubInner />
      </Suspense>
    </RouteFeatureLock>
  )
}

// Filter keys the feed API understands. The visible FILTERS bar is a subset;
// `saved` and `mine` are valid API filters that arrive via the URL (e.g. the
// dashboard links to /activity-hub?filter=saved) even though `saved` has no chip.
const VALID_FILTER_KEYS = new Set([...FILTERS.map((f) => f.key), 'saved', 'mine'])

function ActivityHubInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, requireAuth, softLogin, setSoftLogin } = useRequireAuth()
  const [feed, setFeed] = useState([])
  // Honour ?filter= from the URL on first render; fall back to 'all' for
  // missing/unknown values.
  const initialFilter = (() => {
    const q = (searchParams.get('filter') || '').toLowerCase()
    return VALID_FILTER_KEYS.has(q) ? q : 'all'
  })()
  const [filter, setFilter] = useState(initialFilter)
  const [loading, setLoading] = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)
  // Infinite scroll state
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = React.useRef(null)
  const feedRef = React.useRef([])  // ref-mirror so the IO callback sees latest array

  useEffect(() => { feedRef.current = feed }, [feed])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true); setHasMore(true)
      const ctrl = new AbortController()
      const timer = setTimeout(() => { try { ctrl.abort() } catch (_e) { /* noop */ } }, 10000)
      try {
        const r = await fetch(`/api/activity-hub/feed?filter=${filter}&limit=20`, { signal: ctrl.signal })
        const j = await r.json()
        if (cancelled) return
        const arr = Array.isArray(j.feed) ? j.feed : []
        setFeed(arr)
        setHasMore(arr.length >= 20)
      } catch {
        if (!cancelled) setFeed([])
      } finally {
        clearTimeout(timer)
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [filter])

  // ----- Infinite scroll via IntersectionObserver -----
  // When the sentinel scrolls into view, fetch the next page using the
  // oldest user-post createdAt as the `before` cursor. We bail out cleanly
  // when the server returns fewer than the page size.
  const loadMore = React.useCallback(async () => {
    const current = feedRef.current
    if (!current.length || loadingMore || !hasMore) return
    // Find the oldest user-post createdAt (aggregate cards have synthetic IDs)
    const oldestUserPost = [...current].reverse().find((c) => c.kind === 'post')
    if (!oldestUserPost?.createdAt) { setHasMore(false); return }
    setLoadingMore(true)
    try {
      const url = `/api/activity-hub/feed?filter=${filter}&limit=20&before=${encodeURIComponent(oldestUserPost.createdAt)}`
      const r = await fetch(url)
      const j = await r.json()
      const next = Array.isArray(j.feed) ? j.feed : []
      // De-dupe against current feed by id
      const existing = new Set(current.map((c) => c.id))
      const fresh = next.filter((c) => !existing.has(c.id))
      if (fresh.length) setFeed((arr) => [...arr, ...fresh])
      if (next.length < 20 || fresh.length === 0) setHasMore(false)
    } catch {
      setHasMore(false)
    } finally { setLoadingMore(false) }
  }, [filter, hasMore, loadingMore])

  useEffect(() => {
    if (!sentinelRef.current) return undefined
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore()
    }, { rootMargin: '300px 0px' })
    io.observe(sentinelRef.current)
    return () => io.disconnect()
  }, [loadMore])

  const onPostCreated = (post) => {
    // Optimistic: prepend the new card if user is on 'all' or the matching filter
    const card = {
      id: post.id, kind: 'post', sourceId: post.id, type: post.type,
      title: post.title, description: post.body, photos: post.photos || [],
      location: post.location || {}, posterId: post.userId,
      likes: 0, comments: 0, views: 0, createdAt: post.createdAt,
      href: `/community/posts/${post.id}`,
    }
    setFeed((f) => [card, ...f])
    setComposerOpen(false)
  }

  return (
    <PageShell active="activity" maxWidth="max-w-2xl" bg="bg-neutral-50"
      breadcrumbs={[{ label: 'Activity Hub' }]}>
      {/* Hero */}
      <header className="mb-4">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">What&apos;s happening now?</h1>
        <p className="mt-0.5 text-sm text-neutral-600">Real-time updates from your community.</p>
      </header>

      {/* Composer prompt */}
      <Card className="mb-4 cursor-pointer transition hover:border-green-300" onClick={() => { if (requireAuth('post')) setComposerOpen(true) }}>
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex w-7 h-7 md:h-9 md:w-9 items-center justify-center rounded-full bg-green-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm text-neutral-500">{user ? 'Share an update…' : 'Sign in to share an update…'}</div>
          <div className="flex gap-1.5">
            {[
              { Icon: Camera,        tone: 'bg-sky-100 text-sky-600' },
              { Icon: Video,         tone: 'bg-purple-100 text-purple-600' },
              { Icon: AlertTriangle, tone: 'bg-red-100 text-red-600' },
              { Icon: Briefcase,     tone: 'bg-blue-100 text-blue-600' },
              { Icon: CircleDollarSign,    tone: 'bg-green-100 text-green-600' },
            ].map(({ Icon, tone }, i) => (
              <span key={i} className={`hidden h-7 w-7 items-center justify-center rounded-full sm:inline-flex ${tone}`}><Icon className="h-3.5 w-3.5" /></span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter bar (story-style) */}
      <div className="mb-4 -mx-4 flex gap-2.5 overflow-x-auto scroll-smooth px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-3 sm:px-0">
        {(user ? [...FILTERS, { key: 'mine', label: 'My Posts', icon: UserRound, tone: 'text-teal-600 bg-teal-100' }] : FILTERS).map((f) => {
          const Icon = f.icon
          const isActive = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={isActive}
              className="group flex shrink-0 flex-col items-center gap-1.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            >
              <span
                className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full transition-all duration-200 group-hover:scale-105 sm:h-14 sm:w-14 ${
                  isActive ? 'shadow-md ring-2 ring-green-500 ring-offset-2' : 'group-hover:shadow-sm'
                } ${f.tone}`}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <span className={`text-[11px] font-bold transition-colors ${isActive ? 'text-green-700' : 'text-neutral-600 group-hover:text-neutral-900'}`}>
                {f.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {loading ? (
          <FeedSkeleton />
        ) : feed.length === 0 ? (
          <EmptyState filter={filter} onPost={() => setComposerOpen(true)} />
        ) : (
          feed.map((card) => (
            <FeedCard
              key={card.id}
              card={card}
              user={user}
              requireAuth={requireAuth}
              onUpdate={(updates) => setFeed((arr) => arr.map((c) => (c.id === card.id ? { ...c, ...updates } : c)))}
              onRemove={() => setFeed((arr) => arr.filter((c) => c.id !== card.id))}
            />
          ))
        )}
        {/* Infinite-scroll sentinel + loading indicator */}
        {!loading && feed.length > 0 && (
          <div ref={sentinelRef} className="py-4 text-center text-xs text-neutral-500">
            {loadingMore ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading more…</span>
              : hasMore ? <span>Scroll for more…</span>
              : <span className="inline-flex items-center gap-1">You&apos;ve reached the end <Sparkles className="h-3.5 w-3.5" /></span>}
          </div>
        )}
      </div>

      {/* Floating compose button */}
      <button
        onClick={() => { if (requireAuth('post')) setComposerOpen(true) }}
        className="fixed bottom-36 right-4 md:right-6 z-40 inline-flex h-9 w-9 md:h-12 md:w-12 items-center justify-center rounded-full bg-green-700 text-white shadow-lg ring-4 ring-white hover:bg-green-800 md:bottom-28"
        title={user ? 'Create post' : 'Sign in to post'}
      >
        <PenLine className="h-5 w-5 md:h-6 md:w-6" />
      </button>

      {composerOpen && user && (
        <ComposerModal
          onClose={() => setComposerOpen(false)}
          onCreated={onPostCreated}
          user={user}
          router={router}
        />
      )}

      {softLogin && (
        <SoftLoginModal action={softLogin} onClose={() => setSoftLogin(null)} />
      )}
    </PageShell>
  )
}



/* =========================================================================
   FEED CARD — interactive
   ----------------------------------------------------------------------
   • Author avatar + name with verification badge.
   • Like (toggle) → /api/community/posts/:id/react { type: 'like' }
   • Comment      → navigates to detail page (/community/posts/:id)
   • Save         → /api/community/posts/:id/save (toggle)
   • Share        → native share API or clipboard fallback
   • Optimistic UI updates; SoftLoginModal gates for logged-out users.
   • Aggregate cards (jobs / bounties / alerts) keep the simple footer.
   ========================================================================= */
function FeedCard({ card, user, requireAuth, onUpdate, onRemove }) {
  const meta = FEED_TYPE_META[card.type] || FEED_TYPE_META.general
  const Icon = meta.icon
  const cover = card.photos?.[0] || null
  const isJob = card.type === 'job'
  const isBounty = card.type === 'bounty'
  const isUserPost = card.kind === 'post'
  const canManage = isUserPost && !!user && card.posterId === user.id
  const [busyAction, setBusyAction] = React.useState(null)
  const [commentsOpen, setCommentsOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)

  // -- Owner actions (edit / delete) — author only ----------------------
  const editPost = async (fields) => {
    // Optimistic: reflect edits in the card immediately, roll back on failure.
    const prev = { title: card.title, body: card.body }
    onUpdate(fields)
    try {
      const r = await fetch(`/api/community/posts/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Update failed')
      toast.success('Post updated')
      return true
    } catch (e) {
      onUpdate(prev)
      toast.error(e.message || 'Could not update post')
      return false
    }
  }
  const deletePost = async () => {
    try {
      const r = await fetch(`/api/community/posts/${card.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Delete failed')
      toast.success('Post deleted')
      onRemove?.()
      return true
    } catch (e) { toast.error(e.message || 'Could not delete post'); return false }
  }

  // -- Interaction handlers (user posts only) ---------------------------
  const onLike = async () => {
    if (!isUserPost) return
    if (!requireAuth('save')) return
    if (busyAction) return
    const wasLiked = !!card.myReaction
    // Optimistic update
    onUpdate({
      myReaction: wasLiked ? null : 'like',
      likes: Math.max(0, (card.likes || 0) + (wasLiked ? -1 : 1)),
    })
    setBusyAction('like')
    try {
      const r = await fetch(`/api/community/posts/${card.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'like' }),
      })
      if (!r.ok) {
        // Roll back
        onUpdate({ myReaction: wasLiked ? 'like' : null, likes: card.likes })
        toast.error('Could not save like')
      } else {
        const j = await r.json()
        onUpdate({ myReaction: j.myReaction || null })
      }
    } catch {
      onUpdate({ myReaction: wasLiked ? 'like' : null, likes: card.likes })
    } finally { setBusyAction(null) }
  }

  const onSave = async () => {
    if (!isUserPost) return
    if (!requireAuth('save')) return
    if (busyAction) return
    const wasSaved = !!card.savedByMe
    onUpdate({
      savedByMe: !wasSaved,
      saves: Math.max(0, (card.saves || 0) + (wasSaved ? -1 : 1)),
    })
    setBusyAction('save')
    try {
      const r = await fetch(`/api/community/posts/${card.id}/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        onUpdate({ savedByMe: wasSaved, saves: card.saves })
        toast.error('Could not save')
      } else {
        toast.success(j.saved ? 'Saved' : 'Removed from saved')
      }
    } catch {
      onUpdate({ savedByMe: wasSaved, saves: card.saves })
    } finally { setBusyAction(null) }
  }

  const onShare = async () => {
    const url = typeof window !== 'undefined'
      ? new URL(card.href || `/community/posts/${card.id}`, window.location.origin).toString()
      : (card.href || '')
    const shareData = {
      title: card.title || 'DumpMaps',
      text: (card.description || card.title || '').slice(0, 200),
      url,
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      } else {
        toast.success(url)
      }
    } catch (e) {
      if (e?.name !== 'AbortError') toast.error('Share failed')
    }
  }

  return (
    <>
    <Card className="overflow-hidden rounded-2xl border-neutral-200/80 shadow-sm transition hover:shadow-md">
      <CardContent className="p-0">
        {/* Author row (only for user posts) */}
        {isUserPost && (
          <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <AuthorAvatar author={card.author} />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold text-neutral-900">{card.author?.name || 'User'}</div>
                <div className="text-xs text-neutral-500">{timeAgoShort(card.createdAt)}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${meta.tone}`}>
                <Icon className="h-3 w-3" /> {meta.label}
              </span>
              <PostOwnerMenu canManage={canManage} onEdit={() => setEditOpen(true)} onDelete={deletePost} size="sm" />
            </div>
          </div>
        )}

        {/* Header strip for aggregate cards */}
        {!isUserPost && (
          <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${meta.tone}`}>
              <Icon className="h-3 w-3" /> {meta.label}
            </span>
            <span className="text-xs text-neutral-400">{timeAgoShort(card.createdAt)}</span>
          </div>
        )}

        {/* Body */}
        <div className="px-4 pb-3 pt-2.5">
          {card.title && <h3 className="text-[15px] font-bold leading-snug text-neutral-900">{card.title}</h3>}
          {isJob && card.budget != null && (
            <div className="mt-1 text-xl font-bold tracking-tight text-green-700">${Number(card.budget).toLocaleString()}</div>
          )}
          {isBounty && (
            <div className="mt-2 rounded-xl border border-green-200 bg-green-50 p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-green-900">
                <span>Goal: ${Number(card.fundingGoalUsd || 0).toLocaleString()}</span>
                <span>Raised: ${Number(card.fundedUsd || 0).toLocaleString()}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-green-200">
                <div className="h-full bg-green-600" style={{ width: `${Math.min(100, Math.round(((card.fundedUsd || 0) / Math.max(1, card.fundingGoalUsd || 1)) * 100))}%` }} />
              </div>
            </div>
          )}
          {card.description && <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-neutral-600">{card.description}</p>}
          {(card.location?.city || card.city) && (
            <div className="mt-2 inline-flex items-center gap-1 text-xs text-neutral-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {[card.location?.city || card.city, card.location?.state || card.state].filter(Boolean).join(', ')}
            </div>
          )}
        </div>

        {/* Image — fixed, compact aspect box so photos and the fallback fill it
            consistently without dominating the feed. */}
        {cover && (
          <Link href={card.href || '#'} className="block">
            <div className="relative aspect-[16/9] max-h-56 w-full overflow-hidden bg-neutral-100">
              <SafeImage src={cover} alt={card.title || ''} kind="post" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          </Link>
        )}

        {/* Footer */}
        {isUserPost ? (
          <>
            <div className="flex items-center justify-between gap-1 border-t border-neutral-100 px-2 py-1 text-xs">
              <div className="flex items-center gap-0.5">
                <ActionButton onClick={onLike} active={!!card.myReaction} icon={Heart} label={card.likes || 0} activeTone="text-rose-600 fill-rose-600" />
                <button
                  onClick={() => setCommentsOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition hover:bg-neutral-100 ${commentsOpen ? 'text-brand-700' : 'text-neutral-600'}`}
                >
                  <MessageSquare className="h-4 w-4" /> {card.comments || 0}
                </button>
                <ActionButton onClick={onSave} active={!!card.savedByMe} icon={Bookmark} label={card.saves || 0} activeTone="text-brand-600 fill-brand-600" />
                <ActionButton onClick={onShare} active={false} icon={Share2} label="" activeTone="text-brand-600" />
                <span className="ml-1 inline-flex items-center gap-1 px-1.5 text-[11px] text-neutral-400">
                  <Eye className="h-3.5 w-3.5" /> {card.views || 0}
                </span>
              </div>
              {card.href && (
                <Link href={card.href} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                  View →
                </Link>
              )}
            </div>
            {commentsOpen && (
              <InlineComments
                postId={card.id}
                user={user}
                requireAuth={requireAuth}
                onCommented={() => onUpdate({ comments: (card.comments || 0) + 1 })}
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2.5 text-xs text-neutral-500">
            <div className="flex items-center gap-3.5">
              <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> {card.likes || 0}</span>
              <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {card.comments || 0}</span>
              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {card.views || 0}</span>
            </div>
            {card.href && (
              <Link href={card.href} className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800">
                {isJob ? 'View Job' : isBounty ? 'Contribute' : card.type === 'donation_need' ? 'Help' : 'View'} →
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    {canManage && (
      <EditPostModal open={editOpen} onOpenChange={setEditOpen} post={card} onSave={editPost} />
    )}
    </>
  )
}

function ActionButton({ onClick, active, icon: Icon, label, activeTone }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition ${active ? activeTone : 'text-neutral-600'} hover:bg-neutral-100`}
    >
      <Icon className={`h-4 w-4 ${active && /fill-/.test(activeTone) ? 'fill-current' : ''}`} />
      {label !== '' && <span>{label}</span>}
    </button>
  )
}

function AuthorAvatar({ author }) {
  const url = author?.avatarUrl
  const initials = ((author?.name || 'U')[0] || 'U').toUpperCase()
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-bold text-brand-700 ring-1 ring-black/5">
      {url ? <SafeImage src={url} alt="" kind="avatar" fallbackWhenEmpty="none" className="h-full w-full object-cover" /> : initials}
    </div>
  )
}

function timeAgoShort(d) {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  const s = Math.round(ms / 1000)
  if (s < 60) return 'now'
  const m = Math.round(s / 60); if (m < 60) return `${m}m`
  const h = Math.round(m / 60); if (h < 24) return `${h}h`
  const day = Math.round(h / 24); if (day < 30) return `${day}d`
  const mo = Math.round(day / 30); if (mo < 12) return `${mo}mo`
  return `${Math.round(mo / 12)}y`
}

/* =========================================================================
   INLINE COMMENTS
   ----------------------------------------------------------------------
   Lightweight collapsible comments block rendered inside FeedCard. Fetches
   the full post (via /api/community/posts/:id which already returns
   author-enriched comments) the first time it's expanded, caches the list,
   and provides a composer for logged-in users. Logged-out → SoftLoginModal.
   ========================================================================= */
function InlineComments({ postId, user, requireAuth, onCommented }) {
  const [list, setList] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [text, setText] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [showAll, setShowAll] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/community/posts/${postId}`)
        const j = await r.json()
        if (!cancelled && r.ok) setList(Array.isArray(j.comments) ? j.comments : [])
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [postId])

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!requireAuth('comment')) return
    const value = text.trim()
    if (!value || submitting) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: value }),
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Could not post comment'); return }
      setList((arr) => [...arr, j.comment])
      setText('')
      onCommented?.()
    } catch { toast.error('Could not post comment') } finally { setSubmitting(false) }
  }

  const visible = showAll ? list : list.slice(-3)

  return (
    <div className="border-t border-neutral-100 bg-neutral-50/40 px-3 py-3">
      {loading ? (
        <div className="flex items-center gap-1 text-xs text-neutral-400"><Loader2 className="h-3 w-3 animate-spin" /> Loading comments…</div>
      ) : list.length === 0 ? (
        <div className="text-xs text-neutral-500">No comments yet — be the first.</div>
      ) : (
        <>
          {!showAll && list.length > 3 && (
            <button onClick={() => setShowAll(true)} className="mb-2 text-[11px] font-bold text-brand-700 hover:underline">
              View all {list.length} comments
            </button>
          )}
          <ul className="space-y-2">
            {visible.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                  {(c.author?.name?.[0] || 'U').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 rounded-lg bg-white px-2.5 py-1.5 text-xs shadow-sm">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate font-bold text-neutral-900">{c.author?.name || 'User'}</span>
                    <span className="text-[10px] text-neutral-400">{timeAgoShort(c.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-neutral-700">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Composer */}
      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => { if (!user) requireAuth('comment') }}
          placeholder={user ? 'Add a comment…' : 'Sign in to comment…'}
          className="flex-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm placeholder:text-neutral-400 focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300"
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
          title="Post comment"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </form>
    </div>
  )
}

function EmptyState({ filter, onPost }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
          <MessageSquare className="h-6 w-6 text-neutral-400" />
        </div>
        <h3 className="text-base font-bold text-neutral-800">
          {filter === 'mine' ? "You haven't posted yet" : 'Nothing here yet'}
        </h3>
        <p className="text-sm text-neutral-600">
          {filter === 'mine'
            ? 'Your posts will show up here once you share something.'
            : <>Be the first to post in the <b>{filter}</b> feed.</>}
        </p>
        <Button onClick={onPost} className="bg-green-700 hover:bg-green-800">
          <Plus className="mr-1.5 h-4 w-4" /> Create a post
        </Button>
      </CardContent>
    </Card>
  )
}

function FeedSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <Card key={i}><CardContent className="space-y-2 p-3">
          <div className="h-3 w-1/4 animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200" />
          <div className="h-40 animate-pulse rounded bg-neutral-100" />
        </CardContent></Card>
      ))}
    </>
  )
}

/* =========================================================================
   COMPOSER MODAL
   ========================================================================= */
function ComposerModal({ onClose, onCreated, user, router }) {
  const [stage, setStage] = useState('pick') // 'pick' | 'compose'
  const [type, setType] = useState('general')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)

  const meta = POST_TYPES.find((p) => p.value === type) || POST_TYPES[0]

  const submit = async () => {
    if (!user) {
      toast.error('Please log in to post')
      onClose?.()
      return
    }
    if (!title.trim() && !body.trim()) {
      toast.error('Add a title or some text')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/activity-hub/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title, body, photos }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Post failed')
      toast.success('Post published')
      onCreated(j.post)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <button onClick={stage === 'compose' ? () => setStage('pick') : onClose} className="text-neutral-500 hover:text-neutral-900">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-base font-bold">{stage === 'pick' ? 'Create Post' : meta.label}</h2>
          {stage === 'compose' ? (
            <Button size="sm" onClick={submit} disabled={busy} className="bg-green-700 hover:bg-green-800">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          ) : <span className="w-9" />}
        </header>

        {stage === 'pick' && (
          <div className="max-h-[70vh] overflow-y-auto p-2">
            <p className="px-2 py-2 text-center text-xs text-neutral-500">What would you like to post?</p>
            <div className="space-y-1.5">
              {POST_TYPES.map((opt) => {
                const Icon = opt.icon
                return (
                  <button key={opt.value}
                    onClick={() => {
                      if (opt.href) { router.push(opt.href); onClose(); return }
                      setType(opt.value); setStage('compose')
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left hover:border-green-300 hover:bg-green-50/30"
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${opt.tone}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-neutral-900">{opt.label}</div>
                      <div className="text-xs text-neutral-500">{opt.desc}</div>
                    </div>
                    <ChevronDown className="-rotate-90 text-neutral-400" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {stage === 'compose' && (
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${meta.tone}`}>
              <meta.icon className="h-3 w-3" /> {meta.label}
            </div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="What's happening?" />
            <MediaUploader
              variant="gallery" multi maxFiles={6}
              value={photos}
              onChange={setPhotos}
              helpText="Add up to 6 photos (optional)"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function timeAgo(d) {
  if (!d) return ''
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
