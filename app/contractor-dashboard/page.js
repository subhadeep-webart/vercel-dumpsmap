'use client'
// /contractor-dashboard — alias → /dashboard (Phase B still uses the unified
// /dashboard with contractor-specific tiles when user has contractor access).
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
export default function ContractorDashboardAlias() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard') }, [router])
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 text-sm text-neutral-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening dashboard…
    </div>
  )
}
