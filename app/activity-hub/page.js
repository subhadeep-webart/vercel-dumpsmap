'use client'

// /activity-hub — DumpMaps Activity Hub (Option 2 redesign)
//
// Thin orchestration component. Data reads live in hooks/use-activity-hub
// (useSWRInfinite feed); writes in hooks/use-activity-hub-actions; constants in
// constants/activity_hub_constants; presentation in components/activity-hub/*.
// This file only wires them together and lays out the page.
//
// Logged-in home feed. Replaces separate Live Feed + Community surfaces.
// Mobile-first; clean visual cards; story-style filter bar; FAB composer.

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PenLine, Loader2, Sparkles } from 'lucide-react'
import PageShell from '@/components/PageShell'
import { useRequireAuth, SoftLoginModal } from '@/components/SoftLoginModal'
import RouteFeatureLock from '@/components/RouteFeatureLock'
import { resolveComposeType, resolveFilter } from '@/constants/activity_hub_constants'
import { useActivityHub } from '@/hooks/use-activity-hub'
import { useActivityHubActions } from '@/hooks/use-activity-hub-actions'
import ComposerPrompt from '@/components/activity-hub/ComposerPrompt'
import FilterBar from '@/components/activity-hub/FilterBar'
import FeedCard from '@/components/activity-hub/FeedCard'
import ComposerModal from '@/components/activity-hub/ComposerModal'
import { EmptyState, FeedSkeleton } from '@/components/activity-hub/FeedStates'

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

function ActivityHubInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, requireAuth, softLogin, setSoftLogin } = useRequireAuth()

  const [filter, setFilter] = useState(() => resolveFilter(searchParams.get('filter')))
  const [composerOpen, setComposerOpen] = useState(false)
  // When the composer is opened via ?compose=<type> (e.g. from the GlobalFab),
  // jump straight to that post type instead of the "pick a type" step.
  const [composerType, setComposerType] = useState(null)

  const { feed, loading, loadingMore, hasMore, loadMore, mutate } = useActivityHub(filter)
  const actions = useActivityHubActions({ mutate })

  const sentinelRef = useRef(null)

  // Deep-link: ?compose=<type> opens the composer straight to that post type
  // (used by the GlobalFab's quick actions, e.g. ?compose=donation_need). We
  // gate on auth like the pen FAB, then strip the param so a refresh/back
  // doesn't re-open the modal.
  useEffect(() => {
    const composeType = resolveComposeType(searchParams.get('compose'))
    if (!composeType) return
    if (requireAuth('post')) {
      setComposerType(composeType)
      setComposerOpen(true)
    }
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete('compose')
    const qs = sp.toString()
    router.replace(qs ? `/activity-hub?${qs}` : '/activity-hub', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Infinite scroll: fetch the next page when the sentinel scrolls into view.
  useEffect(() => {
    if (!sentinelRef.current) return undefined
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore()
    }, { rootMargin: '300px 0px' })
    io.observe(sentinelRef.current)
    return () => io.disconnect()
  }, [loadMore])

  return (
    <PageShell active="activity" maxWidth="max-w-2xl" bg="bg-neutral-50"
      breadcrumbs={[{ label: 'Activity Hub' }]}>
      {/* Hero */}
      <header className="mb-4">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">What&apos;s happening now?</h1>
        <p className="mt-0.5 text-sm text-neutral-600">Real-time updates from your community.</p>
      </header>

      <ComposerPrompt user={user} onOpen={() => { if (requireAuth('post')) setComposerOpen(true) }} />

      <FilterBar user={user} filter={filter} onChange={setFilter} />

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
              actions={actions}
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

      {/* Floating compose button (pen). Shown on all breakpoints. The extra
          third FAB on mobile came from MobileBottomNav's generic "Quick post" +
          button — that one is suppressed on /activity-hub (see MobileBottomNav)
          so mobile now shows just this pen + the GlobalFab quick-actions +. */}
      <button
        onClick={() => { if (requireAuth('post')) setComposerOpen(true) }}
        className="fixed bottom-32 right-4 md:right-6 z-40 inline-flex h-9 w-9 md:h-12 md:w-12 items-center justify-center rounded-full bg-green-700 text-white shadow-lg ring-4 ring-white hover:bg-green-800 md:bottom-28"
        title={user ? 'Create post' : 'Sign in to post'}
      >
        <PenLine className="h-5 w-5 md:h-6 md:w-6" />
      </button>

      {composerOpen && user && (
        <ComposerModal
          initialType={composerType}
          onClose={() => { setComposerOpen(false); setComposerType(null) }}
          onCreated={() => { setComposerOpen(false); setComposerType(null) }}
          user={user}
          router={router}
          createPost={actions.createPost}
        />
      )}

      {softLogin && (
        <SoftLoginModal action={softLogin} onClose={() => setSoftLogin(null)} />
      )}
    </PageShell>
  )
}
