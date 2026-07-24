'use client'
// /messages — alias → /inbox (canonical messages route).
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
export default function MessagesAlias() {
  const router = useRouter()
  useEffect(() => { router.replace('/inbox') }, [router])
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 text-sm text-neutral-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening messages…
    </div>
  )
}
