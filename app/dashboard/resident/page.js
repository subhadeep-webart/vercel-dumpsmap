'use client'
// /dashboard/resident — alias → /profile (the Facility Portal).
// The dashboard is now the unified portal at /profile for every non-admin
// account, per the client mockup. This old route redirects there so bookmarks
// and links land on the new layout.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
export default function ResidentDashboardAlias() {
  const router = useRouter()
  useEffect(() => { router.replace('/profile') }, [router])
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-brand-surface text-sm text-neutral-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening your portal…
    </div>
  )
}
