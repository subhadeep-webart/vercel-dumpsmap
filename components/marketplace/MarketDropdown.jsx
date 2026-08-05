'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, ChevronDown } from 'lucide-react'

// Shared button-triggered popover dropdown for the marketplace, styled to match
// the facilities Sort dropdown (FacilitiesToolbar): outline trigger, click-away
// backdrop, and check-marked emerald-accented options.
//
// options: Array<{ value: string, label: string }>
// value:   currently selected value
// onChange(value): selection handler
// icon:    optional leading lucide icon component for the trigger
// align:   'left' | 'right' (dropdown alignment). Defaults to 'left'.
export default function MarketDropdown({
  options, value, onChange, icon: Icon, align = 'left', className = '', menuWidth = 'w-52',
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)

  return (
    <div className={`relative ${className}`}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        className="h-10 w-full justify-between gap-2 font-medium"
      >
        <span className="inline-flex items-center gap-1.5 truncate">
          {Icon && <Icon className="h-4 w-4 text-emerald-600" />}
          <span className="truncate">{current?.label ?? 'Select'}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-400 transition ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-11 z-50 ${menuWidth} max-w-[min(90vw,16rem)] max-h-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg`}>
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-neutral-50 ${value === opt.value ? 'font-bold text-emerald-700' : 'text-neutral-800'}`}
              >
                {opt.label}
                {value === opt.value && <Check className="h-4 w-4 text-emerald-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
