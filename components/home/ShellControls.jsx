'use client'

// Small presentational controls for the HomeShell chrome:
//   • BottomNavBtn — a button in the mobile bottom nav bar
//   • PostRow      — a row in the "+ Post" action sheet
// Extracted from HomeShell.jsx.

import { ChevronRight } from 'lucide-react'

export function BottomNavBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[10px] font-semibold active:bg-neutral-100 ${
        active ? 'text-brand-700' : 'text-neutral-600'
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? 'text-brand-600' : 'text-neutral-500'}`} />
      {label}
    </button>
  )
}

export function PostRow({ icon: Icon, color, title, desc, onClick }) {
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
