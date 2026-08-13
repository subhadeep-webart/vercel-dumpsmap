'use client'

// FacilityPortal — the Portal container. ROLE-BASED, per the client's answers
// (docs/FACILITY_PORTAL_DEV.md §6):
//
//   Facility owner → the facility management console: hero + status strip, and
//                    panels for pricing, hours, materials, announcements, etc.
//   Resident       → their own view: activity, jobs, reports, and a "Claim Your
//                    Facility" path. No facility backend access at all.
//
// The two roles get different sidebars (menuForRole), so a resident cannot even
// deep-link to a management section — PortalShell validates ?section= against
// the role's own menu. Write affordances are additionally gated on `canEdit`,
// which mirrors the server's authorization checks.
//
// Orchestration only: useFacilityPortal owns all data + mutations; PortalShell
// owns the frame + active-section state and calls renderPanel() to get the panel
// for the selected sidebar item.
//
// useSearchParams (?facility=) needs a Suspense boundary in Next 15 — the caller
// wraps this in <Suspense>.

import { useFacilityPortal } from '@/hooks/use-facility-portal'
import PortalShell from '@/components/facility-portal/PortalShell'
import PortalHero from '@/components/facility-portal/PortalHero'
import StatusStrip from '@/components/facility-portal/StatusStrip'
import PricingCard from '@/components/facility-portal/cards/PricingCard'
import WaitCapacityCard from '@/components/facility-portal/cards/WaitCapacityCard'
import MaterialsCard from '@/components/facility-portal/cards/MaterialsCard'
import HoursCard from '@/components/facility-portal/cards/HoursCard'
import AnnouncementsCard from '@/components/facility-portal/cards/AnnouncementsCard'
import ActivityCard from '@/components/facility-portal/cards/ActivityCard'
import { DashboardPanel, PhotosPanel, CashbackPanel, SettingsPanel } from '@/components/facility-portal/panels'
import ProfileEditPanel from '@/components/facility-portal/panels-profile'
import ClaimFacilityPanel from '@/components/facility-portal/panels-claim'
import {
  ResidentDashboardPanel, ResidentJobsPanel, ResidentReportsPanel,
} from '@/components/facility-portal/panels-resident'
import {
  PortalSkeleton, PortalError, PortalRedirecting, PortalNoFacility,
} from '@/components/facility-portal/PortalStates'

export default function FacilityPortal() {
  const {
    status, user, facility, isOwner, canEdit, pendingClaim, refreshClaims,
    savingKey, saveOwnerUpdate, savePricing, postAnnouncement, retry,
  } = useFacilityPortal()

  // Status switch — hooks above run unconditionally, so early returns are safe.
  if (status === 'redirecting') return <PortalRedirecting />
  if (status === 'loading') return <PortalSkeleton />
  if (status === 'error') return <PortalError onRetry={retry} />

  // ── Resident (non-owner) ────────────────────────────────────────────────────
  // No facility hero/status strip — there's no facility to head the page with.
  if (!isOwner) {
    const renderResidentPanel = (section) => {
      switch (section) {
        case 'jobs':     return <ResidentJobsPanel />
        case 'activity': return <ResidentReportsPanel />
        case 'claim':    return <ClaimFacilityPanel pendingClaim={pendingClaim} onClaimed={refreshClaims} />
        case 'profile':  return <ProfileEditPanel />
        case 'settings': return <SettingsPanel user={user} />
        default:         return <ResidentDashboardPanel user={user} />
      }
    }
    return <PortalShell facility={null} isOwner={false} header={null} renderPanel={renderResidentPanel} />
  }

  // ── Facility owner ──────────────────────────────────────────────────────────
  // Owner role but no facility record loaded — e.g. the facility was deleted, or
  // its fetch failed. Show the empty state rather than rendering a hero over null.
  if (!facility) return <PortalNoFacility />

  // Persistent context above the swappable panel.
  const header = (
    <>
      <PortalHero facility={facility} />
      <StatusStrip
        facility={facility}
        saving={savingKey === 'status'}
        canEdit={canEdit}
        onUpdateStatus={(value) => saveOwnerUpdate({ currentStatus: value }, { label: 'Status', key: 'status' })}
      />
    </>
  )

  // Map each sidebar section → its panel. The shell renders only the active one.
  const renderPanel = (section) => {
    switch (section) {
      case 'dashboard':
        return (
          <DashboardPanel
            facility={facility}
            saving={savingKey}
            onSavePricing={savePricing}
            onSaveOwner={saveOwnerUpdate}
            canEdit={canEdit}
          />
        )
      case 'profile':
        // Pass the facility so the panel can offer BOTH public views: the
        // facility page (what customers see on the map) and the personal
        // account page.
        return <ProfileEditPanel facility={facility} />
      case 'pricing':
        return (
          <>
            <PricingCard facility={facility} saving={savingKey === 'pricing'} onSave={(p) => savePricing(p)} canEdit={canEdit} />
            <MaterialsCard facility={facility} saving={savingKey === 'materials'} onSave={(p) => saveOwnerUpdate(p, { label: 'Materials', key: 'materials' })} canEdit={canEdit} />
          </>
        )
      case 'wait':
        return <WaitCapacityCard facility={facility} saving={savingKey === 'wait'} onSave={(p) => saveOwnerUpdate(p, { label: 'Wait time', key: 'wait' })} canEdit={canEdit} />
      case 'hours':
        return <HoursCard facility={facility} saving={savingKey === 'hours'} onSave={(p) => saveOwnerUpdate(p, { label: 'Hours', key: 'hours' })} canEdit={canEdit} />
      case 'photos':
        return <PhotosPanel facility={facility} saving={savingKey === 'photos'} onSave={(p) => saveOwnerUpdate(p, { label: 'Photos', key: 'photos' })} />
      case 'announcements':
        return <AnnouncementsCard facility={facility} saving={savingKey === 'announcement'} onPost={postAnnouncement} canEdit={canEdit} />
      case 'cashback':
        return <CashbackPanel />
      case 'settings':
        return <SettingsPanel user={user} />
      case 'activity':
        return <ActivityCard facility={facility} />
      default:
        return <DashboardPanel facility={facility} saving={savingKey} onSavePricing={savePricing} onSaveOwner={saveOwnerUpdate} canEdit={canEdit} />
    }
  }

  return (
    <PortalShell
      facility={facility}
      isOwner
      header={header}
      renderPanel={renderPanel}
    />
  )
}
