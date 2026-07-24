'use client'

import React from 'react'
import { Smartphone, Layers } from 'lucide-react'
import { useViewMode } from '@/lib/view-mode'

export default function ViewModeToggle({ className = '', compact = false }) {
  const { viewMode, setViewMode } = useViewMode()
  const next = viewMode === 'field' ? 'standard' : 'field'
  const Icon = next === 'field' ? Smartphone : Layers
  const label = next === 'field' ? 'Field Mode' : 'Standard Mode'
  return (
    <button
      onClick={() => setViewMode(next)}
      className={`inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 ${className}`}
      title={`Switch to ${label}`}
    >
      <Icon className="h-3 w-3 text-brand-600" />
      {!compact && <span>{label}</span>}
    </button>
  )
}
