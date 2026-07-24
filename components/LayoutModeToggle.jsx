'use client'

// LayoutModeToggle
// ---------------------------------------------------------------------------
// 3-state segmented control for P4 — Mobile/Desktop view override.
//   • Auto    — respect device size
//   • Mobile  — force mobile canvas
//   • Desktop — force desktop canvas
//
// Variants:
//   • <LayoutModeToggle variant="compact" />  — single icon-button cycling Auto→Mobile→Desktop (header)
//   • <LayoutModeToggle variant="segmented" /> — full 3-button segmented (settings)
//   • <LayoutModeToggle variant="link" />      — "View Desktop Site" / "View Mobile Site" footer link

import React from 'react'
import { Smartphone, Monitor, Wand2, Check } from 'lucide-react'
import { useLayoutMode } from '@/lib/layout-mode'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'

const OPTIONS = [
  { key: 'auto',    label: 'Auto',    desc: 'Match device', icon: Wand2 },
  { key: 'mobile',  label: 'Mobile',  desc: 'Force mobile canvas', icon: Smartphone },
  { key: 'desktop', label: 'Desktop', desc: 'Force desktop canvas', icon: Monitor },
]

export default function LayoutModeToggle({ variant = 'compact', className = '' }) {
  const { viewPreference, setViewPreference, effectiveLayout } = useLayoutMode()
  const current = OPTIONS.find((o) => o.key === viewPreference) || OPTIONS[0]
  const CurrentIcon = current.icon

  // ---------- compact: dropdown button (used in AppHeader) ----------
  if (variant === 'compact') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Layout: ${current.label}`}
          title={`Layout: ${current.label}`}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 ${className}`}
        >
          <CurrentIcon className="h-4 w-4" />
          {viewPreference !== 'auto' && (
            <span className="absolute -mt-4 ml-4 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-neutral-500">Layout preference</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {OPTIONS.map((o) => {
            const Active = o.key === viewPreference
            const Icon = o.icon
            return (
              <DropdownMenuItem key={o.key} onClick={() => setViewPreference(o.key)} className="flex cursor-pointer items-center gap-2">
                <Icon className="h-4 w-4 text-neutral-500" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-neutral-800">{o.label}</div>
                  <div className="text-[11px] text-neutral-500">{o.desc}</div>
                </div>
                {Active && <Check className="h-4 w-4 text-brand-600" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // ---------- segmented: full 3-button (used in Settings) ----------
  if (variant === 'segmented') {
    return (
      <div role="radiogroup" aria-label="Layout preference" className={`inline-flex rounded-lg border border-neutral-200 bg-white p-1 ${className}`}>
        {OPTIONS.map((o) => {
          const Active = o.key === viewPreference
          const Icon = o.icon
          return (
            <button
              key={o.key}
              role="radio"
              aria-checked={Active}
              onClick={() => setViewPreference(o.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition ${Active ? 'bg-brand-50 font-bold text-brand-700' : 'text-neutral-600 hover:bg-neutral-100'}`}
            >
              <Icon className="h-4 w-4" />
              <span>{o.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // ---------- link: footer "View Desktop Site" toggle ----------
  if (variant === 'link') {
    // If we're currently rendering small (auto+device-narrow OR forced mobile) show "View Desktop".
    // If we're rendering desktop (auto+wide OR forced desktop) show "View Mobile".
    const goingTo = effectiveLayout === 'mobile' ? 'desktop' : 'mobile'
    const label = goingTo === 'desktop' ? 'View Desktop Site' : 'View Mobile Site'
    const Icon = goingTo === 'desktop' ? Monitor : Smartphone
    return (
      <button
        onClick={() => setViewPreference(goingTo)}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-brand-700 ${className}`}
      >
        <Icon className="h-3.5 w-3.5" /> {label}
      </button>
    )
  }

  return null
}
