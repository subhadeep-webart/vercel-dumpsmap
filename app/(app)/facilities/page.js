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
// Navigation:
//   • Logo → /dashboard (logged in) or / (logged out) via <HomeBrandLink />.
//   • Facility card click → router.push('/facilities/:id') (the real detail page).
//   • Map "Back to Feed" → returns to the directory (onExit).

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import RouteFeatureLock from '@/components/RouteFeatureLock'
import { FacilitiesTab } from '@/components/HomeShell'
import FacilitiesHero from '@/components/facilities/FacilitiesHero'
import MapPage from '@/components/home/MapPage'
import AuthDialog from '@/components/home/AuthDialog'
import { clearAuthToken } from '@/hooks/use-logout'

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
  const [user, setUser] = useState(null)
  const [favoriteIds, setFavoriteIds] = useState([])
  // In-place auth dialog — opened by the check-in flow when a logged-out user
  // tries to check in, so they're not bounced to the homepage (?login=1).
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'signup'

  const openLogin = (mode = 'login') => { setAuthMode(mode); setAuthOpen(true) }

  // Load favorites for the signed-in user (used on bootstrap and after login).
  const loadFavorites = (token) => {
    fetch('/api/users/me/contributions', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((c) => setFavoriteIds(c.favoriteIds || []))
      .catch(() => {})
  }

  // Lightweight auth bootstrap (mirrors app/page.js) so the map header shows the
  // right account state and favorites light up. No redirect side-effects here —
  // this page is not the landing page.
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!token) return
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.user) {
          setUser(j.user)
          loadFavorites(token)
        }
      })
      .catch(() => {})
  }, [])

  // AuthDialog success: adopt the user in place (no navigation) and load their
  // favorites. AuthDialog has already stored the token in localStorage.
  const onAuthSuccess = (u) => {
    setUser(u)
    const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (token) loadFavorites(token)
  }

  const logout = () => {
    clearAuthToken()
    setUser(null)
    setFavoriteIds([])
    toast.success('Logged out')
  }

  const toggleFavorite = async (facilityId) => {
    if (!user) {
      toast('Log in to save favorites')
      return
    }
    const token = localStorage.getItem('dm_token')
    const r = await fetch(`/api/favorites/${facilityId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const j = await r.json()
    if (j.favorited) {
      setFavoriteIds((arr) => [...arr, facilityId])
      toast.success('Saved to favorites')
    } else {
      setFavoriteIds((arr) => arr.filter((x) => x !== facilityId))
      toast('Removed from favorites')
    }
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
