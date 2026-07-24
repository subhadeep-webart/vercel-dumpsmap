'use client'

// PageShell
// ---------------------------------------------------------------------------
// Canonical wrapper for every interior page outside the landing SPA and the
// admin console. Use INSTEAD of inline <header>/<HomeBrandLink> patterns.
//
// Layout:
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │  AppHeader  (sticky)                                                 │
//   ├──────────────────────────────────────────────────────────────────────┤
//   │  Optional breadcrumb row                                             │
//   ├──────────────────────────────────────────────────────────────────────┤
//   │  <main> with consistent container + padding                          │
//   │                                                                      │
//   │     {children}                                                       │
//   │                                                                      │
//   ├──────────────────────────────────────────────────────────────────────┤
//   │  MobileBottomNav   (md:hidden)                                       │
//   └──────────────────────────────────────────────────────────────────────┘
//
// Props:
//   active          — string passed to AppHeader and MobileBottomNav for nav highlighting
//                     ('feed'|'facilities'|'marketplace'|'community'|'jobs'|'donate'|'home' etc.)
//   breadcrumbs     — array of { label, href? } items rendered above main content
//   maxWidth        — Tailwind max-w class (default 'max-w-6xl'); pass null for full-bleed
//   contentClass    — extra classes applied to the container div
//   padding         — Tailwind padding class (default 'px-4 py-6 sm:py-8')
//   bg              — background class (default 'bg-neutral-50')
//   showBottomNav   — boolean (default true). Auth pages can set false.
//   fab             — optional FAB ReactNode rendered fixed bottom-right (desktop only;
//                     mobile uses the bottom nav's + button instead).
//
// Usage:
//   <PageShell active="receipts" breadcrumbs={[{ label: 'Receipts', href: '/receipts' }, { label: 'Scan' }]}>
//     ...page content...
//   </PageShell>

import React from 'react'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import AppHeader from '@/components/AppHeader'

export default function PageShell({
  children,
  active,
  breadcrumbs,
  maxWidth = 'max-w-6xl',
  contentClass = '',
  padding = 'px-4 py-6 sm:py-8',
  bg = 'bg-neutral-50',
  showBottomNav = true, // retained for API back-compat; bottom nav is now global
  fab,
}) {
  const containerClass = maxWidth
    ? `container mx-auto ${maxWidth} ${padding} ${contentClass}`
    : `w-full ${padding} ${contentClass}`

  return (
    <div className={`flex min-h-[100dvh] flex-col ${bg}`}>
      <AppHeader active={active} />

      {Array.isArray(breadcrumbs) && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} maxWidth={maxWidth} />
      )}

      <main className="flex-1">
        <div className={containerClass}>
          {children}
        </div>
      </main>

      {fab && (
        <div className="fixed bottom-6 right-6 z-30 hidden md:block">
          {fab}
        </div>
      )}
      {/* Mobile bottom nav is rendered globally by <GlobalMobileNav /> in app/layout.js
          so a single source of truth controls nav across the entire app. */}
    </div>
  )
}

function inferActiveBottom(active) {
  if (active === 'feed' || active === 'home' || active === 'dashboard') return 'home'
  if (active === 'community') return 'community'
  if (active === 'jobs') return 'jobs'
  if (active === 'alerts' || active === 'inbox') return 'alerts'
  if (active === 'profile' || active === 'settings' || active === 'messages') return 'profile'
  return null
}

function Breadcrumbs({ items, maxWidth }) {
  const wrap = maxWidth ? `container mx-auto ${maxWidth}` : 'w-full'
  return (
    <div className="border-b border-neutral-200 bg-white">
      <div className={`${wrap} flex items-center gap-1 overflow-x-auto px-4 py-2 text-xs text-neutral-600`}>
        <Link href="/dashboard" className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 hover:bg-neutral-100 hover:text-neutral-900" aria-label="Home">
          <Home className="h-3 w-3" />
        </Link>
        {items.map((it, i) => {
          const last = i === items.length - 1
          return (
            <React.Fragment key={`${it.label}-${i}`}>
              <ChevronRight className="h-3 w-3 shrink-0 text-neutral-400" />
              {it.href && !last ? (
                <Link href={it.href} className="shrink-0 truncate rounded px-1.5 py-0.5 hover:bg-neutral-100 hover:text-neutral-900">
                  {it.label}
                </Link>
              ) : (
                <span className={`shrink-0 truncate rounded px-1.5 py-0.5 ${last ? 'font-bold text-neutral-900' : ''}`}>
                  {it.label}
                </span>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
