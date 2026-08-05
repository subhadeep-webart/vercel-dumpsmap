'use client'

// GlobalFab
// ----------------------------------------------------------------------------
// Global radial Floating Action Button. Mounted in app/layout.js so it appears
// on every primary page (Facilities / Activity Hub / Marketplace / Jobs).
//
// Six quick actions per spec:
//   1. Update Facility       → opens facility picker → QuickCheckInModal
//   2. Post Job              → /jobs
//   3. Free Item             → Activity Hub composer with type=free_item
//   4. Donation Need         → Activity Hub composer with type=donation_need
//   5. Report Dumping        → Activity Hub composer with type=illegal_dumping
//   6. Post Community Update → Activity Hub composer with type=general
//
// Hidden on auth pages and inside iframes/admin shell.

import React, { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Plus, X, MapPin, Briefcase, Gift, HeartHandshake, AlertTriangle, MessageSquare } from 'lucide-react'
import QuickCheckInModal from '@/components/QuickCheckInModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

// Soft-tinted pills: near-white surface with a light wash of the action's hue,
// coloured text/icon, and a pale border. Keeps each action distinguishable
// without the saturated fills, and sits comfortably next to the brand blue
// (brand-600 #0B4DBA).
const ACTIONS = [
  { key: 'job',       label: 'Post Job',          icon: Briefcase,      tone: 'bg-sky-50 text-sky-700 ring-sky-200 hover:bg-sky-100',                    chip: 'bg-sky-100 text-sky-700' },
  { key: 'free',      label: 'Free Item',         icon: Gift,           tone: 'bg-pink-50 text-pink-700 ring-pink-200 hover:bg-pink-100',                chip: 'bg-pink-100 text-pink-700' },
   { key: 'facility',  label: 'Update Facility',   icon: MapPin,         tone: 'bg-brand-50 text-brand-700 ring-brand-200 hover:bg-brand-100',            chip: 'bg-brand-100 text-brand-700' },
  { key: 'donation',  label: 'Donation Need',     icon: HeartHandshake, tone: 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100',            chip: 'bg-amber-100 text-amber-700' },
  { key: 'dumping',   label: 'Report Dumping',    icon: AlertTriangle,  tone: 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100',                chip: 'bg-rose-100 text-rose-700' },
  { key: 'community', label: 'Community Update',  icon: MessageSquare,  tone: 'bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100',        chip: 'bg-violet-100 text-violet-700' },
]

export default function GlobalFab() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [checkinFacility, setCheckinFacility] = useState(null)

  // Hide on admin / auth / detail-only pages where the FAB would clutter.
  // Also hide on the Facilities Directory — the mobile card rebuild (July 2026)
  // provides contextual per-card "Check In" buttons that replace the FAB's role
  // there, and the FAB was previously covering card actions on narrow screens.
  const hide = useMemo(() => {
    if (!pathname) return true
    if (pathname.startsWith('/admin')) return true
    if (pathname.startsWith('/forgot-password')) return true
    if (pathname.startsWith('/profile/setup')) return true
    if (pathname === '/facilities' || pathname.startsWith('/facilities?')) return true
    return false
  }, [pathname])

  // Close menu on route change
  useEffect(() => { setOpen(false) }, [pathname])

  if (hide) return null

  const onAction = (key) => {
    setOpen(false)
    if (key === 'facility') { setPickerOpen(true); return }
    const typeMap = { job: 'job', free: 'free_item', donation: 'donation_need', dumping: 'illegal_dumping', community: 'general' }
    const t = typeMap[key]
    if (key === 'job') { router.push('/jobs'); return }
    router.push(`/activity-hub?compose=${t}`)
  }

  return (
    <>
      {/* Backdrop when open */}
      {open && <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-brand-navy/20 backdrop-blur-sm transition-opacity" />}

      {/* Action labels + buttons (vertical stack, anchored above the FAB) */}
      <div className={`fixed bottom-[8.5rem] right-4 z-50 flex flex-col-reverse items-end gap-3 sm:bottom-32 sm:right-6 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        {ACTIONS.map((a, idx) => {
          const Icon = a.icon
          return (
            // Collapsed to an icon-only circle; the label expands in on hover
            // (and on keyboard focus). The label is wrapped in a grid track that
            // animates 0fr → 1fr, which gives a smooth width transition without
            // hard-coding a pixel width per label.
            <button key={a.key} onClick={() => onAction(a.key)} title={a.label}
              style={{ transitionDelay: open ? `${idx * 45}ms` : `${(ACTIONS.length - idx) * 20}ms` }}
              className={`group relative flex items-center rounded-full p-1.5 text-sm font-bold tracking-tight shadow-md shadow-brand-navy/10 ring-1 transition-all duration-300 ease-out hover:-translate-x-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95 ${a.tone} ${open ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-6 scale-90 opacity-0'}`}>
              <span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-300 ease-out group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr]">
                <span className="overflow-hidden">
                  <span className="block whitespace-nowrap pl-3 pr-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">{a.label}</span>
                </span>
              </span>
              <span className={`flex h-6 w-6 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${a.chip}`}>
                <Icon className="w-4 h-4 md:h-[18px] md:w-[18px]" strokeWidth={2.25} />
              </span>
            </button>
          )
        })}
      </div>

      {/* Main FAB */}
      <button onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close quick actions' : 'Open quick actions'}
        className={`fixed bottom-20 right-4 z-50 flex h-9 w-9 md:h-12 md:w-12 items-center justify-center rounded-full shadow-lg ring-1 transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 active:scale-95 md:bottom-14 md:right-6 ${open ? 'rotate-[135deg] bg-neutral-100 text-neutral-600 ring-neutral-300 shadow-brand-navy/10' : 'bg-emerald-50 text-emerald-700 ring-emerald-200 shadow-emerald-600/20 hover:scale-110 hover:bg-emerald-100'}`}>
        {open ? <X className="h-5 w-5 md:h-7 md:w-7" strokeWidth={2.25} /> : <Plus className="h-5 w-5 md:h-7 md:w-7" strokeWidth={2.25} />}
      </button>

      <FacilityPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(f) => { setPickerOpen(false); setCheckinFacility(f) }} />
      <QuickCheckInModal open={!!checkinFacility} facility={checkinFacility} onClose={() => setCheckinFacility(null)} onSubmitted={() => setCheckinFacility(null)} />
    </>
  )
}

// Lightweight facility picker for the "Update Facility" action when the user
// is not already on a facility page.
function FacilityPicker({ open, onClose, onPick }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const url = `/api/facilities?limit=12${q ? `&search=${encodeURIComponent(q)}` : ''}`
        const r = await fetch(url)
        const j = await r.json()
        if (!cancelled) setList(j?.facilities || [])
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [open, q])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Pick a facility to update</DialogTitle></DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search facilities…" autoFocus />
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {loading ? <div className="py-6 text-center text-xs text-neutral-400">Loading…</div>
           : list.length === 0 ? <div className="py-6 text-center text-xs text-neutral-500">No facilities found.</div>
           : list.map((f) => (
              <button key={f.id} onClick={() => onPick(f)} className="w-full rounded-md p-2 text-left hover:bg-brand-50">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{f.name}</div>
                    <div className="truncate text-[11px] text-neutral-500">{[f.city, f.state].filter(Boolean).join(', ')}</div>
                  </div>
                </div>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
