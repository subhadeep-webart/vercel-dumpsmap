'use client'

// Facility Intelligence Center — Option 1 Redesign (Priority 3)
// ----------------------------------------------------------------------------
// A premium, Google-Business-Profile / Yelp / Waze inspired facility page that
// becomes the centerpiece of DumpMaps. Layout:
//
//   ┌──────────────────────────────────────────────┐
//   │ AppHeader (via (app) route-group layout)     │
//   │ Breadcrumbs                                  │
//   ├──────────────────────────────────────────────┤
//   │ Hero banner image (default stock or photo)   │
//   │  • Facility logo/icon + name overlay         │
//   │  • Badges: Verified, Rewards Partner, Status │
//   ├──────────────────────────────────────────────┤
//   │ Quick Stats Bar (status • wait • distance)   │
//   │ Primary Actions  (Directions · Call · Pay)   │
//   ├─────────────────────────┬────────────────────┤
//   │ Tabs: Overview | Materials | Pricing |       │
//   │       Rewards  | Updates  | Reviews          │
//   │                          │  Sidebar          │
//   │  [main content panel]    │  • Contact        │
//   │                          │  • Hours          │
//   │                          │  • Map preview    │
//   │                          │  • Photos         │
//   │                          │  • Ownership      │
//   └─────────────────────────┴────────────────────┘
//   [Mobile sticky action bar] (Directions/Call/Pay)
//
// This file is the orchestration layer only: data fetching, page state, and
// action handlers. The presentational sections live in
// components/facilities/detail/* and the constants in
// constants/facility_detail_constants.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { TABS, DEFAULT_HERO_IMAGE, facilityBreadcrumbs } from '@/constants/facility_detail_constants'
import Breadcrumbs from '@/components/Breadcrumbs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Save, AlertTriangle, Loader2 } from 'lucide-react'
import { getStatusMeta, FACILITY_TYPE_CONFIG } from '@/lib/facility-types'
import ClaimBusinessDialog from '@/components/ClaimBusinessDialog'
import { useFieldBack } from '@/lib/field-back'
import { useRequireAuth, SoftLoginModal } from '@/components/SoftLoginModal'
import QuickCheckInModal from '@/components/QuickCheckInModal'
import { isLikelyLoggedIn } from '@/lib/api-client'
import { useFacilityDetail } from '@/hooks/use-facility-detail'
import { useFacilityActions } from '@/hooks/use-facility-actions'
import { useShare } from '@/hooks/use-share'

import FacilityHero from '@/components/facilities/detail/FacilityHero'
import QuickStatsBar from '@/components/facilities/detail/QuickStatsBar'
import PrimaryActionBar from '@/components/facilities/detail/PrimaryActionBar'
import FacilityTabs from '@/components/facilities/detail/FacilityTabs'
import OverviewTab from '@/components/facilities/detail/OverviewTab'
import MaterialsTab from '@/components/facilities/detail/MaterialsTab'
import PricingTab from '@/components/facilities/detail/PricingTab'
import RewardsTab from '@/components/facilities/detail/RewardsTab'
import UpdatesTab from '@/components/facilities/detail/UpdatesTab'
import ReviewsTab from '@/components/facilities/detail/ReviewsTab'
import MobileStickyActions from '@/components/facilities/detail/MobileStickyActions'
import WriteReviewModal from '@/components/facilities/detail/WriteReviewModal'
import {
  SidebarContactCard, SidebarHoursCard, SidebarMapCard,
  SidebarPhotosCard, SidebarOwnershipCard, SidebarReportRow,
} from '@/components/facilities/detail/SidebarCards'
import {
  FacilityDetailSkeleton, FacilityNotFound, FacilityErrorState,
} from '@/components/facilities/detail/FacilityStates'

export default function FacilityProfilePage() {
  const params = useParams()
  const goBack = useFieldBack('/facilities')
  const id = params?.id

  // All page data fetching lives in the hook (facility, impact, user, claim).
  const {
    facility, reviews, error: err, usedFallback, loading,
    impact, user, myClaim, setMyClaim, reload: load,
  } = useFacilityDetail(id)

  const [claimOpen, setClaimOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  // Sprint A enhancement: status history + quick check-in trigger
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [statusHistoryKey, setStatusHistoryKey] = useState(0)
  // Active tab is initialised from the URL (?tab=reviews) so the tab is
  // linkable and survives a refresh. Only a known tab key is honoured.
  const validTabs = TABS.map((t) => t.key)
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'overview'
    const t = new URLSearchParams(window.location.search).get('tab')
    return validTabs.includes(t) ? t : 'overview'
  })
  const { requireAuth, softLogin, setSoftLogin } = useRequireAuth()

  // Change tab + reflect it in the URL (replaceState, so no scroll jump and no
  // extra history entry) so it can be linked/shared and restored on refresh.
  const changeTab = (key) => {
    setActiveTab(key)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', key)
      window.history.replaceState(null, '', url)
    }
  }

  // Keep the tab in sync if the user navigates with the browser back/forward
  // buttons (which change the URL without remounting the page).
  useEffect(() => {
    const onPop = () => {
      const t = new URLSearchParams(window.location.search).get('tab')
      setActiveTab(validTabs.includes(t) ? t : 'overview')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A "logged in?" hint passed to children (PrimaryActionBar, StartDmButton)
  // that gate messaging UI on it. All /api calls go through the api client /
  // fetch shim, which attaches the session cookie itself.
  const token = isLikelyLoggedIn()

  const populateEdit = (f) => setEditForm({
    hours: f.hours || '', phone: f.phone || '', website: f.website || '',
    accepted: (f.accepted || []).join(', '),
    notAccepted: (f.notAccepted || []).join(', '),
    currentStatus: f.currentStatus || '',
  })

  // Mirror server facility fields into the owner-edit form whenever fresh data
  // arrives (initial load, reload after a save/check-in).
  useEffect(() => {
    if (facility) populateEdit(facility)
  }, [facility])

  // Deep-link: open the claim dialog when the URL carries #claim.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#claim') {
      const t = setTimeout(() => setClaimOpen(true), 600)
      return () => clearTimeout(t)
    }
  }, [])

  // Facility write actions + share. These are hooks, so they MUST run on every
  // render — before any of the early returns below — or React sees a changing
  // hook count between the loading and loaded renders.
  const { postUpdate, saveOwnerEdit: saveOwnerEditAction, watch, pending } = useFacilityActions({
    id, requireAuth, onMutated: load,
  })
  const share = useShare()

  if (loading && !facility) return <FacilityDetailSkeleton onBack={goBack} />
  if (err === 'not_found') return <FacilityNotFound onBack={goBack} onRetry={load} id={id} />
  if (err === 'timeout') return <FacilityErrorState title="Took too long to load" detail="The server didn't respond in time. Check your connection and retry." onBack={goBack} onRetry={load} />
  if (err) return <FacilityErrorState title="Couldn't load this facility" detail={err} onBack={goBack} onRetry={load} />
  if (!facility) return <FacilityErrorState title="Facility didn't load" detail="The page settled without data. Try again." onBack={goBack} onRetry={load} />

  const isOwner = user && facility.claimedByUserId === user.id
  const isStaffUser = user && ['super_admin', 'admin', 'moderator'].includes(user.role)
  const isClaimed = !!facility.claimedByUserId
  const statusMeta = facility.currentStatus ? getStatusMeta(facility.currentStatus) : null
  const typeCfg = facility.typeKey ? FACILITY_TYPE_CONFIG[facility.typeKey] : null
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(facility.address || facility.name)}`
  const heroImg = (facility.images && facility.images[0]) || DEFAULT_HERO_IMAGE

  // UpdatesTab owns the draft + posting flag; postUpdate returns true on success
  // so the tab can clear its own textarea.
  const postOfficialUpdate = postUpdate

  const saveOwnerEdit = async () => {
    if (await saveOwnerEditAction(editForm)) setEditing(false)
  }

  const onShare = () => share({
    title: facility.name,
    text: `Check out ${facility.name} on DumpMaps`,
  })

  const onSave = watch

  // Open the community check-in modal (auth-gated). Wired to the previously
  // dead "Check In & Earn" / "Earn" buttons.
  const openCheckIn = () => { if (!requireAuth('checkin')) return; setCheckinOpen(true) }
  // Open the write-a-review modal (auth-gated). Wired to the previously dead
  // "Write a review" / mobile "Review" buttons.
  const openReview = () => { if (!requireAuth('review')) return; setReviewOpen(true) }

  return (
    <>
      {/* Header supplied by the (app) route-group layout; this page is full-bleed
          (PageShell previously ran with maxWidth={null}, padding=""). */}
      <Breadcrumbs maxWidth={null} items={facilityBreadcrumbs(facility.name)} />

      {usedFallback && (
        <div className="border-b border-neutral-200 bg-amber-50">
          <div className="container mx-auto flex items-center gap-2 px-4 py-1.5 text-[11px] text-amber-900">
            <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span>Sample facility (demo). Live data will replace this once verified.</span>
          </div>
        </div>
      )}

      {/* ============== HERO (condensed, full-bleed) ============== */}
      <FacilityHero
        facility={facility}
        heroImg={heroImg}
        typeCfg={typeCfg}
        statusMeta={statusMeta}
        isClaimed={isClaimed}
        onBack={goBack}
      />

      {/* ============== PRIMARY ACTIONS ============== */}
      <PrimaryActionBar
        facility={facility}
        directionsUrl={directionsUrl}
        isClaimed={isClaimed}
        isOwner={isOwner}
        isStaffUser={isStaffUser}
        token={token}
        editing={editing}
        onShare={onShare}
        onSave={onSave}
        saving={pending.watch}
        onClaim={() => { if (!requireAuth('claim')) return; setClaimOpen(true) }}
        onToggleEdit={() => setEditing((e) => !e)}
        onCheckIn={openCheckIn}
      />

      {myClaim && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="container mx-auto px-4 py-2 text-xs text-amber-900">
            Your claim request is currently <b>{myClaim.status}</b>. Submitted {new Date(myClaim.createdAt).toLocaleDateString()}.
          </div>
        </div>
      )}

      {/* ============== GOOGLE-MAPS SPLIT VIEW ============================
          Left column  → scrollable info panel: quick stats, sticky tabs, and
                         the active tab body.
          Right column → a large map that STAYS in view while the left panel
                         scrolls (position: sticky), followed by the place-info
                         cards — mirroring a Google Maps place page.
          On mobile the columns stack: stats → map → info cards → tabs body. */}
      <main className="container mx-auto grid grid-cols-1 gap-6 px-4 py-6 pb-28 lg:grid-cols-5 lg:items-start lg:pb-10">

        {/* ---------- LEFT: scrollable info panel ---------- */}
        <div className="min-w-0 lg:col-span-3">
          {/* Quick stats live at the top of the info panel (Maps-style header row) */}
          <div className="mb-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <QuickStatsBar facility={facility} statusMeta={statusMeta} bare />
          </div>

          {/* Map + place-info cards — shown INLINE here on mobile only; on desktop
              they live in the sticky right rail instead (hidden lg:block below). */}
          <div className="mb-4 space-y-4 lg:hidden">
            <SidebarMapCard facility={facility} directionsUrl={directionsUrl} />
            <SidebarContactCard facility={facility} editing={editing} editForm={editForm} setEditForm={setEditForm} />
            <SidebarHoursCard facility={facility} editing={editing} editForm={editForm} setEditForm={setEditForm} />
          </div>

          {/* Sticky tab bar — sticks below the app header while scrolling.
              Rendered as a clean white card with a single bottom hairline so the
              active-tab underline sits flush on it (not clipped). */}
          <div className="sticky top-14 z-20 mb-4 overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-sm backdrop-blur">
            <FacilityTabs active={activeTab} onChange={changeTab} />
          </div>

          {/* Pre-launch disclaimer */}
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span><b>Facility details may change.</b> Call ahead before arrival to confirm hours, fees, and accepted materials.</span>
          </div>

          <div className="space-y-4">
            {/* Keyed by the active tab so the panel remounts on every switch,
                replaying the dm-tab-panel fade+slide. Pure-CSS, respects
                prefers-reduced-motion. */}
            <div
              key={activeTab}
              id="facility-tabpanel"
              role="tabpanel"
              aria-labelledby={`facility-tab-${activeTab}`}
              tabIndex={0}
              className="dm-tab-panel space-y-4 focus:outline-none"
            >
              {activeTab === 'overview' && (
                <OverviewTab
                  facility={facility}
                  statusMeta={statusMeta}
                  editing={editing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  impact={impact}
                  statusHistoryKey={statusHistoryKey}
                  onCheckIn={() => setCheckinOpen(true)}
                />
              )}
              {activeTab === 'materials' && (
                <MaterialsTab facility={facility} editing={editing} editForm={editForm} setEditForm={setEditForm} />
              )}
              {activeTab === 'pricing' && (
                <PricingTab facility={facility} />
              )}
              {activeTab === 'rewards' && (
                <RewardsTab facility={facility} />
              )}
              {activeTab === 'updates' && (
                <UpdatesTab
                  facility={facility}
                  isOwner={isOwner}
                  isStaffUser={isStaffUser}
                  onPost={postOfficialUpdate}
                />
              )}
              {activeTab === 'reviews' && (
                <ReviewsTab facility={facility} reviews={reviews} onWriteReview={openReview} />
              )}
            </div>

            {/* Inline save panel when in edit mode */}
            {editing && (
              <Card className="border-brand-300 bg-brand-50/40">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="text-sm text-brand-900">
                    <b>Editing this facility.</b> Save your changes when ready.
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditing(false)} disabled={pending.save}>Cancel</Button>
                    <Button onClick={saveOwnerEdit} disabled={pending.save} className="bg-brand-600 hover:bg-brand-700">
                      {pending.save
                        ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</>
                        : <><Save className="mr-1.5 h-4 w-4" /> Save changes</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ---------- RIGHT: map rail (desktop) ----------
            Only the MAP is sticky, and it fills most of the viewport height so
            it reads as the immersive anchor of a Google-Maps place page. The
            place-info cards flow in normal order beneath it, so they scroll into
            view naturally (a fully-sticky stack taller than the viewport would
            clip its lower cards). */}
        <aside className="hidden lg:col-span-2 lg:block">
          <div className="sticky top-20">
            <SidebarMapCard facility={facility} directionsUrl={directionsUrl} mapClassName="h-[calc(100vh-7rem)] min-h-[24rem]" />
          </div>
          <div className="mt-4 space-y-4">
            <SidebarContactCard facility={facility} editing={editing} editForm={editForm} setEditForm={setEditForm} />
            <SidebarHoursCard facility={facility} editing={editing} editForm={editForm} setEditForm={setEditForm} />
            <SidebarPhotosCard facility={facility} />
            <SidebarOwnershipCard
              facility={facility}
              isClaimed={isClaimed}
              isStaffUser={isStaffUser}
              user={user}
              token={token}
              onClaim={() => { if (!requireAuth('claim')) return; setClaimOpen(true) }}
            />
            <SidebarReportRow facility={facility} />
          </div>
        </aside>

        {/* Ownership / photos / report — mobile placement (after tab body) */}
        <div className="space-y-4 lg:hidden">
          <SidebarPhotosCard facility={facility} />
          <SidebarOwnershipCard
            facility={facility}
            isClaimed={isClaimed}
            isStaffUser={isStaffUser}
            user={user}
            token={token}
            onClaim={() => { if (!requireAuth('claim')) return; setClaimOpen(true) }}
          />
          <SidebarReportRow facility={facility} />
        </div>
      </main>

      {/* ============== MOBILE STICKY ACTION BAR ============== */}
      <MobileStickyActions
        facility={facility}
        directionsUrl={directionsUrl}
        onCheckIn={openCheckIn}
        onReview={openReview}
      />

      <ClaimBusinessDialog open={claimOpen} onOpenChange={setClaimOpen} facility={facility} onSubmitted={(c) => setMyClaim(c)} />
      {softLogin && <SoftLoginModal action={softLogin} onClose={() => setSoftLogin(null)} />}
      <QuickCheckInModal
        open={checkinOpen}
        facility={facility ? { id: facility.id, name: facility.name, city: facility.city, state: facility.state } : null}
        onClose={() => setCheckinOpen(false)}
        onSubmitted={async () => {
          setCheckinOpen(false)
          // Refresh facility data + status history so the new pill + log line appear instantly
          setStatusHistoryKey((k) => k + 1)
          try { await load() } catch {}
        }}
      />
      <WriteReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        facility={facility}
        onPosted={async () => { try { await load() } catch {} }}
      />
    </>
  )
}
