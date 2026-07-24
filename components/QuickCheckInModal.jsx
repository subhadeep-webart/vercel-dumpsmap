'use client'

// QuickCheckInModal
// ----------------------------------------------------------------------------
// Waze-style 5-second facility check-in. Used from:
//   - Facility cards ("Check In" CTA)
//   - Facility detail page
//   - Global FAB ("Update Facility")
//
// Submits a community_posts entry with type='facility_update' + a
// facilityLiveSignal. The backend auto-mirrors the signal onto the facility's
// liveStatus so cards/list/map pick it up instantly.
//
// Success metric: from open → submit should be ≤ 15 seconds.

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Camera, AlertTriangle, DollarSign, Lock, X } from 'lucide-react'
import { toast } from 'sonner'
import MediaUploader from '@/components/MediaUploader'

const authHeaders = () => {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// Wait-time pills → backend signal + display label
const WAIT_LEVELS = [
  { key: 'not_busy',  label: 'No Wait',    sub: '0–5 min',   tone: 'bg-emerald-500',    ring: 'ring-emerald-500' },
  { key: 'slow',      label: 'Light',      sub: '5–15 min',  tone: 'bg-yellow-400 text-neutral-900',  ring: 'ring-yellow-400' },
  { key: 'busy',      label: 'Moderate',   sub: '15–30 min', tone: 'bg-orange-500',    ring: 'ring-orange-500' },
  { key: 'long_wait', label: 'Heavy',      sub: '30–60 min', tone: 'bg-red-500',       ring: 'ring-red-500' },
  { key: 'very_busy', label: 'Very Heavy', sub: '60+ min',   tone: 'bg-red-700',       ring: 'ring-red-700' },
]

// Optional issue flags. Each posts an extra facility_update with its own signal.
const ISSUE_FLAGS = [
  { key: 'scale_issue',   label: 'Scale Closed',         icon: AlertTriangle },
  { key: 'gate_closed',   label: 'Gate Closed',          icon: Lock },
  { key: 'price_update',  label: 'Price Update',         icon: DollarSign },
  { key: 'not_accepting', label: 'Material Restriction', icon: X },
]

export default function QuickCheckInModal({ open, onClose, facility, onSubmitted }) {
  const [signal, setSignal] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [note, setNote] = useState('')
  const [flags, setFlags] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setSignal(null); setPhoto(null); setNote(''); setFlags({}) }
  }, [open])

  if (!facility) return null

  const submit = async () => {
    if (!signal) { toast.error('Tap a wait time first'); return }
    setBusy(true)
    try {
      const level = WAIT_LEVELS.find((w) => w.key === signal)
      // Main wait-time check-in
      const body = {
        type: 'facility_update',
        title: `${level.label} wait at ${facility.name}`,
        body: note || `${level.label} · ${level.sub}`,
        facilityId: facility.id,
        facilityLiveSignal: signal,
        photos: photo ? [photo] : [],
        city: facility.city || '',
        state: facility.state || '',
      }
      const r = await fetch('/api/activity-hub/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        if (r.status === 401) toast.error('Sign in to check in')
        else toast.error(j.error || 'Could not submit')
        return
      }
      // Fire-and-forget secondary flag posts (don't block UI)
      const flagSignals = Object.entries(flags).filter(([, v]) => v).map(([k]) => k)
      for (const fsig of flagSignals) {
        fetch('/api/activity-hub/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            type: 'facility_update',
            title: `${ISSUE_FLAGS.find((f) => f.key === fsig)?.label || 'Issue'} at ${facility.name}`,
            body: note || '',
            facilityId: facility.id,
            facilityLiveSignal: fsig,
          }),
        }).catch(() => {})
      }
      toast.success('Check-in submitted — thank you! +25 pts')
      onSubmitted?.()
      onClose?.()
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-700">Quick Check-In</div>
            <div className="mt-1 text-lg font-extrabold tracking-tight">{facility.name}</div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="mb-2 text-center text-sm font-semibold text-neutral-700">What&apos;s the current wait time?</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {WAIT_LEVELS.map((w) => (
                <button key={w.key} type="button" onClick={() => setSignal(w.key)}
                  className={`rounded-lg p-2 text-center text-white shadow transition ${w.tone} ${signal === w.key ? `scale-105 ring-4 ring-offset-2 ${w.ring}` : 'opacity-90 hover:opacity-100'}`}>
                  <div className="text-xs font-extrabold leading-tight">{w.label}</div>
                  <div className="mt-0.5 text-[10px] opacity-90">{w.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-neutral-700">Any issues? (optional)</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ISSUE_FLAGS.map((f) => {
                const Icon = f.icon
                const active = flags[f.key]
                return (
                  <button key={f.key} type="button" onClick={() => setFlags((s) => ({ ...s, [f.key]: !s[f.key] }))}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-semibold transition ${active ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}>
                    <Icon className="h-3.5 w-3.5" /> {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-neutral-700">Add a quick note (optional)</div>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Scale moving slowly, copper line backed up…" />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-neutral-700">Add a photo (optional)</div>
            <MediaUploader value={photo} onChange={setPhoto} accept="image/*" variant="card" label="Snap a quick photo" />
          </div>

          <Button onClick={submit} disabled={busy || !signal} className="w-full bg-brand-600 py-6 text-base font-extrabold hover:bg-brand-700">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Submit Check-In'}
          </Button>
          <div className="text-center text-[10px] text-neutral-400">Earns you +25 reward points</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
