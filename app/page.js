'use client'

import { Suspense } from "react";
import { useState } from 'react'
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
import { useHome } from '@/hooks/use-home'
import { useHomeActions } from '@/hooks/use-home-actions'

// ---------- App ----------
// useSearchParams() must live inside a <Suspense> boundary (see the App wrapper
// exported below) so the page can be statically prerendered without a
// client-side-rendering bailout.
function AppInner() {
  const { viewMode, isMobile } = useViewMode()

  // Session + data reads, deep-link auth popup, landing→dashboard sweep, and the
  // global teaser listener all live in useHome.
  const {
    router, returnTo,
    user, setUser,
    favoriteIds, setFavoriteIds,
    authOpen, setAuthOpen,
    authMode, setAuthMode,
    teaserKey, setTeaserKey,
  } = useHome()

  // Pure view state — which screen is showing + dialog visibility.
  const [view, setView] = useState('landing')
  const [submitOpen, setSubmitOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [communityOpen, setCommunityOpen] = useState(false)
  const [communityTab, setCommunityTab] = useState('community')
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [pendingReport, setPendingReport] = useState(null)
  const [pendingJump, setPendingJump] = useState(null)
  // Jobs module state
  const [jobsOpen, setJobsOpen] = useState(false)
  const [jobsInitialTab, setJobsInitialTab] = useState('feed')
  const [jobPostOpen, setJobPostOpen] = useState(false)
  const [pendingMapCenter, setPendingMapCenter] = useState(null)

  const { logout, toggleFavorite } = useHomeActions({
    user, setUser, setFavoriteIds, setAuthOpen, setProfileOpen,
  })

  const userMenuProps = {
    user,
    onLogin: () => { setAuthMode('login'); setAuthOpen(true) },
    onRegister: () => { setAuthMode('signup'); setAuthOpen(true) },
    onProfile: () => setProfileOpen(true),
    onLogout: logout,
    onAdmin: () => setAdminOpen(true),
  }

  const openCommunity = (tab = 'community') => { setTeaserKey('community_board') }
  const openTeaser = (key) => setTeaserKey(key)

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
            onLogin={userMenuProps.onLogin}
            onRegister={userMenuProps.onRegister}
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
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} onAuth={(u) => {
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
