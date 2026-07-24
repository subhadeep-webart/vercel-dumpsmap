'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, MessageCircle, MapPin, ChevronDown, ArrowLeft } from 'lucide-react'
import { useFieldBack } from '@/lib/field-back'

/**
 * Top bar for Field Mode.
 * Shows: optional Back button, DumpMaps logo + title, location selector,
 * messages icon, notifications icon, and profile avatar.
 * View Mode toggle lives inside the Profile/menu (not the header bar).
 */
export default function FieldHeader({
  unreadCount = 0,
  location = 'Nearby',
  onLocationClick,
  onOpenInbox,
  onOpenAlerts,
  onOpenProfile,
  user,
  showBack = false,
  backFallback = null,
}) {
  const router = useRouter()
  const back = useFieldBack(backFallback)
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-12 items-center justify-between gap-2 px-2">
        <div className="flex min-w-0 items-center gap-1">
          {showBack && (
            <button
              onClick={back}
              aria-label="Back"
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-1.5" aria-label={user ? 'DumpMaps dashboard' : 'DumpMaps home'}>
            <img src="/dumpmaps-logo.png" alt="DumpMaps" className="h-7 w-7 rounded-md object-contain" />
            <span className="text-sm font-extrabold tracking-tight">DumpMaps</span>
          </Link>
        </div>
        <button
          onClick={onLocationClick}
          className="flex min-w-0 max-w-[40%] flex-1 items-center justify-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-700 hover:bg-neutral-100"
          aria-label="Change location"
        >
          <MapPin className="h-3 w-3 shrink-0 text-brand-600" />
          <span className="truncate font-semibold">{location}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-neutral-400" />
        </button>
        <div className="flex items-center gap-1">
          <button onClick={onOpenInbox} className="relative rounded-full p-1.5 text-neutral-600 hover:bg-neutral-100" aria-label="Messages">
            <MessageCircle className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>
          <button onClick={onOpenAlerts} className="rounded-full p-1.5 text-neutral-600 hover:bg-neutral-100" aria-label="Alerts">
            <Bell className="h-4 w-4" />
          </button>
          {user ? (
            <button
              onClick={() => (onOpenProfile ? onOpenProfile() : router.push('/?tab=profile'))}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[10px] font-bold text-white"
              aria-label="Profile"
            >
              {(user.name || user.email || '?')[0].toUpperCase()}
            </button>
          ) : (
            <Link href="/?login=1" className="rounded-md bg-brand-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-brand-700">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  )
}
