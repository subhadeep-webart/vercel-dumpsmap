'use client'

import React, { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useViewMode } from '@/lib/view-mode'

/**
 * FieldModeRoot — reflects view-mode + isMobile on <html> as data attributes
 * so global CSS rules can target field mode.
 *
 * The legacy global bottom nav has been removed: nav is now owned by
 * <PageShell> via <MobileBottomNav>, ensuring a single nav source of truth
 * across every interior page (Priority 1: navigation consistency).
 */
export default function FieldModeRoot() {
  const { viewMode, isMobile } = useViewMode()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.viewMode = viewMode
    document.documentElement.dataset.isMobile = isMobile ? '1' : '0'
  }, [viewMode, isMobile])

  return null
}
