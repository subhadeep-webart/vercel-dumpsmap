'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Recycle, ArrowRight, Search, Bell, Menu, X, ChevronDown, HeartHandshake,
  Compass, BookOpen, Sparkles, Info, LifeBuoy, MessageSquare, BarChart3, Star, Users,
  User as UserIcon, LogOut, Settings, ShieldCheck, Layers, Send } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

/**
 * SiteHeader — premium, modern marketing/app header (Notion/Linear/Stripe vibe).
 *
 * Props:
 *  - user                 → current user object (for menu state, admin badge)
 *  - onLogin              → open auth dialog
 *  - onProfile            → open profile dialog
 *  - onLogout             → log out
 *  - onAdmin              → open admin dialog (optional)
 *  - onDashboard          → open dashboard dialog
 *  - onSubmit             → open submit-a-location dialog
 *  - onEnterApp(tab)      → enter HomeShell, optional tab key: 'feed'|'facilities'|'marketplace'|'jobs'|'community'
 *  - notificationsCount   → integer badge for bell
 *  - active               → 'home' | 'community' | etc. (highlights current section)
 */
export default function SiteHeader({
  user, onLogin, onRegister, onProfile, onLogout, onAdmin, onDashboard, onSubmit, onEnterApp,
  notificationsCount = 0, active = 'home',
}) {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isAdmin = user && ['super_admin', 'admin', 'moderator'].includes(user.role)

  // V1 nav + Marketplace revival (July 2026). 6-item public nav.
  const primaryNav = [
    { key: 'facilities',  label: 'Facilities',  onClick: () => router.push('/facilities'),  match: 'facilities' },
    // { key: 'community',   label: 'Community',   onClick: () => router.push('/community'),   match: 'community' },
    { key: 'marketplace', label: 'Marketplace', onClick: () => router.push('/marketplace'), match: 'marketplace' },
    { key: 'business',    label: 'Business',    onClick: () => window.open('/business', '_blank', 'noopener,noreferrer'), match: 'business' },
    { key: 'donate',      label: 'Donate',      onClick: () => router.push('/donate'),      match: 'donate' },
    { key: 'about',       label: 'About',       onClick: () => router.push('/#about'),      match: 'about' },
  ]

  const handleSearchSubmit = (e) => {
    e?.preventDefault()
    const q = searchValue.trim()
    setSearchOpen(false)
    setSearchValue('')
    if (!q) { onEnterApp?.('feed'); return }
    // Send to home shell with search hint via URL hash
    router.push(`/?q=${encodeURIComponent(q)}#launch`)
    setTimeout(() => onEnterApp?.('feed'), 0)
  }

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-all duration-200 ${
        scrolled
          ? 'h-14 border-neutral-200/80 bg-white/85 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] backdrop-blur'
          : 'h-16 border-neutral-200/60 bg-white/95 backdrop-blur'
      }`}
    >
      <div className="container mx-auto flex h-full items-center gap-3 px-4 lg:gap-4 xl:gap-6">
        {/* LEFT — logo + status */}
        <button
          onClick={() => { setMobileOpen(false); router.push(user ? '/dashboard' : '/') }}
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-md transition hover:opacity-90"
          aria-label={user ? 'DumpMaps dashboard' : 'DumpMaps home'}
        >
          <img src="/dumpmaps-logo.png" alt="DumpMaps" className="h-8 w-8 shrink-0 rounded-md object-contain" />
          <span className="whitespace-nowrap text-[15px] font-extrabold leading-none tracking-tight sm:text-[17px]">
            Dump<span className="text-emerald-600">Maps</span>
          </span>
          <span className="ml-1 hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 xl:flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </button>

        {/* CENTER — primary navigation (desktop ≥1024px) */}
        <nav className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
          <ul className="flex items-center gap-0.5 xl:gap-1">
            {primaryNav.map((n) => {
              const isActive = (active === n.match) || (active === n.key)
              return (
                <li key={n.key}>
                  <button
                    onClick={n.onClick}
                    className={`relative inline-flex items-center whitespace-nowrap rounded-md px-2 py-1.5 text-[12.5px] font-medium transition xl:px-3 xl:text-[13.5px] ${
                      isActive
                        ? 'text-neutral-900'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    {n.label}
                    {isActive && <span className="absolute inset-x-2 -bottom-[1px] h-0.5 rounded-full bg-brand-500" />}
                  </button>
                </li>
              )
            })}
            <li>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[12.5px] font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 xl:px-2.5 xl:text-[13.5px]">
                    More <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  <DropdownMenuLabel className="text-xs uppercase tracking-wide text-neutral-500">Explore</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => router.push('/community/groups')}>
                    <Users className="mr-2 h-4 w-4" /> Community groups
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); router.push('/#categories') }}>
                    <Layers className="mr-2 h-4 w-4" /> Categories
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/#how')}>
                    <BookOpen className="mr-2 h-4 w-4" /> How it works
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/#pilot')}>
                    <Sparkles className="mr-2 h-4 w-4" /> Pilot program
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/community/guidelines')}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Community guidelines
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs uppercase tracking-wide text-neutral-500">Support DumpMaps</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => router.push('/donate')}>
                    <HeartHandshake className="mr-2 h-4 w-4 text-brand-600" /> Donate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/#about')}>
                    <Info className="mr-2 h-4 w-4" /> About
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/#support')}>
                    <LifeBuoy className="mr-2 h-4 w-4" /> Help &amp; support
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          </ul>
        </nav>

        {/* RIGHT — search, notifications, user, primary CTA */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 md:gap-1 xl:gap-1.5">
          {/* Search */}
          <DropdownMenu open={searchOpen} onOpenChange={setSearchOpen}>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Search"
                className="hidden h-9 w-9 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 md:inline-flex"
              >
                <Search className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(340px,calc(100vw-2rem))] p-2">
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <Search className="ml-1 h-4 w-4 text-neutral-400" />
                <Input
                  autoFocus
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search facilities, jobs, community…"
                  className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
                />
                <Button size="sm" type="submit" className="h-8 bg-brand-600 hover:bg-brand-700">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
              <div className="mt-2 border-t border-neutral-100 pt-2">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Quick filters</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {[
                    { l: 'Open now', q: 'open' },
                    { l: 'Mattresses', q: 'mattresses' },
                    { l: 'E-waste', q: 'e-waste' },
                    { l: 'Concrete', q: 'concrete' },
                    { l: 'Free / curb', q: 'free' },
                  ].map((c) => (
                    <button
                      key={c.l}
                      onClick={() => { setSearchValue(c.q); }}
                      className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700 hover:border-neutral-400"
                    >
                      {c.l}
                    </button>
                  ))}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications (placeholder until inbox wires in) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Notifications"
                className="relative hidden h-9 w-9 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 md:inline-flex"
              >
                <Bell className="h-4 w-4" />
                {notificationsCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {notificationsCount > 9 ? '9+' : notificationsCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                <Badge variant="outline" className="text-[10px]">Beta</Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-6 text-center text-xs text-neutral-500">
                You&apos;re all caught up — new alerts will appear here.
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDashboard?.()}>
                <BarChart3 className="mr-2 h-4 w-4" /> Open dashboard
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User profile dropdown (logged-in) OR Log in + Join Beta (logged-out) */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-0.5 hidden items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-1 pl-1 pr-1.5 text-sm transition hover:bg-neutral-50 md:inline-flex xl:ml-1 xl:gap-2 xl:pr-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-[12px] font-bold text-white">
                    {(user.name || user.email || '?')[0].toUpperCase()}
                  </span>
                  <span className="hidden max-w-[120px] truncate font-medium text-neutral-800 xl:inline">
                    {(user.name || user.email?.split('@')[0] || '').split(' ')[0]}
                  </span>
                  {isAdmin && (
                    <span className="hidden rounded bg-neutral-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white xl:inline">Admin</span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white">
                      {(user.name || user.email || '?')[0].toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{user.name || user.email}</div>
                      <div className="truncate text-[11px] font-normal text-neutral-500">{user.email}</div>
                    </div>
                  </div>
                  {user.karma != null && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-neutral-600">
                      <Star className="h-3 w-3 text-amber-500" /> {user.karma || 0} karma
                    </div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onProfile}><UserIcon className="mr-2 h-4 w-4" /> Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={onDashboard}><BarChart3 className="mr-2 h-4 w-4" /> Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/messages')}><MessageSquare className="mr-2 h-4 w-4" /> Messages</DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={onAdmin}><ShieldCheck className="mr-2 h-4 w-4 text-amber-600" /> Admin console</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onSubmit}><Send className="mr-2 h-4 w-4" /> Submit a location</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/donate')} className="text-emerald-700 focus:text-emerald-800"><HeartHandshake className="mr-2 h-4 w-4" /> Support Our Mission</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/settings')}><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={onLogout} className="text-red-600 focus:text-red-700"><LogOut className="mr-2 h-4 w-4" /> Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button onClick={onLogin} variant="ghost" size="sm" className="hidden h-9 px-3 text-[13px] font-medium md:inline-flex">
                Log In
              </Button>
              <Button onClick={() => (onRegister ? onRegister() : onLogin?.())} variant="outline" size="sm" className="hidden h-9 border-emerald-200 bg-emerald-50 px-3 text-[13px] font-medium text-emerald-700 hover:bg-emerald-100 md:inline-flex">
                Register
              </Button>
            </>
          )}

          {/* Primary CTA — Join Beta (logged-out) / Support Our Mission (logged-in) */}
          {user ? (
            <Button
              onClick={() => router.push('/donate')}
              size="sm"
              aria-label="Support Our Mission"
              title="Support Our Mission"
              className="ml-0.5 hidden h-9 shrink-0 rounded-md bg-emerald-600 px-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-700 md:inline-flex xl:ml-1 xl:px-3"
            >
              <HeartHandshake className="h-3.5 w-3.5 xl:mr-1" />
              <span className="hidden xl:inline">Support Our Mission</span>
            </Button>
          ) : (
            <Button
              onClick={() => router.push('/beta')}
              size="sm"
              className="ml-0.5 hidden h-9 shrink-0 whitespace-nowrap rounded-md bg-emerald-600 px-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-700 md:inline-flex xl:ml-1 xl:px-3"
            >
              Join Beta <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}

          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open menu"
                className="ml-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-700 transition hover:bg-neutral-100 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[88vw] max-w-sm overflow-y-auto p-0 sm:w-[380px]">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <img src="/dumpmaps-logo.png" alt="DumpMaps" className="h-7 w-7 rounded-md object-contain" />
                    <span className="text-base font-extrabold tracking-tight">Dump<span className="text-emerald-600">Maps</span></span>
                  </div>
                  {/* <button onClick={() => setMobileOpen(false)} aria-label="Close" className="rounded-md p-1.5 hover:bg-neutral-100">
                    <X className="h-4 w-4" />
                  </button> */}
                </div>

                {/* search */}
                <form onSubmit={(e) => { e.preventDefault(); setMobileOpen(false); handleSearchSubmit(e) }} className="px-4 pt-3">
                  <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                    <Search className="h-4 w-4 text-neutral-500" />
                    <input
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder="Search facilities, community…"
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
                    />
                  </div>
                </form>

                {/* nav links */}
                <nav className="mt-3 flex-1 px-2">
                  <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Explore</p>
                  {primaryNav.map((n) => (
                    <button
                      key={n.key}
                      onClick={() => { setMobileOpen(false); n.onClick?.() }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[15px] font-medium text-neutral-800 hover:bg-neutral-100"
                    >
                      {n.label}
                      <ArrowRight className="h-4 w-4 text-neutral-400" />
                    </button>
                  ))}
                  <p className="mt-3 px-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">More</p>
                  <button onClick={() => { setMobileOpen(false); router.push('/donate') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-[15px] font-semibold text-emerald-700 hover:bg-emerald-50"><HeartHandshake className="h-4 w-4 text-emerald-600" /> Support Our Mission</button>
                  <button onClick={() => { setMobileOpen(false); router.push('/community/guidelines') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-[15px] font-medium text-neutral-800 hover:bg-neutral-100"><ShieldCheck className="h-4 w-4 text-neutral-500" /> Community guidelines</button>
                  <button onClick={() => { setMobileOpen(false); router.push('/#how') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-[15px] font-medium text-neutral-800 hover:bg-neutral-100"><BookOpen className="h-4 w-4 text-neutral-500" /> How it works</button>
                  <button onClick={() => { setMobileOpen(false); router.push('/#about') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-[15px] font-medium text-neutral-800 hover:bg-neutral-100"><Info className="h-4 w-4 text-neutral-500" /> About</button>
                  <button onClick={() => { setMobileOpen(false); router.push('/#support') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-[15px] font-medium text-neutral-800 hover:bg-neutral-100"><LifeBuoy className="h-4 w-4 text-neutral-500" /> Help &amp; support</button>
                </nav>

                {/* Sticky bottom: profile / CTA */}
                <div className="sticky bottom-0 mt-3 border-t border-neutral-200 bg-white px-4 py-3">
                  {user ? (
                    <div className="space-y-2">
                      <button onClick={() => { setMobileOpen(false); onProfile?.() }} className="flex w-full items-center gap-3 rounded-lg bg-neutral-50 p-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white">
                          {(user.name || user.email || '?')[0].toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="truncate text-sm font-semibold">{user.name || user.email}</div>
                          <div className="truncate text-[11px] text-neutral-500">{isAdmin ? 'Admin' : (user.verificationLevel || 'User').replace('_', ' ')}</div>
                        </div>
                        {isAdmin && <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Admin</span>}
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => { setMobileOpen(false); onDashboard?.() }} className="h-10"><BarChart3 className="mr-1 h-4 w-4" /> Dashboard</Button>
                        {isAdmin
                          ? <Button variant="outline" onClick={() => { setMobileOpen(false); onAdmin?.() }} className="h-10"><ShieldCheck className="mr-1 h-4 w-4" /> Admin</Button>
                          : <Button variant="outline" onClick={() => { setMobileOpen(false); onProfile?.() }} className="h-10"><UserIcon className="mr-1 h-4 w-4" /> Profile</Button>}
                      </div>
                      <Button onClick={() => { setMobileOpen(false); router.push('/donate') }} className="h-11 w-full bg-emerald-600 hover:bg-emerald-700"><HeartHandshake className="mr-1 h-4 w-4" /> Support Our Mission</Button>
                      <button onClick={() => { setMobileOpen(false); onLogout?.() }} className="w-full rounded-md py-2 text-center text-xs text-neutral-500 hover:text-red-600">Log out</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button onClick={() => { setMobileOpen(false); onLogin?.() }} variant="outline" className="h-10 w-full">Log In</Button>
                        <Button onClick={() => { setMobileOpen(false); (onRegister ? onRegister() : onLogin?.()) }} variant="outline" className="h-10 w-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Register</Button>
                      </div>
                      <Button onClick={() => { setMobileOpen(false); router.push('/beta') }} className="h-11 w-full bg-emerald-600 hover:bg-emerald-700">Join Beta <ArrowRight className="ml-1 h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
