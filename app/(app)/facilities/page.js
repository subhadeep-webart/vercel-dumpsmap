'use client'

// /facilities — standalone facilities directory page with an in-place Map View.
//
// Two views live on this one URL (no navigation away):
//   • Feed view — the proven <FacilitiesTab /> directory (cards, filters,
//     search, near-me, sort). Identical to the in-app feed.
//   • Map view — the existing <MapPage /> Leaflet shell: every facility plotted
//     as a pin, live facility status / alerts / announcements in popups, live
//     feed sidebar, and facility detail. Reused verbatim from the homepage map.
//
// The "Map view" toggle in the FacilitiesToolbar flips local `view` state
// instead of routing to /?view=map, so the URL stays /facilities and it reads
// as a single page with two ways to look at the same facilities.
//
// Data/logic (current user, favorites read, favorite toggle) lives in the
// use-facilities.js / use-facilities-actions.js hooks; this file stays a thin
// view that wires them into the two sub-views.
//
// Navigation:
//   • Logo → /dashboard (logged in) or / (logged out) via <HomeBrandLink />.
//   • Facility card click → router.push('/facilities/:id') (the real detail page).
//   • Map "Back to Feed" → returns to the directory (onExit).

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import RouteFeatureLock from '@/components/RouteFeatureLock'
import { FacilitiesTab } from '@/components/HomeShell'
import FacilitiesHero from '@/components/facilities/FacilitiesHero'
import MapPage from '@/components/home/MapPage'
import AuthDialog from '@/components/home/AuthDialog'
import { clearAuthToken } from '@/hooks/use-logout'
import { useFacilitiesDirectory } from '@/hooks/use-facilities'
import { useFacilitiesActions } from '@/hooks/use-facilities-actions'

export default function FacilitiesIndexPage() {
  return (
    <RouteFeatureLock featureKey="facilities">
      <FacilitiesIndexInner />
    </RouteFeatureLock>
  )
}

function FacilitiesIndexInner() {
  const router = useRouter()
  const [view, setView] = useState('feed') // 'feed' | 'map'

  // Current user + favorites bootstrap (see hooks/use-facilities.js).
  const { user, setUser, favoriteIds, setFavoriteIds } = useFacilitiesDirectory()
  const { toggleFavorite } = useFacilitiesActions({ user, setFavoriteIds })

  // In-place auth dialog — opened by the check-in flow when a logged-out user
  // tries to check in, so they're not bounced to the homepage (?login=1).
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'signup'

  const openLogin = (mode = 'login') => { setAuthMode(mode); setAuthOpen(true) }

  // AuthDialog success: adopt the user in place (no navigation). Setting the user
  // flips the favorites SWR key on, so their favorites load automatically.
  const onAuthSuccess = (u) => {
    setUser(u)
  }

  const logout = () => {
    clearAuthToken()
    setUser(null)
    setFavoriteIds([])
    toast.success('Logged out')
  }

  const userMenuProps = {
    user,
    onLogin: () => router.push('/?login=1&returnTo=/facilities'),
    onProfile: () => router.push('/dashboard'),
    onLogout: logout,
  }

  // ---- Map view (in-place) ------------------------------------------------
  if (view === 'map') {
    return (
      <MapPage
        hideHeader
        onExit={() => setView('feed')}
        onSubmit={() => router.push('/?submit=1')}
        userMenu={userMenuProps}
        user={user}
        favoriteIds={favoriteIds}
        toggleFavorite={toggleFavorite}
        onCommunity={() => router.push('/community')}
        onDashboard={() => router.push('/dashboard')}
        onJobs={() => router.push('/?view=map')}
      />
    )
  }

  // ---- Feed view (directory) ----------------------------------------------
  return (
    <>
      {/* HERO */}
      <FacilitiesHero />

      {/* DIRECTORY */}
      <section className="container mx-auto px-4 py-6 sm:py-8">
        <FacilitiesTab
          onFacilityOpen={(id) => router.push(`/facilities/${id}`)}
          onOpenMap={() => setView('map')}
          onRequireLogin={openLogin}
        />
      </section>

      {/* In-place auth dialog (check-in / engagement gating) */}
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onAuth={onAuthSuccess}
        initialMode={authMode}
      />
    </>
  )
}
