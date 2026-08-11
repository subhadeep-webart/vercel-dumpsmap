'use client'

// /dashboard — the unified Portal (dashboard + profile merged into one
// container), per the client mockup. Every non-admin account renders the portal
// here directly (same experience as /profile — a left sidebar navigates sections
// and the main panel swaps). Admins are the only exception: they bounce to their
// control panel (users / payments / moderation), which the portal doesn't cover.
//
// Logged-out visitors go to the public hub. useFacilityPortal (inside
// FacilityPortal) reads ?facility= via useSearchParams, so the portal branch is
// wrapped in Suspense.

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, isLikelyLoggedIn } from '@/lib/api-client'
import { PUBLIC_FALLBACK_ROUTE } from '@/lib/dashboard-routing'
import FacilityPortal from '@/components/facility-portal/FacilityPortal'
import { PortalSkeleton } from '@/components/facility-portal/PortalStates'

export default function DashboardEntrypoint() {
  const router = useRouter()
  // 'checking' → deciding admin-vs-portal; 'portal' → render the container.
  const [mode, setMode] = useState('checking')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!isLikelyLoggedIn()) { router.replace(PUBLIC_FALLBACK_ROUTE); return }
      try {
        const { user } = await api.get('/api/auth/me')
        if (cancelled) return
        const role = String(user?.role || '').toLowerCase()
        if (role === 'admin' || role === 'super_admin') { router.replace('/dashboard/admin'); return }
        setMode('portal')
      } catch {
        if (!cancelled) router.replace(PUBLIC_FALLBACK_ROUTE)
      }
    })()
    return () => { cancelled = true }
  }, [router])

  if (mode !== 'portal') return <PortalSkeleton />

  return (
    <Suspense fallback={<PortalSkeleton />}>
      <FacilityPortal />
    </Suspense>
  )
}
