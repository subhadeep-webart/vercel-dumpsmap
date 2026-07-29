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
import { Loader2, Camera, AlertTriangle, CircleDollarSign, Lock, X, MapPin, Check } from 'lucide-react'
import { toast } from 'sonner'
import MediaUploader from '@/components/MediaUploader'
import { SoftLoginModal } from '@/components/SoftLoginModal'
import { getAuthToken } from '@/lib/api-client'

const authHeaders = () => {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// Wait-time pills → backend signal + display label
// `ring`  — status color used for the selected pill's ring AND the white tick's
//           border (so the checkmark badge reads as part of the same status).
// `check` — matching color for the checkmark glyph inside that white badge.
const WAIT_LEVELS = [
  { key: 'not_busy',  label: 'No Wait',    sub: '0–5 min',   tone: 'bg-emerald-500',                  ring: 'ring-emerald-500', check: 'text-emerald-600' },
  { key: 'slow',      label: 'Light',      sub: '5–15 min',  tone: 'bg-yellow-400 text-neutral-900',  ring: 'ring-yellow-400',  check: 'text-yellow-500' },
  { key: 'busy',      label: 'Moderate',   sub: '15–30 min', tone: 'bg-orange-500',                   ring: 'ring-orange-500',  check: 'text-orange-600' },
  { key: 'long_wait', label: 'Heavy',      sub: '30–60 min', tone: 'bg-red-500',                      ring: 'ring-red-500',     check: 'text-red-600' },
  { key: 'very_busy', label: 'Very Heavy', sub: '60+ min',   tone: 'bg-red-700',                      ring: 'ring-red-700',     check: 'text-red-700' },
]

// Optional issue flags. Each posts an extra facility_update with its own signal.
const ISSUE_FLAGS = [
  { key: 'scale_issue',   label: 'Scale Closed',         icon: AlertTriangle },
  { key: 'gate_closed',   label: 'Gate Closed',          icon: Lock },
  { key: 'price_update',  label: 'Price Update',         icon: CircleDollarSign },
  { key: 'not_accepting', label: 'Material Restriction', icon: X },
]

export default function QuickCheckInModal({ open, onClose, facility, onSubmitted, onRequireLogin }) {
  const [signal, setSignal] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [note, setNote] = useState('')
  const [flags, setFlags] = useState({})
  const [busy, setBusy] = useState(false)
  // When a logged-out user opens the check-in, we surface the sign-in prompt
  // up-front instead of letting them fill the whole form and get rejected at
  // submit. `softLogin` holds the SoftLoginModal action key while it's shown.
  const [softLogin, setSoftLogin] = useState(null)

  // Gate on auth the moment the modal is asked to open. No token = guaranteed
  // logged-out (the token is set synchronously on login), so we can decide
  // without waiting on /api/auth/me — no async race, no flash of the form.
  const needsAuth = open && !getAuthToken()

  useEffect(() => {
    if (!open) return
    if (needsAuth) {
      // Don't show the form; ask them to sign in first, then close the shell.
      setSoftLogin('check-in')
      onClose?.()
      return
    }
    setSignal(null); setPhoto(null); setNote(''); setFlags({})
  }, [open, needsAuth])

  // Sign-in handlers: when the host page supplies `onRequireLogin`, open its
  // in-place AuthDialog instead of navigating to the homepage (`?login=1`),
  // which would otherwise bounce the user off the facilities page mid-flow.
  const loginProps = onRequireLogin
    ? { onSignIn: () => onRequireLogin('login'), onCreateAccount: () => onRequireLogin('signup') }
    : {}

  if (!facility) {
    return <SoftLoginModal action={softLogin} onClose={() => setSoftLogin(null)} {...loginProps} />
  }

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
    <>
    <Dialog open={open && !needsAuth} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-2xl p-0">
        {/* Header — fixed */}
        <DialogHeader className="shrink-0 border-b border-neutral-100 bg-gradient-to-b from-brand-50 to-white px-6 pb-4 pt-6">
          <DialogTitle className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600/10">
              <MapPin className="h-5 w-5 text-brand-600" />
            </div>
            <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-700">Quick Check-In</div>
            <div className="mt-1 text-lg font-extrabold leading-tight tracking-tight text-neutral-900">{facility.name}</div>
          </DialogTitle>
        </DialogHeader>

        {/* Body — the ONLY scrollable region */}
        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <div className="mb-2.5 text-center text-sm font-semibold text-neutral-800">What&apos;s the current wait time?</div>
            <div className="grid grid-cols-5 gap-2.5">
              {WAIT_LEVELS.map((w) => {
                const active = signal === w.key
                return (
                  <button key={w.key} type="button" onClick={() => setSignal(w.key)}
                    className={`relative flex flex-col items-center justify-center rounded-xl px-1 py-2.5 text-center text-white transition-all duration-200 ease-out ${w.tone} ${active ? 'scale-105 shadow-lg ring-2 ring-inset ring-white/80' : 'opacity-80 hover:scale-105 hover:opacity-100'}`}>
                    {active && (
                      <span className={`dm-tick-pop absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow ring-2 ${w.ring}`}>
                        <Check className={`h-2.5 w-2.5 ${w.check || 'text-neutral-900'}`} strokeWidth={3} />
                      </span>
                    )}
                    <div className="text-[11px] font-extrabold leading-tight">{w.label}</div>
                    <div className="mt-0.5 text-[9px] font-medium leading-tight opacity-90">{w.sub}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Any issues? <span className="font-normal normal-case">(optional)</span></div>
            <div className="grid grid-cols-2 gap-2">
              {ISSUE_FLAGS.map((f) => {
                const Icon = f.icon
                const active = flags[f.key]
                return (
                  <button key={f.key} type="button" onClick={() => setFlags((s) => ({ ...s, [f.key]: !s[f.key] }))}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${active ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-sm' : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'}`}>
                    <Icon className="h-3.5 w-3.5 shrink-0" /> {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Add a quick note <span className="font-normal normal-case">(optional)</span></div>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Scale moving slowly, copper line backed up…" />
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Add a photo <span className="font-normal normal-case">(optional)</span></div>
            <MediaUploader value={photo} onChange={setPhoto} accept="image/*" variant="card" label="Snap a quick photo" />
          </div>
        </div>

        {/* Footer — fixed */}
        <div className="shrink-0 border-t border-neutral-100 bg-white px-6 pb-5 pt-4">
          <Button onClick={submit} disabled={busy || !signal} className="w-full bg-brand-600 py-6 text-base font-extrabold shadow-md transition hover:bg-brand-700 disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Submit Check-In'}
          </Button>
          <div className="mt-2 text-center text-[11px] font-medium text-neutral-400">Earns you +25 reward points</div>
        </div>
      </DialogContent>
    </Dialog>
    <SoftLoginModal action={softLogin} onClose={() => setSoftLogin(null)} {...loginProps} />
    </>
  )
}
