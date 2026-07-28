'use client'

import { Suspense } from "react";
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CommunityCenter } from '@/components/Community'
import { DashboardDialog } from '@/components/Dashboard'
import { PhaseTeaserDialog } from '@/components/PhaseTeaser'
import { JobsDialog, JobPostDialog } from '@/components/Jobs'
import HomeShell from '@/components/HomeShell'
import FieldShell from '@/components/field/FieldShell'
import { useViewMode } from '@/lib/view-mode'
import MaintenanceGate from '@/components/MaintenanceGate'
import Landing from '@/components/home/Landing'
import MapPage from '@/components/home/MapPage'
import SubmitFacilityDialog from '@/components/home/SubmitFacilityDialog'
import AdminDialog from '@/components/home/AdminDialog'
import AuthDialog from '@/components/home/AuthDialog'
import ProfileDialog from '@/components/home/ProfileDialog'

// ---------- App ----------
// useSearchParams() must live inside a <Suspense> boundary (see the App wrapper
// exported below) so the page can be statically prerendered without a
// client-side-rendering bailout.
function AppInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { viewMode, isMobile } = useViewMode()
  const [view, setView] = useState('landing')
  const [submitOpen, setSubmitOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [communityOpen, setCommunityOpen] = useState(false)
  const [communityTab, setCommunityTab] = useState('community')
  const [teaserKey, setTeaserKey] = useState(null)
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [pendingReport, setPendingReport] = useState(null)
  const [pendingJump, setPendingJump] = useState(null)
  const [user, setUser] = useState(null)
  const [favoriteIds, setFavoriteIds] = useState([])
  // Jobs module state
  const [jobsOpen, setJobsOpen] = useState(false)
  const [jobsInitialTab, setJobsInitialTab] = useState('feed')
  const [jobPostOpen, setJobPostOpen] = useState(false)
  const [pendingMapCenter, setPendingMapCenter] = useState(null)

  // Where to send the user after a successful sign-in. Defaults to /dashboard
  // so logged-in users never get bounced back to the marketing landing.
  const returnTo = (searchParams?.get('returnTo') || '/dashboard')

  // Auto-pop the auth dialog when the URL says ?login=1 (deep-linked from
  // protected pages like /dashboard).
  useEffect(() => {
    if (searchParams?.get('login') === '1') {
      setAuthOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!token) return
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.user) {
          setUser(j.user)
          fetch('/api/users/me/contributions', { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((c) => setFavoriteIds(c.favoriteIds || []))
          // Logged-in users landing on "/" should be sent to their dashboard
          // instead of the marketing landing. We use replace so the back
          // button doesn't bounce them back to the brochure.
          if (typeof window !== 'undefined' && window.location.pathname === '/') {
            // Respect ?returnTo when present (e.g. came from a protected page).
            const target = searchParams?.get('returnTo') || '/dashboard'
            router.replace(target)
          }
        }
      })
  }, [router, searchParams])

  const logout = () => {
    clearAuthToken()
    setUser(null)
    setFavoriteIds([])
    setProfileOpen(false)
    toast.success('Logged out')
  }

  const toggleFavorite = async (facilityId) => {
    if (!user) {
      toast('Log in to save favorites')
      setAuthOpen(true)
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
    onLogin: () => setAuthOpen(true),
    onProfile: () => setProfileOpen(true),
    onLogout: logout,
    onAdmin: () => setAdminOpen(true),
  }

  const openCommunity = (tab = 'community') => { setTeaserKey('community_board') }
  const openTeaser = (key) => setTeaserKey(key)

  // global teaser listener (for owner claim button etc.)
  useEffect(() => {
    const h = (e) => setTeaserKey(e.detail || 'community_board')
    window.addEventListener('dm:teaser', h)
    return () => window.removeEventListener('dm:teaser', h)
  }, [])

  const dashboardJump = (facilityId) => {
    setDashboardOpen(false)
    setPendingJump(facilityId)
    setView('map')
  }

  const dashboardReport = (facility) => {
    setDashboardOpen(false)
    setPendingReport(facility)
    setView('map')
  }

  return (
    <MaintenanceGate user={user}>
    <>
      {view === 'landing' && (
        <Landing
          onEnterMap={() => setView('home')}
          onSubmit={() => setSubmitOpen(true)}
          userMenu={userMenuProps}
          onCommunity={openCommunity}
          onDashboard={() => setDashboardOpen(true)}
          user={user}
        />
      )}
      {view === 'home' && (
        viewMode === 'field' && isMobile ? (
          <FieldShell
            user={user}
            onOpenStandard={() => { /* Standard mode is restored via setViewMode('standard') from inside FieldShell */ }}
            onOpenJob={(post) => { if (post?._raw?.id) { setJobsInitialTab('feed'); setJobsOpen(true) } }}
            onOpenListing={(post) => { /* TODO open listing dialog */ }}
            onOpenSubmitFacility={() => setSubmitOpen(true)}
            onOpenLogin={() => setAuthOpen(true)}
            onJumpHotspot={() => setView('map')}
          />
        ) : (
          <HomeShell
            onOpenMap={() => setView('map')}
            onHome={() => { if (user) { router.push('/dashboard') } else { setView('landing') } }}
            onSubmitFacility={() => setSubmitOpen(true)}
            onPostJob={() => { if (!user) { setAuthOpen(true); return; } setJobPostOpen(true) }}
            onPostAlert={() => { setView('map') /* user picks a facility pin */ }}
            onCommunity={openCommunity}
            onJobs={(tab = 'feed') => { setJobsInitialTab(tab); setJobsOpen(true) }}
            onLogin={() => setAuthOpen(true)}
            onProfile={() => setProfileOpen(true)}
            onAdmin={() => setAdminOpen(true)}
            user={user}
            onFacilityOpen={(id) => {
              // Feed-first: navigate to the facility profile page rather than forcing map view
              if (typeof window !== 'undefined') window.location.href = `/facilities/${id}`
            }}
          />
        )
      )}
      {view === 'map' && (
        <MapPage
          onExit={() => setView('home')}
          onSubmit={() => setSubmitOpen(true)}
          openAdmin={() => setAdminOpen(true)}
          userMenu={userMenuProps}
          user={user}
          favoriteIds={favoriteIds}
          toggleFavorite={toggleFavorite}
          onCommunity={openCommunity}
          onDashboard={() => setDashboardOpen(true)}
          pendingReport={pendingReport}
          consumePendingReport={() => setPendingReport(null)}
          pendingJump={pendingJump}
          consumePendingJump={() => setPendingJump(null)}
          onJobs={(tab = 'feed') => { setJobsInitialTab(tab); setJobsOpen(true) }}
          onPostJob={() => { if (!user) { setAuthOpen(true); return; } setJobPostOpen(true) }}
        />
      )}
      <SubmitFacilityDialog open={submitOpen} onOpenChange={setSubmitOpen} />
      <AdminDialog open={adminOpen} onOpenChange={setAdminOpen} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={searchParams?.get('mode') === 'signup' ? 'signup' : 'login'} onAuth={(u) => {
        setUser(u)
        setAuthOpen(false)
        // Sweep logged-in users to /dashboard (or wherever returnTo says) so
        // they never get dropped on the marketing landing post-login.
        try { router.push(returnTo) } catch {}
      }} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} user={user} onUpdated={setUser} onLogout={logout} />
      <CommunityCenter open={communityOpen} onOpenChange={setCommunityOpen} currentUser={user} initialTab={communityTab} />
      <PhaseTeaserDialog open={!!teaserKey} onOpenChange={(v) => !v && setTeaserKey(null)} featureKey={teaserKey || 'community_board'} />
      <DashboardDialog
        open={dashboardOpen}
        onOpenChange={setDashboardOpen}
        user={user}
        onJumpFacility={dashboardJump}
        onReport={dashboardReport}
        onCommunity={openCommunity}
      />
      <JobsDialog
        open={jobsOpen}
        onOpenChange={setJobsOpen}
        initialTab={jobsInitialTab}
        user={user}
        onAuthRequest={() => setAuthOpen(true)}
        onMapJump={(coords) => {
          if (coords) setPendingMapCenter(coords)
          setJobsOpen(false)
          setView('map')
        }}
      />
      <JobPostDialog
        open={jobPostOpen}
        onOpenChange={setJobPostOpen}
        user={user}
        onPosted={() => { setJobPostOpen(false); setJobsInitialTab('mine'); setJobsOpen(true) }}
      />
    </>
    </MaintenanceGate>
  )
}

function App() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-neutral-50" />}>
      <AppInner />
    </Suspense>
  )
}

export default App
