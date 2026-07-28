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
import AppHeader from '@/components/AppHeader'
import Breadcrumbs from '@/components/Breadcrumbs'

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

