'use client'

// /facility-owner/portal — direct route to the Facility Portal.
// ----------------------------------------------------------------------------
// The portal is primarily surfaced at /profile (a facility owner's profile IS
// the portal — see app/profile/page.js). This route is a stable deep-link to the
// same experience; it renders the shared <FacilityPortal> so there's no duplicated
// orchestration. useSearchParams (?facility=) needs a Suspense boundary in Next 15.

import { Suspense } from 'react'
import FacilityPortal from '@/components/facility-portal/FacilityPortal'
import { PortalSkeleton } from '@/components/facility-portal/PortalStates'

export default function FacilityPortalPage() {
  return (
    <Suspense fallback={<PortalSkeleton />}>
      <FacilityPortal />
    </Suspense>
  )
}
