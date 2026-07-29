'use client'

// app/(app)/layout.js
// ---------------------------------------------------------------------------
// Shared layout for the interior "app" section. A Next.js route group — the
// "(app)" folder name is NOT part of the URL, so pages inside still resolve at
// their original paths (e.g. app/(app)/facilities → /facilities).
//
// WHY THIS EXISTS
//   Before this, every interior page imported and rendered its own <AppHeader/>.
//   That meant the header (and its auth/nav state) re-mounted on every single
//   client navigation, and the nav boilerplate was copy-pasted across ~16 pages.
//   Rendering it here once means it PERSISTS across navigations within this
//   group — React keeps the header mounted and only swaps {children}. Faster
//   nav, less re-render, one source of truth.
//
//   The active nav item is auto-detected inside <AppHeader/> from usePathname()
//   (see lib/nav-helpers.js#isNavActive), so pages no longer pass `active`.
//
// WHAT LIVES HERE vs. NOT
//   In group  → header-bearing interior pages (facilities, marketplace, donate,
//               jobs, receipts, business, beta, …).
//   NOT here  → the landing SPA (app/page.js, manages its own chrome),
//               admin/* (has app/admin/layout.js), auth pages (no header), and
//               pages using PageShell/DashboardShell (they already centralize it).

import AppHeader from '@/components/AppHeader'

export default function AppSectionLayout({ children }) {
  return (
    <div className="dm-app-section flex min-h-[100dvh] flex-col bg-neutral-50">
      <AppHeader />
      {/* Plain div (not <main>) so pages that render their own <main> don't
          produce nested/duplicate <main> landmarks. */}
      <div className="flex-1">{children}</div>
    </div>
  )
}
