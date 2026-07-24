'use client'

import { ChevronRight } from 'lucide-react'

// Tiny inline helper for the FAB sheet rows
export default function PostOptionRow({ icon: Icon, color, title, desc, onClick }) {
  return (
    <button onClick={onClick} className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 text-left active:bg-neutral-50">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-neutral-600">{desc}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
    </button>
  )
}
