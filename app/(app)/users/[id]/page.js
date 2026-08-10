'use client'

// /users/[id] — public, Facebook-mobile-style profile page.
// ----------------------------------------------------------------------------
// The read-only, viewable-by-anyone counterpart to the /profile editor. Content-
// first single column: cover + floating avatar → name/badges → action row →
// scrollable pill nav → feed (About · Posts · Listings · Reviews).
//
// Layout:
//   ┌────────────────────────────────────────┐
//   │ Cover image                            │  → PublicProfileHero
//   │ Avatar  Name · Verified · Role         │
//   │         Company · Location · Website   │
//   ├────────────────────────────────────────┤
//   │ [ Message ]  [ Share ]                 │  → PublicProfileActions
//   ├────────────────────────────────────────┤
//   │ About · Posts · Listings · Reviews     │  → PublicProfilePillNav
//   ├────────────────────────────────────────┤
//   │ Active tab content (single column)     │  → About / PublicProfileFeed
//   └────────────────────────────────────────┘
//
// This page is orchestration only: the public data + status machine live in
// usePublicProfile; the feed tabs lazy-load via usePublicProfileFeed. Private
// profiles (viewed by anyone but the owner) render the hero stub + a private
// notice instead of the tabs.

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import { usePublicProfile } from '@/hooks/use-public-profile'
import PublicProfileHero from '@/components/user-profile/PublicProfileHero'
import PublicProfileActions from '@/components/user-profile/PublicProfileActions'
import PublicProfilePillNav from '@/components/user-profile/PublicProfilePillNav'
import PublicProfileAbout from '@/components/user-profile/PublicProfileAbout'
import PublicProfileFeed from '@/components/user-profile/PublicProfileFeed'
import {
  PublicProfileSkeleton, PublicProfileNotFound,
  PublicProfileError, PublicProfilePrivate,
} from '@/components/user-profile/PublicProfileStates'

export default function PublicProfilePage() {
  const params = useParams()
  const id = params?.id

  const { status, user, isOwner, isPrivate, stats, retry } = usePublicProfile(id)
  const [activeTab, setActiveTab] = useState('about')
  // Track which feed tabs have been opened so their data only fetches on demand
  // (and stays cached once loaded). About is always present; it needs no fetch.
  const [loadedTabs, setLoadedTabs] = useState(() => new Set())

  const changeTab = (key) => {
    setActiveTab(key)
    if (key === 'posts' || key === 'listings') {
      setLoadedTabs((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
    }
  }

  if (status === 'loading') return <PublicProfileSkeleton />
  if (status === 'not-found') return <PublicProfileNotFound />
  if (status === 'error' || !user) return <PublicProfileError onRetry={retry} />

  // Private profile viewed by a non-owner: show the avatar/name stub hero (no
  // cover/tabs/feed) followed by the private notice.
  if (isPrivate) {
    return (
      <div className="min-h-screen bg-neutral-50 pb-16">
        <PublicProfileHero user={user} stats={stats} />
        <PublicProfilePrivate name={user.name} />
      </div>
    )
  }

  const counts = { posts: stats.posts, listings: stats.listings }

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <PublicProfileHero user={user} stats={stats} />
      <PublicProfileActions user={user} isOwner={isOwner} />

      <PublicProfilePillNav activeTab={activeTab} onChange={changeTab} counts={counts} />

      <main className="container mx-auto px-4 py-6">
        {/* Keyed by activeTab so switching remounts + replays the dm-tab-panel
            fade+slide, matching the editor's tab transitions. */}
        <div key={activeTab} className="dm-tab-panel">
          {activeTab === 'about'
            ? <PublicProfileAbout user={user} />
            : <PublicProfileFeed activeTab={activeTab} id={user.id} name={user.name} loadedTabs={loadedTabs} />}
        </div>
      </main>
    </div>
  )
}
