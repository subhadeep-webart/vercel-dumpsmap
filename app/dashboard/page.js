'use client'

// /dashboard — Smart entrypoint. Picks the right role-specific dashboard
// based on the user's profileType / role. Logged-out users land on
// /activity-hub (public). Defaults to /dashboard/resident.

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { api, getAuthToken } from '@/lib/api-client'

export default function DashboardEntrypoint() {
  const router = useRouter()
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const token = getAuthToken()
      if (!token) { router.replace('/activity-hub'); return }
      try {
        const j = await api.get('/api/auth/me')
        if (cancelled) return
        if (!j?.user) { router.replace('/activity-hub'); return }
        const u = j.user
        const role = String(u.role || '').toLowerCase()
        const pt   = String(u.profileType || '').toLowerCase()
        if (role === 'super_admin' || role === 'admin') router.replace('/dashboard/admin')
        else if (pt === 'contractor' || pt === 'verified_contractor' || u.verifiedContractor) router.replace('/dashboard/contractor')
        else if (['facility_owner', 'facility', 'transfer_station', 'recycler', 'donation_center'].includes(pt)) router.replace('/dashboard/facility')
        else router.replace('/dashboard/resident')
      } catch {
        if (!cancelled) router.replace('/activity-hub')
      }
    }
    run()
    return () => { cancelled = true }
  }, [router])
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-neutral-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening your dashboard…
    </div>
  )
}
