'use client'
// /signup — deep-link alias. Pops the auth dialog on landing in signup mode.
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 text-sm text-neutral-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening sign up…
    </div>
  )
}

// useSearchParams() must live inside a <Suspense> boundary so the page can be
// statically prerendered without bailing out of client-side rendering.
function SignupAliasInner() {
  const router = useRouter()
  const sp = useSearchParams()
  useEffect(() => {
    const returnTo = sp.get('returnTo') || '/dashboard'
    router.replace(`/?login=1&mode=signup&returnTo=${encodeURIComponent(returnTo)}`)
  }, [router, sp])
  return <LoadingScreen />
}

export default function SignupAlias() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SignupAliasInner />
    </Suspense>
  )
}
