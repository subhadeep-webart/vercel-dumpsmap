'use client'

import React from 'react'
import Link from 'next/link'
import { Home, Search, Briefcase, Bell, User as UserIcon, Plus } from 'lucide-react'

const TABS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'search', label: 'Search', icon: Search },
  { key: 'jobs', label: 'Jobs', icon: Briefcase },
  { key: 'alerts', label: 'Alerts', icon: Bell },
  { key: 'profile', label: 'Profile', icon: UserIcon },
]

export default function FieldBottomNav({ active, onChange, unread = {}, onPost }) {
  return (
    <>
      {/* Floating Post button */}
      <button
        onClick={onPost}
        aria-label="Quick post"
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition active:scale-95 hover:bg-brand-700"
      >
        <Plus className="h-6 w-6" />
      </button>
      <nav className="sticky bottom-0 z-30 flex h-14 flex-none items-stretch border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = active === t.key
          const badge = unread[t.key] || 0
          return (
            <button
              key={t.key}
              onClick={() => onChange?.(t.key)}
              className={`relative flex-1 flex-col items-center justify-center text-[10px] font-semibold transition ${isActive ? 'text-brand-700' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              <div className="flex flex-col items-center justify-center gap-0.5 py-1">
                <div className="relative">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-brand-600' : ''}`} />
                  {badge > 0 && (
                    <span className="absolute -right-1.5 -top-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>
                  )}
                </div>
                <span>{t.label}</span>
              </div>
              {isActive && <span className="absolute inset-x-6 -top-px h-0.5 rounded-b bg-brand-500" />}
            </button>
          )
        })}
      </nav>
    </>
  )
}
