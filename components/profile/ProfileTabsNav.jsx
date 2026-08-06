'use client'

// Sticky tab bar for the profile editor. Purely presentational — the active
// key and the change handler are owned by the page; tab config comes from
// constants/profile_constants (TABS).

import React from 'react'
import { TABS } from '@/constants/profile_constants'

export default function ProfileTabsNav({ activeTab, onChange }) {
  return (
    <nav className="sticky top-14 z-10 border-b border-neutral-200/80 bg-white/80 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="container mx-auto flex gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-4">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = t.key === activeTab
          return (
            <button key={t.key} onClick={() => onChange(t.key)}
              aria-pressed={isActive}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 sm:px-4 ${
                isActive
                  ? 'pf-tab-active bg-green-600 text-white shadow-sm shadow-green-600/25'
                  : 'text-neutral-500 hover:-translate-y-0.5 hover:bg-neutral-100 hover:text-neutral-900'
              }`}>
              <Icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} /> {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
