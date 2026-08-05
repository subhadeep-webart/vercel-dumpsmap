'use client'

import { useState } from 'react'
import { useLogout } from '@/hooks/use-logout'
import { MarketplaceTab, InboxDialog, useInboxBadge, MarketplaceDetailDialog } from '@/components/Marketplace'
import SiteHeader from '@/components/SiteHeader'
import FacilitiesTab from '@/components/facilities/FacilitiesTab'
import FeedTab from '@/components/home/FeedTab'
import JobsTab from '@/components/home/JobsTab'
import ContextualActionBar from '@/components/home/ContextualActionBar'
import HomeBottomNav from '@/components/home/HomeBottomNav'
import HomePostSheet from '@/components/home/HomePostSheet'

// ============================================================
// HOME SHELL  ·  list/feed primary, map secondary
// ============================================================
export default function HomeShell({
  onOpenMap,
  onSubmitFacility,
  onPostJob,
  onPostAlert,
  onCommunity,
  onJobs,
  onLogin,
  onRegister,
  onProfile,
  onAdmin,
  user,
  onFacilityOpen,
}) {
  const [tab, setTab] = useState('feed')
  const [postOpen, setPostOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [marketDetailId, setMarketDetailId] = useState(null)
  const unread = useInboxBadge(user)
  const logout = useLogout()

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full max-w-[100vw] flex-col overflow-x-hidden bg-neutral-50">
      {/* TOP — premium SiteHeader (replaces old inline header) */}
      <SiteHeader
        user={user}
        onLogin={onLogin}
        onRegister={onRegister}
        onProfile={onProfile}
        onLogout={() => logout()}
        onAdmin={onAdmin}
        onDashboard={onProfile /* dashboard launches via profile */}
        onSubmit={onSubmitFacility}
        onEnterApp={(t) => { if (t && ['feed','facilities','marketplace','jobs','community'].includes(t)) { if (t === 'community') { window.location.href = '/community' } else { setTab(t) } } }}
        notificationsCount={unread}
        active={tab}
      />

      {/* CONTEXTUAL ACTION BAR — changes per active tab. Replaces old "App shell" toolbar. */}
      <ContextualActionBar
        tab={tab}
        setTab={setTab}
        user={user}
        unread={unread}
        onOpenMap={onOpenMap}
        onSubmitFacility={onSubmitFacility}
        onPostJob={onPostJob}
        onJobs={onJobs}
        onLogin={onLogin}
      />

      {/* TABS · Mobile uses bottom nav. Desktop uses top primary nav from SiteHeader —
          no second tab row needed (was duplicated nav per UI audit). */}

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-3xl px-3 py-3 md:py-6">
          {tab === 'feed' && <FeedTab onFacilityOpen={onFacilityOpen} onJobs={() => setTab('jobs')} onJobsDialog={onJobs} onOpenMap={onOpenMap} onMarket={() => setTab('marketplace')} />}
          {tab === 'facilities' && <FacilitiesTab onFacilityOpen={onFacilityOpen} onOpenMap={onOpenMap} />}
          {tab === 'jobs' && <JobsTab user={user} onLogin={onLogin} onPostJob={onPostJob} onJobsDialog={onJobs} />}
          {tab === 'marketplace' && <MarketplaceTab user={user} onLogin={onLogin} />}
          {/* community tab routes away via Tabs onValueChange — no in-shell landing */}
        </div>
      </main>

      {/* MOBILE BOTTOM NAV — feed-first architecture (Home / Community / + / Jobs / Alerts / Profile) */}
      <HomeBottomNav
        tab={tab}
        setTab={setTab}
        user={user}
        unread={unread}
        onPost={() => setPostOpen(true)}
        onAlerts={() => setInboxOpen(true)}
        onProfile={onProfile}
        onLogin={onLogin}
      />

      {/* DESKTOP + POST FAB & POST SHEET */}
      <HomePostSheet
        open={postOpen}
        onOpenChange={setPostOpen}
        onPostJob={onPostJob}
        onPostMarketplace={() => setTab('marketplace')}
        onPostAlert={onPostAlert}
        onSubmitFacility={onSubmitFacility}
        onCommunity={onCommunity}
        onOpenMap={onOpenMap}
      />

      {/* INBOX */}
      <InboxDialog
        open={inboxOpen}
        onOpenChange={setInboxOpen}
        user={user}
        onAuthRequest={onLogin}
        onOpenListing={(id) => { setInboxOpen(false); setMarketDetailId(id) }}
        onOpenJob={(jobId) => { setInboxOpen(false); onJobs?.('feed') }}
      />
      <MarketplaceDetailDialog
        listingId={marketDetailId}
        onClose={() => setMarketDetailId(null)}
        user={user}
        onAuthRequest={onLogin}
      />
    </div>
  )
}

// Re-export FacilitiesTab (now defined in components/facilities/FacilitiesTab)
// as a named export so existing importers — including the standalone
// /facilities directory page — keep working unchanged.
export { FacilitiesTab }
