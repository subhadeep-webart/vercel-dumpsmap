'use client'

import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'

export default function ProfileTypeCard({ pt, selected, isPrimary, onClick, onMakePrimary, showPrimary = true }) {
  const Icon = pt.icon
  return (
    <button
      onClick={onClick}
      className={`relative w-full rounded-xl border-2 p-3 text-left transition ${
        selected ? `${pt.color} shadow-sm` : 'border-neutral-200 bg-white hover:border-neutral-400'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">{Icon && <Icon className="h-5 w-5" />}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-bold text-neutral-900">{pt.title}</div>
            {selected && isPrimary && showPrimary && (
              <Badge className="bg-brand-600 text-[10px] text-white hover:bg-brand-600">Primary</Badge>
            )}
          </div>
          <div className="text-xs text-neutral-600">{pt.blurb}</div>
        </div>
        <div
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300'
          }`}
        >
          {selected && <Check className="h-3 w-3" />}
        </div>
      </div>
      {selected && showPrimary && !isPrimary && onMakePrimary && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onMakePrimary()
          }}
          className="mt-2 inline-flex cursor-pointer rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Make primary
        </div>
      )}
    </button>
  )
}
