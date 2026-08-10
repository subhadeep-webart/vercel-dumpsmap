'use client'

// /bounties — community-funded illegal-dumping cleanups
// ----------------------------------------------------------------------------
// Public browseable. Engagement CTAs (Contribute, Claim, Post) gated via
// SoftLoginModal. Reads from /api/bounties (created Sprint A foundation).
//
// Data reads live in hooks/use-bounties.js (SWR); mutations live in
// hooks/use-bounties-actions.js. Constants → constants/bounties_constants.js,
// pure helpers → lib/bounties-helpers.js. This file keeps only the view.
// ----------------------------------------------------------------------------

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SoftLoginModal } from '@/components/SoftLoginModal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CircleDollarSign, MapPin, Users, Plus, Loader2, Heart, CheckCircle2, AlertTriangle, ArrowRight, Trash2, Award } from 'lucide-react'
import { toast } from 'sonner'
import FeatureLock from '@/components/FeatureLock'
import { STATE_META, FILTERS, CONTRIBUTE_PRESETS, DEFAULT_CONTRIBUTION, EMPTY_BOUNTY_FORM } from '@/constants/bounties_constants'
import { fmtMoney, daysUntil } from '@/lib/bounties-helpers'
import { useBounties } from '@/hooks/use-bounties'
import { useBountiesActions } from '@/hooks/use-bounties-actions'

export default function BountiesPage() {
  return (
    <FeatureLock featureKey="bounties">
      <BountiesPageInner />
    </FeatureLock>
  )
}

function BountiesPageInner() {
  const router = useRouter()
  const { user, bounties, loading, reload } = useBounties()
  const actions = useBountiesActions({ onMutated: reload })
  const [filter, setFilter] = useState('all')
  const [contributeTarget, setContributeTarget] = useState(null)
  const [postOpen, setPostOpen] = useState(false)
  const [softLogin, setSoftLogin] = useState(null)

  const requireAuth = (action) => {
    if (user) return true
    setSoftLogin(action)
    return false
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return bounties.filter((b) => b.state !== 'draft' && b.state !== 'cancelled')
    return bounties.filter((b) => b.state === filter)
  }, [bounties, filter])

  const claim = async (bounty) => {
    if (!requireAuth('save')) return
    await actions.claim(bounty)
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-50">

      {/* Hero */}
      <section className="border-b border-neutral-200 bg-gradient-to-br from-brand-50 via-white to-amber-50/30">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">
                <AlertTriangle className="h-3 w-3" /> Community Action
              </div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Bounties</h1>
              <p className="mt-2 text-sm text-neutral-600 sm:text-base">
                Community-funded cleanups for illegal dumping sites and neglected infrastructure. Anyone can contribute. Verified contractors claim and clean. Everyone wins.
              </p>
            </div>
            <Button onClick={() => { if (requireAuth('post')) setPostOpen(true) }} className="gap-1.5 bg-brand-600 text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" /> Post a Bounty
            </Button>
          </div>

          {/* How it works strip */}
          <div className="mt-6 grid gap-2 sm:grid-cols-4">
            <Step n={1} title="Spot a Site" desc="Photo + location of an illegal dump or hot-spot." />
            <Step n={2} title="Community Funds" desc="Neighbors pitch in $1-1000 to fund the cleanup." />
            <Step n={3} title="Contractor Claims" desc="Verified hauler picks up once the goal is met." />
            <Step n={4} title="Verified & Paid" desc="Before/after photos verified; payout released." />
          </div>
        </div>
      </section>

      {/* Filter row */}
      <section className="sticky top-14 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="container mx-auto flex gap-2 overflow-x-auto px-4 py-3">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                filter === f.key ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}>
              {f.label}
              {f.key !== 'all' && <span className="ml-1 opacity-70">{bounties.filter((b) => b.state === f.key).length}</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Grid */}
      <main className="container mx-auto px-4 py-6 pb-24">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="h-48 animate-pulse bg-neutral-100" /></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onPost={() => { if (requireAuth('post')) setPostOpen(true) }} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b) => (
              <BountyCard
                key={b.id}
                bounty={b}
                user={user}
                onContribute={() => { if (requireAuth('save')) setContributeTarget(b) }}
                onClaim={() => claim(b)}
              />
            ))}
          </div>
        )}
      </main>

      <ContributeDialog
        bounty={contributeTarget}
        onClose={() => setContributeTarget(null)}
        onContributed={() => { setContributeTarget(null); reload() }}
      />
      <PostBountyDialog
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onCreated={() => { setPostOpen(false); reload(); router.refresh?.() }}
      />
      <SoftLoginModal action={softLogin} onClose={() => setSoftLogin(null)} />
    </div>
  )
}

// ============================================================================
// Bounty card
// ============================================================================
function BountyCard({ bounty, user, onContribute, onClaim }) {
  const meta = STATE_META[bounty.state] || STATE_META.draft
  const goal = Number(bounty.fundingGoalUsd) || 0
  const funded = Number(bounty.fundedUsd) || 0
  const pct = goal > 0 ? Math.min(100, (funded / goal) * 100) : 0
  const dleft = daysUntil(bounty.expiresAt)
  const city = bounty.location?.city || ''
  const state = bounty.location?.state || ''
  const canClaim = bounty.state === 'goal_reached' && user && !bounty.claimedContractorId
  const canContribute = ['funding', 'goal_reached'].includes(bounty.state)

  return (
    <Card className="overflow-hidden border-neutral-200 transition hover:border-brand-300 hover:shadow-md">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Badge className={`text-[10px] uppercase ${meta.tone}`}>{meta.label}</Badge>
          {dleft !== null && bounty.state === 'funding' && (
            <span className={`text-[11px] font-bold ${dleft <= 3 ? 'text-red-600' : 'text-neutral-500'}`}>
              {dleft}d left
            </span>
          )}
        </div>

        <div>
          <h3 className="line-clamp-2 text-base font-extrabold tracking-tight text-neutral-900">{bounty.title || 'Untitled bounty'}</h3>
          {bounty.description && <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{bounty.description}</p>}
        </div>

        {(city || state) && (
          <div className="flex items-center gap-1 text-xs text-neutral-600">
            <MapPin className="h-3 w-3" /> {[city, state].filter(Boolean).join(', ')}
          </div>
        )}

        {/* Funding bar */}
        {goal > 0 && (
          <div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-bold text-neutral-900">{fmtMoney(funded)}</span>
              <span className="text-neutral-500">of {fmtMoney(goal)} goal</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200">
              <div className={`h-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {(bounty.contributors || []).length} contributors</span>
          {bounty.requiredVerification && (
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {bounty.requiredVerification}+ contractor</span>
          )}
        </div>

        {/* CTAs */}
        <div className="flex gap-2 pt-1">
          {canContribute && (
            <Button onClick={onContribute} className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700">
              <Heart className="h-3.5 w-3.5" /> Contribute
            </Button>
          )}
          {canClaim && (
            <Button onClick={onClaim} className="flex-1 gap-1 bg-brand-600 hover:bg-brand-700">
              <Award className="h-3.5 w-3.5" /> Claim
            </Button>
          )}
          {!canContribute && !canClaim && (
            <Button variant="outline" className="flex-1 gap-1" disabled>
              {bounty.state === 'verified' ? 'Completed' : bounty.state === 'in_progress' ? 'Work in Progress' : 'View'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Step pill
// ============================================================================
function Step({ n, title, desc }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">{n}</span>
      <div>
        <div className="text-sm font-bold text-neutral-900">{title}</div>
        <div className="text-[11px] text-neutral-500">{desc}</div>
      </div>
    </div>
  )
}

// ============================================================================
// Empty state
// ============================================================================
function EmptyState({ onPost }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="rounded-full bg-amber-100 p-3"><Trash2 className="h-6 w-6 text-amber-700" /></div>
        <div>
          <div className="text-lg font-extrabold tracking-tight">No bounties in this filter</div>
          <div className="mt-1 text-sm text-neutral-500">Be the first to flag a site that needs community cleanup.</div>
        </div>
        <Button onClick={onPost} className="gap-1 bg-brand-600 hover:bg-brand-700"><Plus className="h-4 w-4" /> Post a Bounty</Button>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Contribute dialog
// ============================================================================
function ContributeDialog({ bounty, onClose, onContributed }) {
  const [amount, setAmount] = useState(DEFAULT_CONTRIBUTION)
  const [note, setNote] = useState('')
  const { busy, contribute } = useBountiesActions()
  useEffect(() => { if (bounty) { setAmount(DEFAULT_CONTRIBUTION); setNote('') } }, [bounty])
  if (!bounty) return null

  const remaining = Math.max(0, (bounty.fundingGoalUsd || 0) - (bounty.fundedUsd || 0))
  const presets = CONTRIBUTE_PRESETS
  const submit = async () => {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) { toast.error('Enter a positive amount'); return }
    const ok = await contribute(bounty.id, { amountUsd: n, note })
    if (ok) onContributed()
  }
  return (
    <Dialog open={!!bounty} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Heart className="h-4 w-4 text-emerald-600" /> Contribute to bounty</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
            <div className="font-bold text-neutral-900">{bounty.title}</div>
            <div className="mt-1 text-xs text-neutral-600">
              {fmtMoney(bounty.fundedUsd || 0)} of {fmtMoney(bounty.fundingGoalUsd || 0)} raised · {fmtMoney(remaining)} to go
            </div>
          </div>
          <div>
            <Label className="text-xs">Quick amounts</Label>
            <div className="mt-1 flex gap-2">
              {presets.map((p) => (
                <button key={p} type="button" onClick={() => setAmount(p)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-bold transition ${amount == p ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'}`}>
                  ${p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Custom amount (USD)</Label>
            <Input type="number" min={1} max={100000} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this matters to you" />
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
            <strong>Note:</strong> Payments are not yet processed (Stripe pending). Your pledge is recorded and you&apos;ll be notified when the contractor is matched.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Heart className="mr-1 h-4 w-4" /> Pledge ${amount}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Post bounty dialog
// ============================================================================
function PostBountyDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_BOUNTY_FORM)
  const { busy, createBounty } = useBountiesActions()
  useEffect(() => { if (!open) setForm(EMPTY_BOUNTY_FORM) }, [open])
  const submit = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error('Title and description are required'); return }
    const ok = await createBounty({
      title: form.title.trim(),
      description: form.description.trim(),
      location: { city: form.city, state: form.state },
      fundingGoalUsd: Number(form.fundingGoalUsd) || 0,
    })
    if (ok) onCreated()
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Post a bounty</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Site title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mattress dump at 4th & Park" /></div>
          <div><Label className="text-xs">Description *</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's there, why it matters, access notes…" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label className="text-xs">State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} /></div>
          </div>
          <div>
            <Label className="text-xs">Funding goal (USD)</Label>
            <Input type="number" min={50} max={50000} step={50} value={form.fundingGoalUsd} onChange={(e) => setForm({ ...form, fundingGoalUsd: e.target.value })} />
            <p className="mt-1 text-[11px] text-neutral-500">Estimate of disposal + hauler fees. Community will fund up to this amount.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-brand-600 hover:bg-brand-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Post bounty <ArrowRight className="ml-1 h-4 w-4" /></>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
