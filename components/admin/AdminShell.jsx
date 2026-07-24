'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, MapPin, Store, Briefcase, Activity,
  Flag, ScrollText, BarChart3, LogOut, Shield, Menu, X, ChevronRight,
  BadgeCheck, KeyRound, CreditCard, Plug, Settings, Mail, HeartHandshake, Database, Building2, Award, ToggleRight, Inbox, ShoppingBag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAdmin } from './AdminContext'

const NAV = [
  { href: '/admin',                       label: 'Overview',              icon: LayoutDashboard, exact: true },
  { href: '/admin/leads',                 label: 'Leads (Beta/Biz)',      icon: Inbox },
  { href: '/admin/users',                 label: 'Users',                 icon: Users,           key: 'users' },
  { href: '/admin/facilities',            label: 'Facilities',            icon: MapPin,          key: 'facilities' },
  { href: '/admin/facility-imports',      label: 'Facility Imports',      icon: Database,        key: 'facility_imports' },
  { href: '/admin/facility-claims',       label: 'Facility Claims',       icon: KeyRound,        key: 'facility_claims' },
  { href: '/admin/marketplace',           label: 'Marketplace',           icon: Store,           key: 'marketplace' },
  { href: '/admin/jobs',                  label: 'Jobs',                  icon: Briefcase,       key: 'jobs' },
  { href: '/admin/feed',                  label: 'Live Feed',             icon: Activity,        key: 'alerts' },
  { href: '/admin/community',             label: 'Community',             icon: Users,           key: 'community' },
  { href: '/admin/reports',               label: 'Reports',               icon: Flag,            key: 'reports' },
  { href: '/admin/trust-safety',          label: 'Trust & Safety',        icon: Shield,          key: 'trust_safety' },
  { href: '/admin/contractor-verification', label: 'Contractor Verify',   icon: BadgeCheck,      key: 'contractor_verify' },
  { href: '/admin/commercial-access',     label: 'Commercial Access',     icon: Building2,       key: 'commercial_access' },
  { href: '/admin/facility-owners',       label: 'Facility Owners',       icon: KeyRound,        key: 'facility_owners' },
  { href: '/admin/payments',              label: 'Payments',              icon: CreditCard,      key: 'payments' },
  { href: '/admin/donations',             label: 'Donations',             icon: HeartHandshake,  key: 'donations' },
  { href: '/admin/memberships',           label: 'Memberships',           icon: Award,           key: 'memberships' },
  { href: '/admin/feature-controls',      label: 'Feature Controls',      icon: ToggleRight,     key: 'feature_controls' },
  { href: '/admin/integrations',          label: 'Integrations',          icon: Plug },
  { href: '/admin/platform-settings',     label: 'Platform Settings',     icon: Settings },
  { href: '/admin/email-notifications',   label: 'Email Notifications',   icon: Mail,            key: 'email_notifications' },
  { href: '/admin/activity-log',          label: 'Activity Log',          icon: ScrollText,      key: 'activity_log' },
  { href: '/admin/analytics',             label: 'Analytics',             icon: BarChart3 },
]

export default function AdminShell({ children }) {
  const { user, loading, login, logout, loginError, isStaff, authFetch } = useAdmin()
  const pathname = usePathname()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [counts, setCounts] = useState({})

  // Poll notification counts every 12 seconds
  useEffect(() => {
    if (!user || !isStaff) return
    let mounted = true
    const tick = async () => {
      try {
        const r = await authFetch('/api/admin/notification-counts')
        if (!r.ok) return
        const j = await r.json()
        if (mounted) setCounts(j.counts || {})
      } catch {}
    }
    tick()
    const id = setInterval(tick, 12000)
    return () => { mounted = false; clearInterval(id) }
  }, [user, isStaff, authFetch])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-500">
        Loading admin…
      </div>
    )
  }

  if (!user || !isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-950 via-neutral-900 to-blue-900 p-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-7 shadow-2xl">
          <div className="flex items-center gap-3 text-white">
            <Image src="/dumpmaps-logo.png" alt="DumpMaps" width={56} height={56} className="rounded-md bg-white p-1" />
            <div>
              <div className="text-lg font-extrabold tracking-tight">DumpMaps Admin</div>
              <div className="text-xs text-neutral-400">Restricted access</div>
            </div>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setSubmitting(true)
              await login(email, password)
              setSubmitting(false)
            }}
            className="mt-6 space-y-3"
          >
            <div>
              <Label className="text-xs text-neutral-300">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-neutral-800 text-white border-neutral-700" placeholder="jamal@dumpmaps.org" />
            </div>
            <div>
              <Label className="text-xs text-neutral-300">Password</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-1 bg-neutral-800 text-white border-neutral-700" />
            </div>
            {loginError && <div className="rounded-md bg-red-500/15 px-3 py-2 text-xs text-red-300">{loginError}</div>}
            <Button type="submit" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Signing in…' : 'Sign in to Admin'}
            </Button>
            <div className="text-center text-[11px] text-neutral-500">
              Only staff accounts may sign in here.
            </div>
          </form>
        </div>
      </div>
    )
  }

  const isActive = (href, exact) => exact ? pathname === href : pathname === href || pathname?.startsWith(href + '/')

  const renderBadge = (key) => {
    const c = counts[key]
    if (!c || !c.count) return null
    const urgent = c.urgent
    return (
      <span className={`ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${urgent ? 'bg-red-500 text-white' : 'bg-blue-500/90 text-white'}`}>
        {c.count > 99 ? '99+' : c.count}
      </span>
    )
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-neutral-50">
      {/* Sidebar — desktop (fixed full-height, scrollable nav) */}
      <aside className="hidden h-[100dvh] w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-900 md:flex">
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-neutral-800 px-4 text-white">
          <Image src="/dumpmaps-logo.png" alt="DumpMaps" width={36} height={36} className="rounded-md bg-white p-0.5" />
          <div>
            <div className="text-base font-extrabold leading-none tracking-tight">DumpMaps</div>
            <span className="mt-0.5 inline-block rounded bg-blue-600/30 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-blue-200">Admin Console</span>
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto py-3">
          {NAV.map((n) => {
            const Icon = n.icon
            const active = isActive(n.href, n.exact)
            return (
              <Link key={n.href} href={n.href} className={`mx-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'}`}>
                <Icon className="h-4 w-4" />
                <span className="flex-1 truncate">{n.label}</span>
                {renderBadge(n.key)}
              </Link>
            )
          })}
        </nav>
        <div className="shrink-0 border-t border-neutral-800 p-3">
          <div className="mb-2 px-1 text-xs text-neutral-400">
            Signed in as<br />
            <span className="font-semibold text-white">{user.email}</span><br />
            <span className="text-[10px] uppercase tracking-wide text-blue-300">{user.role.replace('_', ' ')}</span>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="flex-1 rounded-md border border-neutral-700 px-2 py-1.5 text-center text-xs text-neutral-300 hover:bg-neutral-800">Open site</Link>
            <button onClick={logout} className="flex items-center gap-1 rounded-md bg-red-600/20 px-2 py-1.5 text-xs text-red-300 hover:bg-red-600/30">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex h-[100dvh] w-64 flex-col bg-neutral-900">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 px-4 text-white">
              <div className="flex items-center gap-2">
                <Image src="/dumpmaps-logo.png" alt="DumpMaps" width={28} height={28} className="rounded-md bg-white p-0.5" />
                <div className="text-sm font-extrabold">DumpMaps Admin</div>
              </div>
              <button onClick={() => setSidebarOpen(false)}><X className="h-5 w-5 text-neutral-400" /></button>
            </div>
            <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto py-3">
              {NAV.map((n) => {
                const Icon = n.icon
                const active = isActive(n.href, n.exact)
                return (
                  <Link key={n.href} href={n.href} onClick={() => setSidebarOpen(false)} className={`mx-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'}`}>
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 truncate">{n.label}</span>
                    {renderBadge(n.key)}
                  </Link>
                )
              })}
            </nav>
            <button onClick={logout} className="flex shrink-0 items-center gap-1 border-t border-neutral-800 px-4 py-3 text-xs text-red-300">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </aside>
        </div>
      )}

      {/* Main column — fixed height, no scroll; children own their scroll */}
      <div className="flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} className="rounded-md p-1.5 hover:bg-neutral-100 md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <Breadcrumbs pathname={pathname} />
          </div>
          <div className="text-xs text-neutral-500">
            <span className="font-semibold text-neutral-700 hidden sm:inline">{user.name || user.email}</span>
            <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">{user.role.replace('_', ' ')}</span>
          </div>
        </header>
        {/* Pages that want internal panel scrolling render their own height-100% layout.
            Default fallback wraps children in a scrollable area for legacy pages (via globals.css). */}
        <main className="admin-main min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}

function Breadcrumbs({ pathname }) {
  const parts = (pathname || '').split('/').filter(Boolean)
  const labels = { admin: 'Admin' }
  const crumbs = parts.map((p, i) => {
    const href = '/' + parts.slice(0, i + 1).join('/')
    const label = labels[p] || p.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
    return { href, label }
  })
  if (crumbs.length === 0) return null
  return (
    <div className="flex items-center gap-1 text-xs text-neutral-500">
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          <Link href={c.href} className={i === crumbs.length - 1 ? 'font-semibold text-neutral-900' : 'hover:text-neutral-900'}>
            {c.label}
          </Link>
        </span>
      ))}
    </div>
  )
}
