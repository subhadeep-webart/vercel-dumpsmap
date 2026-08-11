'use client'

// /profile — the Facility Portal. This IS the profile page for every user, per
// the client mockup: a single SaaS-style console with a left sidebar, the
// facility identity header, and operational cards (pricing, wait time, materials,
// hours, announcements, activity). It fully replaces the old tabbed settings
// editor — personal-account settings now live at /settings.
//
// Orchestration is entirely inside <FacilityPortal> (which owns loading /
// redirect / empty states via useFacilityPortal). useFacilityPortal reads
// ?facility= via useSearchParams, which needs a Suspense boundary in Next 15.

import { Suspense } from 'react'
import FacilityPortal from '@/components/facility-portal/FacilityPortal'
import { PortalSkeleton } from '@/components/facility-portal/PortalStates'

export default function ProfilePage() {
  return (
    <Suspense fallback={<PortalSkeleton />}>
      <FacilityPortal />
    </Suspense>
  )
}
