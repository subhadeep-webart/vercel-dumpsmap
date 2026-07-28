'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useFieldBack } from '@/lib/field-back'
import AppHeader from '@/components/AppHeader'

/**
 * FieldFrame — interior detail-page shell.
 *
 * Renders a compact sub-strip with a Back button + page title + optional right
 * slot, and (by default) the canonical <AppHeader /> at the top. The global
 * <GlobalMobileNav /> mounted in app/layout.js provides the bottom nav.
 *
 * When the page already lives under a layout that supplies <AppHeader /> (e.g.
 * the app/(app) route group), pass `hideHeader` so the header isn't rendered
 * twice — FieldFrame then contributes only its sub-strip. The sub-strip sticks
 * below the header when present, and to the top otherwise.
 *
 * Props:
 *   title          — page title shown in the sub-strip
 *   back           — explicit fallback href for the Back button (used when
 *                    browser history is empty)
 *   right          — optional ReactNode in the top-right of the sub-strip
 *   bodyClassName  — extra classes for the scrollable body
 *   noBackButton   — hide the back button
 *   hideHeader     — skip the internal <AppHeader /> (an ancestor layout renders it)
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
  hideHeader = false,
  active,
}) {
  const goBack = useFieldBack(typeof back === 'string' ? back : null)
  return (
    <div className={`flex min-h-[100dvh] flex-col bg-neutral-50 ${className}`}>
      {!hideHeader && <AppHeader active={active} />}

      {(title || !noBackButton || right) && (
        <div className={`sticky ${hideHeader ? 'top-0' : 'top-14'} z-20 flex h-11 flex-none items-center gap-2 border-b border-neutral-200 bg-white/95 px-3 backdrop-blur`}>
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
