'use client'

// Facility Intelligence Center — Option 1 Redesign (Priority 3)
// ----------------------------------------------------------------------------
// A premium, Google-Business-Profile / Yelp / Waze inspired facility page that
// becomes the centerpiece of DumpMaps. Layout:
//
//   ┌──────────────────────────────────────────────┐
//   │ AppHeader (via PageShell)                    │
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
import PageShell from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Save, AlertTriangle } from 'lucide-react'
import { getStatusMeta, FACILITY_TYPE_CONFIG } from '@/lib/facility-types'
import ClaimBusinessDialog from '@/components/ClaimBusinessDialog'
import { useFieldBack } from '@/lib/field-back'
import { useRequireAuth, SoftLoginModal } from '@/components/SoftLoginModal'
import QuickCheckInModal from '@/components/QuickCheckInModal'
import { getAuthToken } from '@/lib/api-client'
import { useFacilityDetail } from '@/hooks/use-facility-detail'
import { useFacilityActions } from '@/hooks/use-facility-actions'
import { useShare } from '@/hooks/use-share'

import { DEFAULT_HERO_IMAGE } from '@/constants/facility_detail_constants'
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
  const [statusHistoryKey, setStatusHistoryKey] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')
  const { requireAuth, softLogin, setSoftLogin } = useRequireAuth()

  // Still needed as a prop for children that talk to non-/api services
  // (StartDmButton). All /api calls below go through the api client, which
  // attaches the token itself.
  const token = getAuthToken()

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
  const { postUpdate, saveOwnerEdit: saveOwnerEditAction, watch } = useFacilityActions({
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
  const heroImg = (facility.photos && facility.photos[0]) || DEFAULT_HERO_IMAGE

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

  return (
    <PageShell
      active="facilities"
      maxWidth={null}
      padding=""
      bg="bg-neutral-50"
      breadcrumbs={[
        { label: 'Facilities', href: '/facilities' },
        { label: facility.name },
      ]}
    >
      {usedFallback && (
        <div className="border-b border-neutral-200 bg-amber-50">
          <div className="container mx-auto flex items-center gap-2 px-4 py-1.5 text-[11px] text-amber-900">
            <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span>Sample facility (demo). Live data will replace this once verified.</span>
          </div>
        </div>
      )}

      {/* ============== HERO ============== */}
      <FacilityHero
        facility={facility}
        heroImg={heroImg}
        typeCfg={typeCfg}
        statusMeta={statusMeta}
        isClaimed={isClaimed}
        onBack={goBack}
      />

      {/* ============== QUICK STATS BAR ============== */}
      <QuickStatsBar facility={facility} statusMeta={statusMeta} />

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
        onClaim={() => { if (!requireAuth('claim')) return; setClaimOpen(true) }}
        onToggleEdit={() => setEditing((e) => !e)}
      />

      {myClaim && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="container mx-auto px-4 py-2 text-xs text-amber-900">
            Your claim request is currently <b>{myClaim.status}</b>. Submitted {new Date(myClaim.createdAt).toLocaleDateString()}.
          </div>
        </div>
      )}

      {/* ============== TABS ============== */}
      <FacilityTabs active={activeTab} onChange={setActiveTab} />

      {/* ============== BODY ============== */}
      <main className="container mx-auto grid gap-6 px-4 py-6 pb-28 md:grid-cols-3 md:pb-10">
        <div className="space-y-4 md:col-span-2">
          {/* Pre-launch disclaimer */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span><b>Facility details may change.</b> Call ahead before arrival to confirm hours, fees, and accepted materials.</span>
          </div>

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
            <ReviewsTab facility={facility} reviews={reviews} />
          )}

          {/* Inline save panel when in edit mode */}
          {editing && (
            <Card className="border-green-300 bg-green-50/40">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-sm text-green-900">
                  <b>Editing this facility.</b> Save your changes when ready.
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button onClick={saveOwnerEdit} className="bg-green-700 hover:bg-green-800">
                    <Save className="mr-1.5 h-4 w-4" /> Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar (desktop) — Maps-style: interactive map leads, then the
            place-info cards, ownership, and report row. */}
        <aside className="space-y-4 md:sticky md:top-32 md:self-start">
          <SidebarMapCard facility={facility} directionsUrl={directionsUrl} />
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
        </aside>
      </main>

      {/* ============== MOBILE STICKY ACTION BAR ============== */}
      <MobileStickyActions
        facility={facility}
        directionsUrl={directionsUrl}
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
    </PageShell>
  )
}
