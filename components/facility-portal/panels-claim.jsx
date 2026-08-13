'use client'

// ClaimFacilityPanel — the resident-facing "Claim Your Facility" flow, per the
// client's answers (docs/FACILITY_PORTAL_DEV.md §6 Q4).
//
// Three states, in order of precedence:
//   1. A claim is already under review  → show its status, don't re-offer the form
//   2. A facility is selected           → ownership details + terms + submit
//   3. Nothing selected                 → intro + facility search
//
// Submitting posts to the existing /api/facility-claims pipeline (admin review →
// approval grants ownedFacilities). No new backend.

import { useState } from 'react'
import Link from 'next/link'
import {
  KeyRound, Search, Loader2, MapPin, ShieldCheck, Clock, CircleAlert, ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import PortalCard from './PortalCard'
import { useFacilityClaim } from '@/hooks/use-facility-claim'
import { PORTAL_COPY } from '@/constants/facility_portal_constants'

const CLAIM_STATUS_TONE = {
  pending:          { label: 'Under review',      className: 'bg-amber-50 text-amber-800 ring-amber-200', Icon: Clock },
  needs_more_info:  { label: 'More info needed',  className: 'bg-amber-50 text-amber-800 ring-amber-200', Icon: CircleAlert },
  rejected:         { label: 'Not approved',      className: 'bg-red-50 text-red-700 ring-red-200',       Icon: CircleAlert },
  approved:         { label: 'Approved',          className: 'bg-green-50 text-green-700 ring-green-200', Icon: ShieldCheck },
}

function facilityLine(f) {
  return f.address || [f.city, f.state, f.zip].filter(Boolean).join(', ')
}

// ── Claim under review ────────────────────────────────────────────────────────
function PendingClaim({ claim }) {
  const tone = CLAIM_STATUS_TONE[claim.status] || CLAIM_STATUS_TONE.pending
  const { title, body } = PORTAL_COPY.claimPending
  return (
    <PortalCard id="claim" title="Claim Your Facility">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone.className}`}>
            <tone.Icon className="h-3.5 w-3.5" /> {tone.label}
          </span>
          <span className="text-sm font-bold text-neutral-900">{claim.facilityName}</span>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
          <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">{body}</p>
        </div>
        {claim.adminNote && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <h3 className="text-sm font-bold text-amber-900">Note from our team</h3>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">{claim.adminNote}</p>
          </div>
        )}
      </div>
    </PortalCard>
  )
}

// ── Ownership details + terms ─────────────────────────────────────────────────
function ClaimForm({ facility, onBack, submitting, onSubmit }) {
  const [form, setForm] = useState({
    claimantName: '', businessRole: '', businessEmail: '',
    phone: '', website: '', proofNotes: '',
  })
  const [accepted, setAccepted] = useState(false)
  const upd = (k, v) => setForm((s) => ({ ...s, [k]: v }))

  const canSubmit = !!form.claimantName.trim() && !!form.businessEmail.trim() && accepted && !submitting

  const submit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit(form)
  }

  return (
    <PortalCard id="claim" title="Claim Your Facility">
      <form onSubmit={submit} className="space-y-5">
        {/* Which facility */}
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <KeyRound className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-neutral-900">{facility.name}</div>
            {facilityLine(facility) && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-neutral-600">
                <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{facilityLine(facility)}</span>
              </div>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onBack} className="shrink-0 gap-1 text-neutral-600">
            <ArrowLeft className="h-3.5 w-3.5" /> Change
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="claim-name">Your name *</Label>
            <Input id="claim-name" value={form.claimantName} onChange={(e) => upd('claimantName', e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <Label htmlFor="claim-role">Your role / title</Label>
            <Input id="claim-role" value={form.businessRole} onChange={(e) => upd('businessRole', e.target.value)} placeholder="Owner / Manager / GM" />
          </div>
          <div>
            <Label htmlFor="claim-email">Business email *</Label>
            <Input id="claim-email" type="email" value={form.businessEmail} onChange={(e) => upd('businessEmail', e.target.value)} placeholder="you@facility.com" />
          </div>
          <div>
            <Label htmlFor="claim-phone">Business phone</Label>
            <Input id="claim-phone" value={form.phone} onChange={(e) => upd('phone', e.target.value)} placeholder="(555) 555-5555" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="claim-website">Website</Label>
            <Input id="claim-website" value={form.website} onChange={(e) => upd('website', e.target.value)} placeholder="https://…" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="claim-proof">How can we verify you own this facility?</Label>
            <Textarea
              id="claim-proof" rows={3} value={form.proofNotes}
              onChange={(e) => upd('proofNotes', e.target.value)}
              placeholder="Business license #, a domain-matching email, your listing on Google, etc."
            />
          </div>
        </div>

        {/* Terms — Q4: the claimant accepts responsibility for the facility's data */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
          <h3 className="text-sm font-bold text-neutral-900">Before you claim</h3>
          <ul className="mt-2 space-y-1.5">
            {PORTAL_COPY.claimTerms.map((t) => (
              <li key={t} className="flex gap-2 text-xs leading-relaxed text-neutral-600">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-400" />
                {t}
              </li>
            ))}
          </ul>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 border-t border-neutral-200 pt-3">
            <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
            <span className="text-xs font-medium leading-relaxed text-neutral-700">
              I confirm the above and accept responsibility for keeping this facility&apos;s information accurate.
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={!canSubmit} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Submitting…' : 'Submit claim request'}
          </Button>
          <span className="text-xs text-neutral-500">We&apos;ll reply within 1–2 business days.</span>
        </div>
      </form>
    </PortalCard>
  )
}

// ── Intro + search ────────────────────────────────────────────────────────────
function ClaimSearch({ claim }) {
  const { icon: Icon, title, body } = PORTAL_COPY.noFacility
  const { query, setQuery, results, searching, hasQuery, setSelected } = claim

  return (
    <PortalCard id="claim" title="Claim Your Facility">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold tracking-tight text-neutral-900">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">{body}</p>
          </div>
        </div>

        <div>
          <Label htmlFor="claim-search">Find your facility</Label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              id="claim-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by facility name or city…"
              className="pl-9"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400" />}
          </div>
        </div>

        {hasQuery && !searching && results.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center">
            <p className="text-sm text-neutral-600">No facilities matched that search.</p>
            <p className="mt-1 text-xs text-neutral-500">
              Not listed yet?{' '}
              <Link href="/facilities" className="font-semibold text-emerald-700 hover:underline">
                Browse the directory
              </Link>{' '}
              or contact support to add it.
            </p>
          </div>
        )}

        {results.length > 0 && (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
            {results.map((f) => {
              const claimed = !!f.claimedByUserId || !!f.claimed
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    disabled={claimed}
                    onClick={() => setSelected(f)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors enabled:hover:bg-emerald-50/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-neutral-900">{f.name}</div>
                      {facilityLine(f) && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                          <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{facilityLine(f)}</span>
                        </div>
                      )}
                    </div>
                    {claimed ? (
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500 ring-1 ring-neutral-200">
                        Already claimed
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-emerald-700">Claim →</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PortalCard>
  )
}

export default function ClaimFacilityPanel({ pendingClaim, onClaimed }) {
  const claim = useFacilityClaim({ onClaimed })

  // Hooks run unconditionally above; branch only on render (hook-order rule).
  if (pendingClaim) return <PendingClaim claim={pendingClaim} />
  if (claim.selected) {
    return (
      <ClaimForm
        facility={claim.selected}
        onBack={() => claim.setSelected(null)}
        submitting={claim.submitting}
        onSubmit={claim.submitClaim}
      />
    )
  }
  return <ClaimSearch claim={claim} />
}
