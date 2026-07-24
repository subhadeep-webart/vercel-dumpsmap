'use client'

// /settings — minimal hub page so /profile, /profile/setup, and direct
// /settings links don't 404. Phase A scope: just provide a working landing.
// A proper full settings UI can be built in a later sprint.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PageShell from '@/components/PageShell'
import { useLogout, clearAuthToken } from '@/hooks/use-logout'
import { Loader2, ArrowLeft, User, Mail, BadgeCheck, Cog, Inbox, ShoppingBag, LogOut, ArrowRight, CreditCard } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { resolveMarketplaceRole } from '@/lib/marketplace-roles'
import { hasContractorAccess } from '@/lib/contractor-access'
import LayoutModeToggle from '@/components/LayoutModeToggle'
import { toast } from 'sonner'

export default function SettingsPage() {
  const router = useRouter()
  const logout = useLogout()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let cancelled = false
    const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!token) {
      router.replace('/?login=1&returnTo=/settings')
      return
    }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (!j?.user) {
          clearAuthToken()
          router.replace('/?login=1&returnTo=/settings')
          return
        }
        setUser(j.user)
        setStatus('ready')
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [router])

  const signOut = () => {
    toast.success('Signed out')
    logout()
  }

  if (status !== 'ready') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 text-sm text-neutral-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-600" /> Loading settings…
      </div>
    )
  }

  const role = resolveMarketplaceRole(user)
  const firstName = (user?.name || user?.email?.split('@')[0] || 'there').split(' ')[0]
  const isContractor = hasContractorAccess(user)

  return (
    <PageShell active="settings" breadcrumbs={[{ label: 'Settings' }]} maxWidth="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Account &amp; settings</h1>
          <p className="mt-1 text-sm text-neutral-600">Manage your profile, integrations, and DumpMaps experience.</p>
        </div>

        {/* Profile card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-extrabold text-brand-700">
                {(firstName[0] || 'U').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-base font-bold text-neutral-900">{user.name || firstName}</div>
                  {user.isVerified && <BadgeCheck className="h-4 w-4 text-emerald-600" />}
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-500"><Mail className="h-3 w-3" /> {user.email}</div>
              </div>
              <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-700">{role.label}</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Row label="Primary profile" value={user.primaryProfile || '—'} />
              <Row label="Verification" value={user.verificationLevel || (user.isVerified ? 'verified' : 'unverified')} />
              <Row label="Role" value={user.role || 'user'} />
              <Row label="Contractor tools" value={isContractor ? 'enabled' : '—'} />
            </div>
          </CardContent>
        </Card>

        {/* Account links */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SettingsLink href="/settings/integrations" icon={Cog} title="Integrations" desc="Connect external services like Stripe + email." />
          <SettingsLink href="/settings/payment-methods" icon={CreditCard} title="Payment methods" desc="Save cards on file for memberships, marketplace, and contractor charges." />
          <SettingsLink href="/inbox" icon={Inbox} title="Inbox &amp; notifications" desc="Messages, alerts, and admin actions." />
          <SettingsLink href="/marketplace/me" icon={ShoppingBag} title="My Marketplace" desc="Your listings, saves, alerts, and stats." />
          {isContractor && (
            <SettingsLink href="/disposal-intelligence" icon={BadgeCheck} title="Contractor tools" desc="Disposal Intelligence + Receipt Center." />
          )}
        </div>

        {/* Layout preference (P4) */}
        <Card className="mt-4">
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-bold text-neutral-900">Layout preference</div>
                <div className="mt-0.5 text-xs text-neutral-500">Force a desktop or mobile canvas across DumpMaps, or let it auto-detect your device. Synced across devices when signed in.</div>
              </div>
              <LayoutModeToggle variant="segmented" />
            </div>
          </CardContent>
        </Card>

        {/* Sign out */}
        <div className="mt-6">
          <Button variant="outline" onClick={signOut} className="border-red-300 text-red-700 hover:bg-red-50">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>

        <p className="mt-8 text-[11px] text-neutral-400">A full settings UI (edit name, change password, notification preferences) is on the roadmap. For now, contact <a href="mailto:jamal@dumpmaps.org" className="underline">jamal@dumpmaps.org</a> for any account changes.</p>
    </PageShell>
  )
}

function Row({ label, value }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-neutral-800">{value}</div>
    </div>
  )
}

function SettingsLink({ href, icon: Icon, title, desc }) {
  return (
    <Link href={href} className="group block rounded-xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-neutral-900" dangerouslySetInnerHTML={{ __html: title }} />
            <ArrowRight className="h-4 w-4 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">{desc}</div>
        </div>
      </div>
    </Link>
  )
}
