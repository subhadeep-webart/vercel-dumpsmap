'use client'
// /facility-owner/dashboard — alias → /profile (the Facility Portal).
// The facility owner dashboard is now folded into the profile page, so this old
// link redirects straight to the new portal layout in a single hop.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
export default function FacilityOwnerDashboardAlias() {
  const router = useRouter()
  useEffect(() => { router.replace('/profile') }, [router])
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-brand-surface text-sm text-neutral-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening your portal…
    </div>
  )
}
