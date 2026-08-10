'use client'

// Scrollable pill tab bar for the public profile — same visual language as the
// editor's ProfileTabsNav (green active pill, hover lift, hidden scrollbar,
// sticky under the app header), but drives the public page's About/Posts/
// Listings/Reviews tabs. Counts render as a subtle badge on the pill.

import React from 'react'
import { Info, Newspaper, Store, Star } from 'lucide-react'

export const PUBLIC_TABS = [
  { key: 'about', label: 'About', icon: Info },
  { key: 'posts', label: 'Posts', icon: Newspaper },
  { key: 'listings', label: 'Listings', icon: Store },
  { key: 'reviews', label: 'Reviews', icon: Star },
]

export default function PublicProfilePillNav({ activeTab, onChange, counts = {} }) {
  return (
    <nav className="sticky top-14 z-20 border-b border-neutral-200/80 bg-white/80 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="container mx-auto flex gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-4">
        {PUBLIC_TABS.map((t) => {
          const Icon = t.icon
          const isActive = t.key === activeTab
          const count = counts[t.key]
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              aria-pressed={isActive}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 sm:px-4 ${
                isActive
                  ? 'pf-tab-active bg-green-600 text-white shadow-sm shadow-green-600/25'
                  : 'text-neutral-500 hover:-translate-y-0.5 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <Icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
              {t.label}
              {count > 0 && (
                <span className={`ml-0.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                  isActive ? 'bg-white/25 text-white' : 'bg-neutral-200 text-neutral-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
