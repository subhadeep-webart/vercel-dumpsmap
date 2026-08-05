'use client'

// DashboardShell
// ----------------------------------------------------------------------------
// Shared layout for role-specific dashboards (Contractor / Facility / Resident
// / Super Admin). Provides:
//   • Header bar with role pill + greeting + actions
//   • Responsive KPI grid (1-4 columns)
//   • Sectioned content area with optional sidebar
//   • Auth bootstrap (one-shot ref guard, no StrictMode pitfalls) — bubbles up
//     the user payload to the role page so it can fetch role-specific data.
//
// Usage:
//   <DashboardShell role="contractor" requireRole={['contractor','admin','super_admin']}>
//     {({ user }) => <ContractorView user={user} />}
//   </DashboardShell>

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearAuthToken } from '@/hooks/use-logout'
import AppHeader from '@/components/AppHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { api, isLikelyLoggedIn } from '@/lib/api-client'

const authHeaders = () => ({})

export default function DashboardShell({
  role = 'resident',
  requireRole,                // optional array of acceptable roles; null = any
  title,
  subtitle,
  actions,
  children,
}) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    if (bootstrappedRef.current) return undefined
    bootstrappedRef.current = true
    const run = async () => {
      if (!isLikelyLoggedIn()) { router.replace(`/?login=1&returnTo=/dashboard/${role}`); return }
      try {
        const j = await api.get('/api/auth/me')
        if (!j?.user) {
          clearAuthToken()
          router.replace(`/?login=1&returnTo=/dashboard/${role}`); return
        }
        if (requireRole && !requireRole.includes(j.user.role) && !requireRole.includes(j.user.profileType)) {
          setStatus('forbidden'); setUser(j.user); return
        }
        setUser(j.user); setStatus('ready')
      } catch (e) {
        // Auth failure (bad/expired token → HTTP error) clears the session and
        // redirects; a transient network/timeout error keeps the retryable
        // error screen instead of logging the user out.
        if (e?.code === 'network' || e?.code === 'timeout') {
          setStatus('error')
        } else {
          clearAuthToken()
          router.replace(`/?login=1&returnTo=/dashboard/${role}`)
        }
      }
    }
    run()
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-neutral-50">
        <AppHeader />
        <div className="container mx-auto flex items-center justify-center px-4 py-32 text-sm text-neutral-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your dashboard…
        </div>
      </div>
    )
  }
  if (status === 'forbidden') {
    return (
      <div className="min-h-[100dvh] bg-neutral-50">
        <AppHeader />
        <div className="container mx-auto max-w-md px-4 py-16">
          <Card className="border-amber-200 bg-amber-50/30">
            <CardContent className="space-y-2 p-6 text-center">
              <h2 className="text-lg font-extrabold tracking-tight">Different dashboard</h2>
              <p className="text-sm text-neutral-600">This dashboard is for {requireRole?.join(', ') || 'a specific role'}. Your account is <b>{user?.profileType || user?.role}</b>.</p>
              <a href="/dashboard" className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">Go to my dashboard</a>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
  if (status === 'error' || !user) {
    return (
      <div className="min-h-[100dvh] bg-neutral-50">
        <AppHeader />
        <div className="container mx-auto px-4 py-16 text-center text-sm text-red-600">
          Couldn&apos;t load your dashboard. <button onClick={() => window.location.reload()} className="font-bold text-brand-700 hover:underline">Retry</button>
        </div>
      </div>
    )
  }

  const greetingName = user.name?.split(' ')[0] || user.email?.split('@')[0] || 'there'

  return (
    <div className="min-h-[100dvh] bg-neutral-50">
      <AppHeader />
      <section className="border-b border-neutral-200 bg-gradient-to-br from-white via-white to-brand-50/30">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-brand-700">{ROLE_LABEL[role] || 'Dashboard'}</div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{title || `Hi, ${greetingName}`}</h1>
              {subtitle && <p className="mt-1 max-w-2xl text-sm text-neutral-600">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </div>
      </section>
      <main className="container mx-auto px-4 py-6 pb-24">
        {typeof children === 'function' ? children({ user, authHeaders }) : children}
      </main>
    </div>
  )
}

const ROLE_LABEL = {
  contractor: 'Contractor Ops',
  facility:   'Facility Owner Ops',
  resident:   'Personal Dashboard',
  admin:      'Super Admin',
}

// Re-exported building blocks for role pages -------------------------------
export function KpiGrid({ children }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 [&>*]:min-w-0">{children}</div>
}
export function KpiTile({ icon: Icon, label, value, sub, tone = 'brand', loading, index = 0 }) {
  const toneCls = ({
    brand:   'text-brand-700 bg-brand-50',
    emerald: 'text-emerald-700 bg-emerald-50',
    amber:   'text-amber-700 bg-amber-50',
    red:     'text-red-700 bg-red-50',
    violet:  'text-violet-700 bg-violet-50',
    sky:     'text-sky-700 bg-sky-50',
  })[tone] || 'text-brand-700 bg-brand-50'
  return (
    <Card className="dm-lift dm-rise-in group border-neutral-200/80 transition-colors hover:border-emerald-300" style={{ '--dm-i': index }}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          {Icon && <span className={`dm-badge inline-flex h-7 w-7 items-center justify-center rounded-md ${toneCls}`}><Icon className="h-3.5 w-3.5" /></span>}
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</span>
        </div>
        <div className="mt-2 truncate text-base font-extrabold tracking-tight text-neutral-900 sm:text-lg">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-neutral-400" /> : value}
        </div>
        {sub && <div className="mt-0.5 truncate text-[10px] text-neutral-500 sm:text-[11px]">{sub}</div>}
      </CardContent>
    </Card>
  )
}
export function SectionHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="mb-2 mt-6 flex items-end justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-500 sm:h-4 sm:w-4" />}
          <h2 className="truncate text-sm font-extrabold tracking-tight text-neutral-900 sm:text-base">{title}</h2>
        </div>
        {subtitle && <p className="mt-0.5 truncate text-[11px] text-neutral-500 sm:text-xs">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
