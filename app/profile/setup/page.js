'use client'

// /profile/setup — 10-card "Choose Your Profile" selector.
//
// This is the entry point for first-time users AND a profile-type switcher
// for existing users (Sprint A spec). Picking a card immediately PATCHes
// `/api/users/me/profile` with the chosen `profileType`, then routes the user
// to `/profile` to fill out the rest.

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clearAuthToken } from '@/hooks/use-logout'
import { api, ApiError } from '@/lib/api-client'
import PageShell from '@/components/PageShell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Home, Truck, Building2, Recycle, HeartHandshake, Store, KeyRound,
  Landmark, Briefcase, ShieldCheck, ArrowRight, CheckCircle2, Loader2,
} from 'lucide-react'

const PROFILE_TYPES = [
  { value: 'resident',         label: 'Resident',          icon: Home,           description: 'Stay informed, participate in your community.', tint: 'text-green-600' },
  { value: 'contractor',       label: 'Contractor / Hauler', icon: Truck,        description: 'Find work, earn, and grow your business.',     tint: 'text-amber-600' },
  { value: 'facility',         label: 'Facility',          icon: Building2,      description: 'Manage your facility and engage contractors.', tint: 'text-blue-600' },
  { value: 'recycler',         label: 'Recycler / Buyback', icon: Recycle,       description: 'Track materials, weights, and payouts.',       tint: 'text-emerald-600' },
  { value: 'donation_center',  label: 'Donation Center',   icon: HeartHandshake, description: 'Manage donations and pickup requests.',        tint: 'text-rose-600' },
  { value: 'vendor',           label: 'Vendor / Reseller', icon: Store,          description: 'Buy and sell materials and equipment.',        tint: 'text-orange-600' },
  { value: 'property_manager', label: 'Property Manager',  icon: KeyRound,       description: 'Post jobs and manage properties.',             tint: 'text-purple-600' },
  { value: 'government',       label: 'Government Agency', icon: Landmark,       description: 'Manage reports, bounties, and funding.',       tint: 'text-indigo-600' },
  { value: 'enterprise',       label: 'Enterprise Company', icon: Briefcase,     description: 'Manage teams, fleet, and operations.',         tint: 'text-slate-700' },
  { value: 'super_admin',      label: 'Super Admin',       icon: ShieldCheck,    description: 'System control and platform oversight.',       tint: 'text-red-600' },
]

export default function ProfileSetupPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
      if (!token) {
        router.replace('/?login=1&returnTo=/profile/setup')
        return
      }
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      try {
        const j = await api.get('/api/users/me/profile', { signal: ctrl.signal, timeout: 0 })
        if (cancelled) return
        if (!j?.user) {
          clearAuthToken()
          router.replace('/?login=1&returnTo=/profile/setup')
          return
        }
        setUser(j.user); setStatus('ready')
      } catch (e) {
        if (cancelled) return
        if (e instanceof ApiError && typeof e.status === 'number') {
          clearAuthToken()
          router.replace('/?login=1&returnTo=/profile/setup')
          return
        }
        setStatus(e?.code === 'timeout' || e?.code === 'aborted' ? 'timeout' : 'error')
      } finally { clearTimeout(timer) }
    }
    run()
    return () => { cancelled = true }
  }, [router])

  const choose = async (value) => {
    setSaving(value)
    try {
      try {
        await api.patch('/api/users/me/profile', { profileType: value })
      } catch (err) {
        throw new Error((err instanceof ApiError ? err.data?.error : null) || 'Save failed')
      }
      toast.success(`Profile type set: ${PROFILE_TYPES.find((p) => p.value === value)?.label}`)
      router.push('/profile')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(null)
    }
  }

  if (status === 'loading') {
    return (
      <PageShell active="profile" breadcrumbs={[{ label: 'Profile', href: '/profile' }, { label: 'Choose your profile' }]} maxWidth="max-w-6xl">
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </PageShell>
    )
  }

  const current = user?.profileType

  return (
    <PageShell active="profile" breadcrumbs={[{ label: 'Profile', href: '/profile' }, { label: 'Choose your profile' }]} maxWidth="max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">Choose your profile</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Your profile type controls what dashboards, tabs, and actions you see across DumpMaps. You can change this later.
        </p>
        {current && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
            <CheckCircle2 className="h-3 w-3" /> Current: <b className="ml-0.5">{PROFILE_TYPES.find((p) => p.value === current)?.label || current}</b>
          </div>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {PROFILE_TYPES.map((p) => {
          const Icon = p.icon
          const isCurrent = current === p.value
          const isSaving = saving === p.value
          return (
            <Card key={p.value} className={`relative overflow-hidden transition ${isCurrent ? 'border-green-500 ring-2 ring-green-200' : 'border-neutral-200 hover:border-neutral-300'}`}>
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-50 ${p.tint}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-extrabold text-neutral-900">{p.label}</h3>
                    {isCurrent && <Badge variant="outline" className="border-green-300 bg-green-50 text-[10px] text-green-800">Current</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">{p.description}</p>
                </div>
                <Button
                  size="sm"
                  className={isCurrent ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300' : 'bg-green-700 hover:bg-green-800'}
                  onClick={() => choose(p.value)}
                  disabled={isSaving || isCurrent}
                >
                  {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  {isCurrent ? 'Selected' : 'Select'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="mt-6 text-xs text-neutral-500">
        Looking for full details on each role?{' '}
        <Link href="/profile" className="text-green-700 underline">Skip to your profile editor</Link>
        {' '}— you can pick your type later from Settings.
      </p>
    </PageShell>
  )
}
