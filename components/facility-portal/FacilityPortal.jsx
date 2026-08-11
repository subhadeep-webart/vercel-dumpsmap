'use client'

// FacilityPortal — the unified Portal container (dashboard + profile in ONE
// place). This IS the profile/dashboard page for every user, per the client
// mockup: a left sidebar navigates between sections, and the main panel swaps to
// show only the selected section (SaaS-style), with the facility hero + status
// strip pinned above as persistent context.
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
import {
  PortalSkeleton, PortalError, PortalRedirecting,
} from '@/components/facility-portal/PortalStates'

export default function FacilityPortal() {
  const {
    status, user, facilities, facility, selectFacility,
    savingKey, saveOwnerUpdate, savePricing, postAnnouncement, retry,
  } = useFacilityPortal()

  // Status switch — hooks above run unconditionally, so early returns are safe.
  // NOTE: there is no "no-facility" gate — the portal renders for every user; the
  // hook supplies a placeholder facility when the account manages none.
  if (status === 'redirecting') return <PortalRedirecting />
  if (status === 'loading') return <PortalSkeleton />
  if (status === 'error') return <PortalError onRetry={retry} />

  // Persistent context above the swappable panel.
  const header = (
    <>
      <PortalHero facility={facility} />
      <StatusStrip
        facility={facility}
        saving={savingKey === 'status'}
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
          />
        )
      case 'profile':
        return <ProfileEditPanel />
      case 'pricing':
        return (
          <>
            <PricingCard facility={facility} saving={savingKey === 'pricing'} onSave={(p) => savePricing(p)} />
            <MaterialsCard facility={facility} saving={savingKey === 'materials'} onSave={(p) => saveOwnerUpdate(p, { label: 'Materials', key: 'materials' })} />
          </>
        )
      case 'wait':
        return <WaitCapacityCard facility={facility} saving={savingKey === 'wait'} onSave={(p) => saveOwnerUpdate(p, { label: 'Wait time', key: 'wait' })} />
      case 'hours':
        return <HoursCard facility={facility} saving={savingKey === 'hours'} onSave={(p) => saveOwnerUpdate(p, { label: 'Hours', key: 'hours' })} />
      case 'photos':
        return <PhotosPanel facility={facility} saving={savingKey === 'photos'} onSave={(p) => saveOwnerUpdate(p, { label: 'Photos', key: 'photos' })} />
      case 'announcements':
        return <AnnouncementsCard facility={facility} saving={savingKey === 'announcement'} onPost={postAnnouncement} />
      case 'cashback':
        return <CashbackPanel facility={facility} />
      case 'settings':
        return <SettingsPanel user={user} />
      case 'activity':
        return <ActivityCard facility={facility} />
      default:
        return <DashboardPanel facility={facility} saving={savingKey} onSavePricing={savePricing} onSaveOwner={saveOwnerUpdate} />
    }
  }

  return (
    <PortalShell
      facility={facility}
      facilities={facilities}
      onSelect={selectFacility}
      header={header}
      renderPanel={renderPanel}
    />
  )
}
