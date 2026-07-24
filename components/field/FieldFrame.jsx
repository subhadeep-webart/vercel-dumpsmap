'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useFieldBack } from '@/lib/field-back'
import AppHeader from '@/components/AppHeader'

/**
 * FieldFrame — interior detail-page shell.
 *
 * Now unified with the rest of the app: renders the canonical <AppHeader />
 * at the top (Priority 1: single AppHeader everywhere) and adds a compact
 * sub-strip with a Back button + page title + optional right slot. The global
 * <GlobalMobileNav /> mounted in app/layout.js provides the bottom nav.
 *
 * Props:
 *   title          — page title shown in the sub-strip
 *   back           — explicit fallback href for the Back button (used when
 *                    browser history is empty)
 *   right          — optional ReactNode in the top-right of the sub-strip
 *   bodyClassName  — extra classes for the scrollable body
 *   noBackButton   — hide the back button
 *   active         — nav highlight key forwarded to AppHeader
 */
export default function FieldFrame({
  title,
  back = null,
  right = null,
  children,
  className = '',
  bodyClassName = '',
  noBackButton = false,
  active,
}) {
  const goBack = useFieldBack(typeof back === 'string' ? back : null)
  return (
    <div className={`flex min-h-[100dvh] flex-col bg-neutral-50 ${className}`}>
      <AppHeader active={active} />

      {(title || !noBackButton || right) && (
        <div className="sticky top-14 z-20 flex h-11 flex-none items-center gap-2 border-b border-neutral-200 bg-white/95 px-3 backdrop-blur">
          {!noBackButton && (
            <button
              onClick={goBack}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          {title && (
            <h1 className="min-w-0 flex-1 truncate text-sm font-extrabold tracking-tight">{title}</h1>
          )}
          {right && <div className="flex items-center gap-1">{right}</div>}
        </div>
      )}

      <main className={`flex-1 overflow-y-auto pb-24 ${bodyClassName}`}>
        {children}
      </main>
    </div>
  )
}
