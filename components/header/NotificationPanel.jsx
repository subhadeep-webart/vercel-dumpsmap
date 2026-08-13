'use client'

// NotificationPanel — the dropdown that opens from the header bell.
//
// Presentational only: rows come from useHeaderNotifications (which derives
// them from /api/inbox/unread-count). Clicking a row deep-links into the
// matching inbox tab; the bell itself no longer navigates anywhere.

import Link from 'next/link'
import { Bell, Check } from 'lucide-react'
import {
  DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

// Same tint vocabulary as the mobile drawer rows, so the two surfaces match.
const TINTS = {
  emerald: 'bg-emerald-100 text-emerald-700',
  orange:  'bg-orange-100 text-orange-700',
  sky:     'bg-sky-100 text-sky-700',
  rose:    'bg-rose-100 text-rose-700',
  amber:   'bg-amber-100 text-amber-700',
  neutral: 'bg-neutral-100 text-neutral-700',
}

const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`

export default function NotificationPanel({ items, total, loading, icons }) {
  return (
    <DropdownMenuContent align="end" className="w-[min(320px,calc(100vw-2rem))] p-0">
      <DropdownMenuLabel className="flex items-center justify-between px-3 py-2.5">
        <span className="text-sm font-bold">Notifications</span>
        {total > 0 && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
            {total > 99 ? '99+' : total} new
          </span>
        )}
      </DropdownMenuLabel>
      <DropdownMenuSeparator className="my-0" />

      {loading && items.length === 0 ? (
        <div className="space-y-2 p-3" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-neutral-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
                <div className="h-2.5 w-32 animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="h-5 w-5" />
          </span>
          <p className="mt-2 text-sm font-semibold text-neutral-800">You&apos;re all caught up</p>
          <p className="mt-0.5 text-xs text-neutral-500">New activity will show up here.</p>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto py-1">
          {items.map((it) => {
            const Icon = icons[it.icon] || Bell
            return (
              <DropdownMenuItem key={it.key} asChild className="px-2 py-2">
                <Link href={it.href} className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TINTS[it.tint] || TINTS.neutral}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-neutral-900">{it.label}</span>
                    <span className="block truncate text-[11px] text-neutral-500">{plural(it.count, it.noun)}</span>
                  </span>
                  <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {it.count > 99 ? '99+' : it.count}
                  </span>
                </Link>
              </DropdownMenuItem>
            )
          })}
        </div>
      )}

      <DropdownMenuSeparator className="my-0" />
      <DropdownMenuItem asChild className="justify-center px-3 py-2.5">
        <Link href="/inbox" className="text-[13px] font-semibold text-emerald-700">Open inbox</Link>
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
