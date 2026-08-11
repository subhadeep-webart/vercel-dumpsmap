'use client'

// /dashboard/facility — alias → /profile.
// ----------------------------------------------------------------------------
// The Facility Owner dashboard is now folded into the profile page: a facility
// owner's /profile IS the Facility Portal (sidebar + facility header + pricing /
// wait / materials / hours / announcements / activity cards). This route used to
// render a standalone DashboardShell ops view; it now redirects so any lingering
// deep-link, bookmark, or role-router hop lands on the single portal experience.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function FacilityDashboardAlias() {
  const router = useRouter()
  useEffect(() => { router.replace('/profile') }, [router])
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-brand-surface text-sm text-neutral-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening your portal…
    </div>
  )
}
