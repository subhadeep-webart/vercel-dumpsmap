'use client'

// GlobalMobileNav — mount once in app/layout.js. Renders the canonical
// <MobileBottomNav /> on every interior page EXCEPT:
//   - `/`          (HomeShell renders its own integrated bottom nav)
//   - `/admin/*`   (AdminShell freeze-pane layout)
//   - `/login`, `/signup`, `/forgot-password`, `/reset-password` (auth flows)
//
// This guarantees a single mobile navigation pattern across the entire app
// without forcing each page to wrap itself in <PageShell>.

import React from 'react'
import { usePathname } from 'next/navigation'
import MobileBottomNav from '@/components/MobileBottomNav'

const HIDDEN_PREFIXES = ['/admin']
const HIDDEN_EXACT = new Set(['/', '/login', '/signup', '/forgot-password', '/reset-password'])

export default function GlobalMobileNav() {
  const pathname = usePathname() || '/'
  if (HIDDEN_EXACT.has(pathname)) return null
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null
  return <MobileBottomNav />
}
