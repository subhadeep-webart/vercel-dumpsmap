'use client'

// Breadcrumbs
// ---------------------------------------------------------------------------
// Extracted from PageShell so pages that render their own content inside the
// (app) route-group layout (which supplies the header but not breadcrumbs) can
// still show the exact same breadcrumb row. PageShell re-exports/consumes this
// too, so there is a single implementation.
//
// Props:
//   items     — array of { label, href? }; the last item renders bold/plain.
//   maxWidth  — Tailwind max-w class to align with page content; null = full width.

import React from 'react'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

export default function Breadcrumbs({ items, maxWidth = 'max-w-6xl' }) {
  if (!Array.isArray(items) || items.length === 0) return null
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
