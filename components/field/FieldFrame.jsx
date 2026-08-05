'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Home } from 'lucide-react'
import { useFieldBack } from '@/lib/field-back'
import AppHeader from '@/components/AppHeader'

/**
 * FieldFrame — interior detail-page shell.
 *
 * Renders a compact sub-strip with a Back button + a breadcrumb trail + page
 * title + optional right slot, and (by default) the canonical <AppHeader /> at
 * the top. The global <GlobalMobileNav /> mounted in app/layout.js provides the
 * bottom nav.
 *
 * When the page already lives under a layout that supplies <AppHeader /> (e.g.
 * the app/(app) route group), pass `hideHeader` so the header isn't rendered
 * twice — FieldFrame then contributes only its sub-strip. The sub-strip sticks
 * below the header when present, and to the top otherwise.
 *
 * Props:
 *   title          — page title shown in the sub-strip (also the last crumb)
 *   back           — explicit fallback href for the Back button (used when
 *                    browser history is empty); also the parent crumb's href
 *                    when `breadcrumbs` is not supplied
 *   breadcrumbs    — optional [{ label, href? }] trail. When omitted, a simple
 *                    Home → (back) → title trail is derived automatically.
 *   right          — optional ReactNode in the top-right of the sub-strip
 *   bodyClassName  — extra classes for the scrollable body
 *   noBackButton   — hide the back button
 *   hideHeader     — skip the internal <AppHeader /> (an ancestor layout renders it)
 *   active         — nav highlight key forwarded to AppHeader
 */

// Turn a fallback href like "/community" into a friendly label ("Community").
function labelFromHref(href) {
  if (!href || href === '/') return 'Home'
  const seg = href.split('?')[0].split('/').filter(Boolean).pop() || 'Home'
  return seg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function Breadcrumbs({ crumbs }) {
  if (!crumbs?.length) return null
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
      <ol className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-neutral-500">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          // Only the final crumb is guaranteed visible; the intermediate crumbs
          // are hidden on the narrowest screens (sm:flex) so a long trail can
          // never push the row wider than its column and collide with the
          // right-hand actions (e.g. the Report button).
          const content = (
            <span className={`inline-flex items-center gap-1 ${last ? 'min-w-0 truncate font-bold text-neutral-900' : ''}`}>
              {c.icon ? <c.icon className="h-3 w-3 shrink-0" /> : null}
              {last ? <span className="truncate">{c.label}</span> : c.label}
            </span>
          )
          return (
            <li
              key={i}
              className={`min-w-0 items-center gap-1 ${last ? 'flex' : 'hidden sm:flex'}`}
            >
              {i > 0 && <ChevronRight className="hidden h-3 w-3 shrink-0 text-neutral-300 sm:block" />}
              {last || !c.href ? (
                <span className="min-w-0" aria-current={last ? 'page' : undefined}>{content}</span>
              ) : (
                <Link
                  href={c.href}
                  className="shrink-0 rounded px-0.5 text-neutral-500 transition-colors hover:text-brand-600 hover:underline"
                >
                  {content}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default function FieldFrame({
  title,
  back = null,
  breadcrumbs = null,
  right = null,
  children,
  className = '',
  bodyClassName = '',
  noBackButton = false,
  hideHeader = false,
  active,
}) {
  const goBack = useFieldBack(typeof back === 'string' ? back : null)

  // Derive a breadcrumb trail when the caller didn't supply one: Home → parent
  // (the `back` href) → current title. Keeps every existing FieldFrame page
  // getting a breadcrumb for free without a code change.
  const crumbs = breadcrumbs || [
    { label: 'Home', href: '/', icon: Home },
    ...(typeof back === 'string' && back !== '/' ? [{ label: labelFromHref(back), href: back }] : []),
    ...(title ? [{ label: title }] : []),
  ]

  return (
    <div className={`flex min-h-[100dvh] flex-col bg-neutral-50 ${className}`}>
      {!hideHeader && <AppHeader active={active} />}

      {(title || !noBackButton || right) && (
        <div className={`sticky ${hideHeader ? 'top-0' : 'top-14'} z-20 flex h-11 flex-none animate-fieldstrip-in items-center gap-2 border-b border-neutral-200 bg-white/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 motion-reduce:animate-none`}>
          {!noBackButton && (
            <button
              onClick={goBack}
              className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 active:scale-90"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            </button>
          )}

          <Breadcrumbs crumbs={crumbs} />

          {right && <div className="flex shrink-0 items-center gap-1">{right}</div>}
        </div>
      )}

      <main className={`flex-1 overflow-y-auto pb-24 ${bodyClassName}`}>
        {children}
      </main>
    </div>
  )
}
