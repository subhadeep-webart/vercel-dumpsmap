'use client'

// Portal top bar: mobile menu trigger, brand lockup (mobile only — the sidebar
// carries it on desktop), notifications bell, and the facility switcher dropdown
// for owners who manage more than one facility. Purely presentational; the parent
// owns the mobile-drawer open state and the selected facility.

import Link from 'next/link'
import { Menu, Bell, ChevronDown, Check, Building2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { deriveInitials } from '@/components/profile/primitives'

export default function PortalTopbar({ facility, facilities = [], onSelect, onOpenMenu, unread = 0 }) {
  const multi = facilities.length > 1

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Brand (mobile only — sidebar shows it on desktop) */}
        <Link href="/profile" className="flex items-center gap-1.5 lg:hidden">
          <span className="text-sm font-extrabold tracking-tight text-neutral-900">DumpMaps</span>
          <span className="text-[11px] font-medium text-neutral-500">Portal</span>
        </Link>

        <div className="flex-1" />

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        {/* Facility switcher */}
        {facility && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 disabled:opacity-100"
              disabled={!multi}
            >
              <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-600 ring-1 ring-neutral-200">
                {facility.photos?.[0] || facility.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={facility.photos?.[0] || facility.images?.[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  deriveInitials(facility.name)
                )}
              </span>
              <span className="hidden max-w-[180px] truncate sm:inline">{facility.name}</span>
              {multi && <ChevronDown className="h-4 w-4 text-neutral-400" />}
            </DropdownMenuTrigger>
            {multi && (
              <DropdownMenuContent align="end" className="w-64">
                {facilities.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    onClick={() => onSelect?.(f.id)}
                    className="flex items-center gap-2"
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-neutral-400" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    {f.id === facility.id && <Check className="h-4 w-4 text-emerald-600" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
