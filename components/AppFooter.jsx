'use client'

// AppFooter — minimal global footer rendered at the bottom of every page.
// Hosts the "View Desktop Site" / "View Mobile Site" toggle (P4) plus a
// short copyright + quick links row.
//
// Hidden in Field Mode on mobile (FieldShell already manages its own UI),
// and on admin freeze-pane shells.

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LayoutModeToggle from '@/components/LayoutModeToggle'
import { useViewMode } from '@/lib/view-mode'

export default function AppFooter() {
  const { viewMode, isMobile } = useViewMode()
  const pathname = usePathname() || ''

  // Hide in Field Mode + actual mobile (FieldShell owns the canvas)
  if (viewMode === 'field' && isMobile) return null
  // Hide on admin freeze-pane pages (they use a full-height shell)
  if (pathname.startsWith('/admin')) return null

  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="container mx-auto flex flex-col gap-3 px-3 py-4 text-[12px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-tight text-neutral-700">Dump<span className="text-brand-600">Maps</span></span>
          <span className="text-neutral-400">·</span>
          <span>© {year}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/community/guidelines" className="hover:text-neutral-700">Community guidelines</Link>
          <Link href="/donate" className="hover:text-neutral-700">Donate</Link>
          <Link href="/settings" className="hover:text-neutral-700">Settings</Link>
          <LayoutModeToggle variant="link" />
        </div>
      </div>
    </footer>
  )
}
