'use client'

// AppHeader — the unified global navigation header. Redesigned July 2026 for
// the DumpMaps V1 strategic pivot (facility finder + community + cashback).
//
// V1 nav lineup (511.org-inspired, mobile-first):
//   Facilities · Activity Hub · Community · Donate · Business · About
//
// Hidden but code preserved:  Marketplace · Jobs · Bounties · Rewards
// (Pages remain reachable by direct URL; nav links removed until beta scale.)
//
// Props:
//   active: one of 'feed'|'facilities'|'community'|'business'|'donate'|'dashboard'|'profile'|'settings'|'help'
//   showSearch?: bool (default false)
//
// Behaviour:
//   • Logo → /dashboard (logged-in) or / (logged-out)
//   • Desktop: horizontal nav for Facilities · Community · Business · About with a Donate button
//   • Mobile: hamburger opens a 511-style drawer:
//       ┌──────────────────────┐
//       │ [avatar]  Name  Role │
//       │ user chip / sign-in  │
//       ├──────────────────────┤
//       │ 🗺  Facilities       │
//       │ 📣 Activity Hub      │
//       │ 👥 Community         │
//       │ 💬 Messages          │
//       │ 👤 Profile           │
//       ├──────────────────────┤
//       │ ❤️ Support Our Mission │
//       │ 🏢 For Business      │
//       │ ⓘ About              │
//       │ ⚙️ Settings           │
//       │ ❓ Help & Support     │
//       └──────────────────────┘

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  Activity, MapPin, Users, Menu, Bell, X, Shield, LogIn, LogOut,
  LayoutDashboard, HeartHandshake, Building2, Info, Settings, HelpCircle,
  MessageSquare, User as UserIcon, ChevronRight, ShoppingBag,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { PRIMARY_NAV } from '@/constants/layout_constants'
import { useAuth } from '@/components/AuthContext'
import { getFirstName, getInitial, isNavActive } from '@/lib/nav-helpers'

export default function AppHeader({ active, showSearch = false }) {
  const router = useRouter()
  const pathname = usePathname() || ''
  const { user, loggedIn, isStaff, loading: authLoading, logout: onLogout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const logoHref = loggedIn ? '/activity-hub' : '/'

  const firstName = getFirstName(user)
  const initial = getInitial(user)

  const isActive = (key) => isNavActive(key, pathname, active)

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center gap-2 px-3 sm:px-4">
        {/* Logo */}
        <Link href={logoHref} className="flex shrink-0 items-center gap-2" aria-label="DumpMaps home">
          <img src="/dumpmaps-logo.png" alt="" className="h-7 w-7 rounded-md" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <span className="text-base font-extrabold tracking-tight">
            Dump<span className="text-emerald-600">Maps</span>
          </span>
        </Link>

        {/* Desktop primary nav */}
        <nav className="ml-6 hidden flex-1 items-center gap-1 lg:flex">
          {PRIMARY_NAV.map((n) => {
            const active = isActive(n.key)
            return (
              <Link
                key={n.key}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={`relative inline-flex items-center rounded-md px-3 py-1.5 text-[13.5px] font-medium transition ${
                  active
                    ? 'bg-emerald-50 font-bold text-emerald-700'
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                {n.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-2 h-0.5 rounded-full bg-emerald-500" aria-hidden />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Spacer for tablet/mobile */}
        <div className="flex-1 lg:hidden" />

        {/* Right side: Support Our Mission + auth */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Support Our Mission — visible md+ */}
          <Link
            href="/donate"
            className="hidden h-9 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100 md:inline-flex"
          >
            <HeartHandshake className="h-4 w-4" /> Support Our Mission
          </Link>

          {authLoading ? (
            // Placeholder while /api/auth/me resolves — avoids a flash of the
            // logged-out (Log In / Join Beta) state before we know who the user is.
            <div className="h-9 w-24 animate-pulse rounded-md bg-neutral-100" aria-hidden />
          ) : loggedIn ? (
            <>
              <Link href="/inbox" className="hidden h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 hover:bg-neutral-50 sm:inline-flex" aria-label="Notifications">
                <Bell className="h-4 w-4" />
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 text-sm font-semibold text-white hover:bg-emerald-700" aria-label="Account menu">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px]">{initial}</span>
                  <span className="hidden sm:inline">{firstName || 'Account'}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <UserIcon className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/messages')}>
                    <MessageSquare className="mr-2 h-4 w-4" /> Messages
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  {isStaff && (
                    <DropdownMenuItem onClick={() => router.push('/admin')}>
                      <Shield className="mr-2 h-4 w-4" /> Admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} className="text-red-600 focus:bg-red-50 focus:text-red-700">
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/?login=1" className="hidden h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 md:inline-flex">
                Log In
              </Link>
              <Link href="/beta" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700">
                <LogIn className="h-4 w-4" /> Join Beta
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm overflow-y-auto p-0">
              {/* ───── Header: user chip ───── */}
              <SheetHeader className="border-b border-neutral-200 bg-emerald-50/60 p-4">
                {authLoading ? (
                  <div className="flex items-center gap-3">
                    <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-neutral-200" aria-hidden />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" aria-hidden />
                      <div className="h-3 w-40 animate-pulse rounded bg-neutral-200" aria-hidden />
                    </div>
                  </div>
                ) : loggedIn ? (
                  <button onClick={() => { setMobileOpen(false); router.push('/profile') }} className="flex items-center gap-3 text-left">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-lg font-bold text-white shadow-sm">
                      {initial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <SheetTitle className="truncate text-left text-base font-bold">{user.name || user.email}</SheetTitle>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-600">
                        {isStaff && <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Admin</span>}
                        <span className="truncate">{user.email}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                  </button>
                ) : (
                  <div>
                    <SheetTitle className="flex items-center gap-2 text-base font-bold">
                      Welcome to <span>Dump<span className="text-emerald-600">Maps</span></span>
                    </SheetTitle>
                    <p className="mt-1 text-xs text-neutral-600">Find recycling & donation facilities near you.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link href="/?login=1" onClick={() => setMobileOpen(false)} className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                        Log In
                      </Link>
                      <Link href="/beta" onClick={() => setMobileOpen(false)} className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700">
                        Join Beta
                      </Link>
                    </div>
                  </div>
                )}
              </SheetHeader>

              {/* ───── Section: EXPLORE (big icons, one-tap) ───── */}
              <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Explore</div>
              <nav className="flex flex-col px-2">
                <DrawerRow icon={MapPin}      label="Facilities"     href="/facilities"    onNavigate={() => setMobileOpen(false)} active={isActive('facilities')} tint="emerald" />
                <DrawerRow icon={Activity}    label="Activity Hub"   href="/activity-hub"  onNavigate={() => setMobileOpen(false)} active={isActive('feed')} tint="orange" />
                <DrawerRow icon={Users}       label="Community"      href="/community"     onNavigate={() => setMobileOpen(false)} active={isActive('community')} tint="sky" />
                <DrawerRow icon={ShoppingBag} label="Marketplace"    href="/marketplace"   onNavigate={() => setMobileOpen(false)} active={isActive('marketplace')} tint="amber" />
              </nav>

              {loggedIn && (
                <>
                  <div className="mt-2 border-t border-neutral-100" />
                  <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">You</div>
                  <nav className="flex flex-col px-2">
                    <DrawerRow icon={LayoutDashboard} label="Dashboard" href="/dashboard" onNavigate={() => setMobileOpen(false)} tint="neutral" />
                    <DrawerRow icon={MessageSquare}   label="Messages"  href="/messages"  onNavigate={() => setMobileOpen(false)} tint="neutral" />
                    <DrawerRow icon={UserIcon}        label="Profile"   href="/profile"   onNavigate={() => setMobileOpen(false)} tint="neutral" />
                  </nav>
                </>
              )}

              {/* ───── Section: SUPPORT & DISCOVER ───── */}
              <div className="mt-2 border-t border-neutral-100" />
              <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">More</div>
              <nav className="flex flex-col px-2">
                <DrawerRow icon={HeartHandshake} label="Support Our Mission" href="/donate"   onNavigate={() => setMobileOpen(false)} tint="rose" featured />
                <DrawerRow icon={Building2}      label="For Business"        href="/business" onNavigate={() => setMobileOpen(false)} tint="emerald" />
                <DrawerRow icon={Info}           label="About"               href="/#about"   onNavigate={() => setMobileOpen(false)} tint="neutral" />
                <DrawerRow icon={Settings}       label="Settings"            href="/settings" onNavigate={() => setMobileOpen(false)} tint="neutral" />
                <DrawerRow icon={HelpCircle}     label="Help & Support"      href="/#support" onNavigate={() => setMobileOpen(false)} tint="neutral" />
                {isStaff && (
                  <DrawerRow icon={Shield} label="Admin Console" href="/admin" onNavigate={() => setMobileOpen(false)} tint="amber" />
                )}
              </nav>

              {loggedIn && (
                <>
                  <div className="mt-2 border-t border-neutral-100" />
                  <div className="p-3">
                    <button
                      onClick={() => { setMobileOpen(false); onLogout() }}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </>
              )}

              <div className="h-8" />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// DrawerRow — a big-tap-target row for the 511-style mobile drawer.
// Icons use a colored tint chip on the left so the drawer scans quickly.
// ────────────────────────────────────────────────────────────────────────────
function DrawerRow({ icon: Icon, label, href, onNavigate, active = false, tint = 'neutral', featured = false }) {
  const tintClass = {
    emerald: 'bg-emerald-100 text-emerald-700',
    orange:  'bg-orange-100 text-orange-700',
    sky:     'bg-sky-100 text-sky-700',
    rose:    'bg-rose-100 text-rose-700',
    amber:   'bg-amber-100 text-amber-700',
    neutral: 'bg-neutral-100 text-neutral-700',
  }[tint] || 'bg-neutral-100 text-neutral-700'

  const activeCls = active ? 'bg-emerald-50 font-bold text-emerald-800' : 'text-neutral-800 hover:bg-neutral-50'
  const ring = featured ? 'ring-1 ring-rose-200' : ''
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-2 py-3 text-[15px] ${activeCls} ${ring}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tintClass}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
    </Link>
  )
}
