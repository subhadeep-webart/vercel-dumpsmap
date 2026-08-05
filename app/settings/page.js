'use client'

// /settings — account hub. Composition only: it auth-gates via useCurrentUser
// (SWR) and renders the settings sections. Data loading and each section live in
// their own module (lib/useCurrentUser, components/settings/*).

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageShell from '@/components/PageShell'
import { Loader2 } from 'lucide-react'
import { clearAuthToken } from '@/hooks/use-logout'
import { useCurrentUser } from '@/lib/useCurrentUser'
import ProfileCard from '@/components/settings/ProfileCard'
import AccountLinks from '@/components/settings/AccountLinks'
import LayoutPreferenceCard from '@/components/settings/LayoutPreferenceCard'
import SignOutButton from '@/components/settings/SignOutButton'

export default function SettingsPage() {
  const router = useRouter()
  const { user, isLoading, isLoggedOut, error } = useCurrentUser()

  // Bounce to login whenever we're confidently logged out. clearAuthToken drops
  // any stale client hint so we don't loop back here.
  useEffect(() => {
    if (isLoggedOut) {
      clearAuthToken()
      router.replace('/?login=1&returnTo=/settings')
    }
  }, [isLoggedOut, router])

  if (isLoading || (!user && !error && !isLoggedOut)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 text-sm text-neutral-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-600" /> Loading settings…
      </div>
    )
  }

  // Hard error (and not simply logged out) — offer a retry instead of a blank page.
  if (error && !isLoggedOut) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-neutral-50 px-4 text-center text-sm text-neutral-600">
        <div>Couldn&apos;t load your settings.</div>
        <button onClick={() => window.location.reload()} className="font-bold text-brand-700 hover:underline">Retry</button>
      </div>
    )
  }

  // While the redirect effect runs (logged out), render nothing.
  if (!user) return null

  return (
    <PageShell active="settings" breadcrumbs={[{ label: 'Settings' }]} maxWidth="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Account &amp; settings</h1>
        <p className="mt-1 text-sm text-neutral-600">Manage your profile, integrations, and DumpMaps experience.</p>
      </div>

      <ProfileCard user={user} />
      <AccountLinks user={user} />
      <LayoutPreferenceCard />

      <div className="mt-6">
        <SignOutButton />
      </div>

      <p className="mt-8 text-[11px] text-neutral-400">A full settings UI (edit name, change password, notification preferences) is on the roadmap. For now, contact <a href="mailto:jamal@dumpmaps.org" className="underline">jamal@dumpmaps.org</a> for any account changes.</p>
    </PageShell>
  )
}
