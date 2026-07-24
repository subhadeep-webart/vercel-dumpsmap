'use client'

// MobileBottomNav (single source of truth)
// ---------------------------------------------------------------------------
// 5-tab sticky bottom navigation rendered on every interior page on mobile.
// Hidden on desktop (md+). Replaces both the old HomeShell bottom bar and the
// global FieldModeRoot bar.
//
//   [Home]  [Search]  [Jobs]  [Alerts]  [Profile]
//
// A floating + FAB sits ABOVE the bar at bottom-right.
//
// Props (all optional):
//   active   — 'home' | 'search' | 'jobs' | 'alerts' | 'profile'
//   onPost   — click handler for the + FAB. Defaults to /?post=1 redirect.
//   user     — pre-fetched user (otherwise we fetch /api/auth/me).
//   unread   — alerts badge override.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  Home, MapPin, Users, ShoppingBag, User as UserIcon, Plus,
} from 'lucide-react'

function inferActive(pathname) {
  if (!pathname) return null
  if (pathname === '/' || pathname === '/dashboard' || pathname.startsWith('/activity-hub')) return 'home'
  if (pathname.startsWith('/facilities'))  return 'facilities'
  if (pathname.startsWith('/community'))   return 'community'
  if (pathname.startsWith('/marketplace')) return 'marketplace'
  if (pathname.startsWith('/profile') || pathname.startsWith('/settings') || pathname.startsWith('/inbox') || pathname.startsWith('/notifications')) return 'profile'
  return null
}

const TABS = [
  { key: 'home',        label: 'Home',        icon: Home,        href: '/activity-hub' },
  { key: 'facilities',  label: 'Facilities',  icon: MapPin,      href: '/facilities' },
  { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag, href: '/marketplace' },
  { key: 'community',   label: 'Community',   icon: Users,       href: '/community' },
  { key: 'profile',     label: 'Profile',     icon: UserIcon,    href: '/profile' },
]

export default function MobileBottomNav({ active, onPost, user: userProp, unread: unreadProp }) {
  const router = useRouter()
  const pathname = usePathname() || ''
  const [user, setUser] = useState(userProp || null)
  const [unread, setUnread] = useState(typeof unreadProp === 'number' ? unreadProp : 0)
  const resolvedActive = active || inferActive(pathname)

  useEffect(() => {
    if (userProp !== undefined) return
    const t = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!t) return
    let cancelled = false
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setUser(j?.user || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [userProp])

  // Fetch unread count once on mount (when not provided via prop).
  useEffect(() => {
    if (typeof unreadProp === 'number') return undefined
    const t = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!t) return undefined
    let cancelled = false
    fetch('/api/inbox/unread-count', { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((j) => { if (!cancelled && typeof j?.count === 'number') setUnread(j.count) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [unreadProp])

  // Effective unread = prop wins when provided.
  const effectiveUnread = typeof unreadProp === 'number' ? unreadProp : unread

  const handleTabClick = (e, t) => {
    // Auth gate Profile/Alerts when logged out
    if ((t.key === 'profile' || t.key === 'alerts') && !user) {
      e.preventDefault()
      router.push(`/?login=1&returnTo=${encodeURIComponent(t.href)}`)
    }
  }

  const handlePost = () => {
    if (onPost) { onPost(); return }
    router.push('/?post=1')
  }

  // Hide the compose FAB on the Facilities Directory — the P0 mobile rebuild
  // provides contextual "Check In" buttons per card, so a floating + would only
  // obstruct card actions and duplicate the primary CTA.
  const hideFab = pathname === '/facilities' || pathname.startsWith('/facilities?')

  return (
    <>
      {/* Floating + FAB — anchored just above the bottom nav, mobile only */}
      {!hideFab && (
        <button
          onClick={handlePost}
          aria-label="Quick post"
          className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition active:scale-95 hover:bg-emerald-700 md:hidden"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <nav
        role="navigation"
        aria-label="Mobile navigation"
        className="sticky bottom-0 z-30 flex h-14 flex-none items-stretch border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 md:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      >
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = resolvedActive === t.key
          const badge = t.key === 'alerts' ? unread : 0
          return (
            <Link
              key={t.key}
              href={t.href}
              onClick={(e) => handleTabClick(e, t)}
              className={`relative flex-1 flex-col items-center justify-center text-[10px] font-semibold transition ${isActive ? 'text-emerald-700' : 'text-neutral-500 hover:text-neutral-700'}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="flex h-full flex-col items-center justify-center gap-0.5 py-1">
                <div className="relative">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-600' : ''}`} />
                  {badge > 0 && (
                    <span className="absolute -right-1.5 -top-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>
                  )}
                </div>
                <span>{t.label}</span>
              </div>
              {isActive && <span className="absolute inset-x-6 -top-px h-0.5 rounded-b bg-emerald-500" />}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
