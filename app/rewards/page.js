'use client'

// /rewards — public landing + authenticated rewards dashboard
// ----------------------------------------------------------------------------
// Public (logged-out): shows program overview, how earning works, redemption
// tiers, FAQ. CTA → Soft-login modal.
// Authenticated: shows balance card, recent history, redemption tiers
// (Redeem → opens dialog), redemption status timeline.
// ----------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { SoftLoginModal } from '@/components/SoftLoginModal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Award, Coins, TrendingUp, MapPin, Receipt, Users, Recycle, ArrowRight,
  Gift, ChevronRight, Loader2, AlertCircle, History, CheckCircle2, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import RouteFeatureLock from '@/components/RouteFeatureLock'

const authHeaders = () => {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}
const fmtPts = (n) => Number(n || 0).toLocaleString()
const fmtDollars = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`

const EARN_TILES = [
  { icon: MapPin,  label: 'Facility check-in',      pts: 25, hint: 'When you visit a partner site' },
  { icon: Receipt, label: 'Verified receipt',       pts: 50, hint: 'Drop-off / disposal proof' },
  { icon: Recycle, label: 'E-waste / donation',     pts: 75, hint: 'Bonus for high-impact items' },
  { icon: Award,   label: 'First visit bonus',      pts: 100, hint: 'Once per facility' },
  { icon: Users,   label: 'Community post',         pts: 10, hint: 'Wait times, hot spots, tips' },
  { icon: Users,   label: 'Referral',               pts: 250, hint: 'Friends join and check in' },
]

const REDEMPTION_TIERS = [
  { points: 1000, dollars: 10,  blurb: 'Coffee on us' },
  { points: 2500, dollars: 25,  blurb: 'Fill the tank' },
  { points: 5000, dollars: 50,  blurb: 'Family dinner' },
  { points: 10000, dollars: 100, blurb: 'Pro reward' },
]

const STATUS_META = {
  pending:    { tone: 'bg-amber-100 text-amber-800', icon: Loader2, label: 'Pending review' },
  processing: { tone: 'bg-blue-100 text-blue-800',   icon: Loader2, label: 'Processing payout' },
  paid:       { tone: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2, label: 'Paid' },
  rejected:   { tone: 'bg-red-100 text-red-800',     icon: XCircle, label: 'Rejected' },
  cancelled:  { tone: 'bg-neutral-200 text-neutral-700', icon: XCircle, label: 'Cancelled' },
}

export default function RewardsPage() {
  return (
    <RouteFeatureLock featureKey="rewardsEngine">
      <RewardsPageInner />
    </RouteFeatureLock>
  )
}

function RewardsPageInner() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [balance, setBalance] = useState(null)
  const [history, setHistory] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [settings, setSettings] = useState(null)
  const [redeemOpen, setRedeemOpen] = useState(null) // { points, dollars }
  const [softLogin, setSoftLogin] = useState(null)

  const loadAll = useCallback(async () => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!t) { setBootstrapping(false); return }
    try {
      const headers = { Authorization: `Bearer ${t}` }
      const [meR, balR, histR, redR] = await Promise.all([
        fetch('/api/auth/me', { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/users/me/rewards/balance', { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/users/me/rewards/history?limit=20', { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/users/me/rewards/redemptions', { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
      ])
      setUser(meR?.user || null)
      setBalance(balR || null)
      setHistory(histR?.entries || [])
      setRedemptions(redR?.redemptions || [])
    } finally { setBootstrapping(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const requireAuth = (action) => {
    if (user) return true
    setSoftLogin(action)
    return false
  }
  const onRedeem = (tier) => {
    if (!requireAuth('save')) return
    setRedeemOpen(tier)
  }

  const isAuthed = !!user

  return (
    <div className="min-h-[100dvh] bg-neutral-50">
      <AppHeader active="rewards" />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-neutral-200 bg-gradient-to-br from-emerald-50 via-brand-50 to-amber-50/40">
        <div className="container mx-auto px-4 py-10 sm:py-14">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                <Award className="h-3 w-3" /> DumpMaps Rewards
              </div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">Get paid to clean up.</h1>
              <p className="mt-3 max-w-xl text-sm text-neutral-700 sm:text-base">
                Earn points every time you check in at a facility, upload a receipt, or contribute to the community. Cash out the moment you hit $10.
              </p>
              {isAuthed && balance ? (
                <BalanceCard balance={balance} />
              ) : (
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button onClick={() => requireAuth('save')} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                    <Coins className="h-4 w-4" /> Start earning
                  </Button>
                  <Button variant="outline" onClick={() => router.push('/facilities')} className="gap-1.5">
                    Find a facility <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Right column: visual stats card */}
            <div className="hidden lg:block">
              <Card className="border-emerald-200 bg-white/80 shadow-xl backdrop-blur">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Live stats · last 30 days</div>
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <StatTile value="$8,420" label="paid to members" />
                    <StatTile value="12,843" label="check-ins" />
                    <StatTile value="2,107" label="receipts verified" />
                    <StatTile value="328" label="bounties claimed" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8 pb-24">
        {/* AUTHENTICATED VIEW EXTRAS */}
        {isAuthed && (
          <>
            {redemptions.length > 0 && (
              <section className="mb-8">
                <SectionHeader title="Your redemptions" icon={History} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {redemptions.slice(0, 4).map((r) => <RedemptionRow key={r.id} r={r} />)}
                </div>
              </section>
            )}

            {history.length > 0 && (
              <section className="mb-8">
                <SectionHeader title="Recent points activity" icon={History} />
                <Card>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-neutral-100">
                      {history.slice(0, 8).map((h) => (
                        <li key={h.id} className="flex items-center justify-between p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-extrabold ${h.points >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {h.points >= 0 ? '+' : ''}{h.points}
                            </span>
                            <div>
                              <div className="font-medium text-neutral-900">{labelForSource(h.source)}</div>
                              <div className="text-[11px] text-neutral-500">{new Date(h.createdAt).toLocaleString()}</div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{h.status || 'posted'}</Badge>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            )}
          </>
        )}

        {/* Redemption tiers */}
        <section className="mb-8">
          <SectionHeader title="Cash out tiers" icon={Gift} subtitle="Pick a tier and we'll process your payout in 1-3 business days." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REDEMPTION_TIERS.map((t) => {
              const affordable = (balance?.balance || 0) >= t.points
              return (
                <Card key={t.points} className={`relative overflow-hidden transition ${affordable ? 'border-emerald-300 hover:shadow-md' : 'border-neutral-200'}`}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">${t.dollars}</span>
                      <span className="text-[11px] text-neutral-500">{t.blurb}</span>
                    </div>
                    <div className="text-3xl font-extrabold tracking-tight text-neutral-900">{fmtPts(t.points)}<span className="ml-1 text-sm font-medium text-neutral-500">pts</span></div>
                    <Button onClick={() => onRedeem(t)} disabled={isAuthed && !affordable} className={`w-full gap-1 ${affordable || !isAuthed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-neutral-200 text-neutral-500'}`}>
                      {!isAuthed ? 'Sign in to redeem' : affordable ? <>Redeem <ArrowRight className="h-3.5 w-3.5" /></> : `Need ${fmtPts(t.points - (balance?.balance || 0))} more`}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* How to earn */}
        <section className="mb-8">
          <SectionHeader title="How to earn" icon={Coins} subtitle="Points post within seconds. Every action is logged in your activity history." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EARN_TILES.map((t) => {
              const Icon = t.icon
              return (
                <Card key={t.label} className="border-neutral-200 transition hover:border-emerald-200">
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="rounded-md bg-emerald-100 p-2 text-emerald-700"><Icon className="h-5 w-5" /></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-neutral-900">{t.label}</div>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">+{t.pts}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-neutral-500">{t.hint}</div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* CTAs */}
        {!isAuthed && !bootstrapping && (
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="rounded-full bg-emerald-600 p-3 text-white"><Award className="h-6 w-6" /></div>
              <h3 className="text-xl font-extrabold tracking-tight">Ready to start earning?</h3>
              <p className="max-w-md text-sm text-neutral-600">Free to join. No credit card. You only need a verified phone number to cash out.</p>
              <Button onClick={() => requireAuth('save')} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                Create your account <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* FAQ */}
        <section className="mt-12">
          <SectionHeader title="FAQ" />
          <div className="grid gap-3 lg:grid-cols-2">
            <Faq q="How do I get paid?" a="Once you redeem points, we'll process the payout to your saved cash-out method (Venmo, Cash App, mailed check, or facility credit) within 1-3 business days." />
            <Faq q="Do points expire?" a="No — your points never expire as long as your account is active." />
            <Faq q="Which facilities count?" a="Any DumpMaps Partner facility. Look for the green Rewards badge on the facility page." />
            <Faq q="Is this taxable?" a="Cumulative payouts over $600 in a calendar year may trigger 1099 reporting. We'll send you the necessary forms." />
          </div>
        </section>
      </main>

      <RedeemDialog
        open={!!redeemOpen}
        tier={redeemOpen}
        balance={balance?.balance || 0}
        onClose={() => setRedeemOpen(null)}
        onRedeemed={() => { setRedeemOpen(null); loadAll() }}
      />
      <SoftLoginModal action={softLogin} onClose={() => setSoftLogin(null)} />
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================
function BalanceCard({ balance }) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <Card className="border-emerald-300 bg-white shadow-md sm:col-span-2">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Available balance</div>
            <div className="mt-1 text-4xl font-extrabold tracking-tight text-neutral-900">{fmtPts(balance.balance)}<span className="ml-1 text-base font-medium text-neutral-500">pts</span></div>
            <div className="mt-1 text-sm text-neutral-500">≈ {fmtDollars(balance.balance)} cash out value</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-neutral-500">Lifetime</div>
            <div className="text-lg font-bold text-neutral-700">{fmtPts(balance.lifetimeEarned || 0)} earned</div>
            <div className="text-[11px] text-neutral-500">{fmtPts(balance.lifetimeRedeemed || 0)} redeemed</div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="space-y-1 p-4 text-sm">
          <div className="font-bold text-amber-800">Next milestone</div>
          {balance.balance < 1000 ? (
            <>
              <div className="font-mono text-xs text-amber-700">{fmtPts(1000 - balance.balance)} more pts</div>
              <div className="text-[11px] text-amber-700/80">to unlock your first $10 cashout</div>
            </>
          ) : (
            <div className="text-[11px] text-amber-700">You can cash out anytime. ✨</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatTile({ value, label }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="text-xl font-extrabold tracking-tight text-neutral-900">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  )
}

function SectionHeader({ title, icon: Icon, subtitle }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-neutral-500" />}
        <h2 className="text-lg font-extrabold tracking-tight text-neutral-900">{title}</h2>
      </div>
      {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
    </div>
  )
}

function RedemptionRow({ r }) {
  const meta = STATUS_META[r.status] || STATUS_META.pending
  const Icon = meta.icon
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${r.status === 'pending' || r.status === 'processing' ? 'animate-spin' : ''}`} />
          <div>
            <div className="font-bold text-neutral-900">${(r.netCashCents / 100).toFixed(2)}</div>
            <div className="text-[11px] text-neutral-500">{new Date(r.createdAt).toLocaleString()}</div>
          </div>
        </div>
        <Badge className={`text-[10px] uppercase ${meta.tone}`}>{meta.label}</Badge>
      </CardContent>
    </Card>
  )
}

function Faq({ q, a }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <div className="font-bold text-neutral-900">{q}</div>
        <div className="text-sm text-neutral-600">{a}</div>
      </CardContent>
    </Card>
  )
}

const SOURCE_LABELS = {
  facility_check_in:    'Facility check-in',
  receipt_verified:     'Verified receipt',
  first_visit_bonus:    'First-visit bonus',
  donation_receipt:     'Donation receipt',
  ewaste_receipt:       'E-waste receipt',
  transfer_station_receipt: 'Transfer station receipt',
  partner_facility_bonus: 'Partner facility bonus',
  community_post:       'Community post',
  illegal_dump_report:  'Illegal dump report',
  cleanup_event:        'Cleanup event',
  referral_bonus:       'Referral bonus',
  admin_adjustment:     'Admin adjustment',
  redemption:           'Redemption',
}
function labelForSource(s) {
  return SOURCE_LABELS[s] || (String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
}

// ============================================================================
// Redeem dialog
// ============================================================================
function RedeemDialog({ open, tier, balance, onClose, onRedeemed }) {
  const [methods, setMethods] = useState([])
  const [methodId, setMethodId] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [addingMethod, setAddingMethod] = useState(false)
  const [newMethod, setNewMethod] = useState({ type: 'venmo', label: '', email: '' })

  useEffect(() => {
    if (!open || !tier) return
    let active = true
    ;(async () => {
      const r = await fetch('/api/users/me/cashout-methods', { headers: authHeaders() })
      const j = await r.json().catch(() => ({}))
      if (!active) return
      setMethods(j.methods || [])
      const def = (j.methods || []).find((m) => m.isDefault) || (j.methods || [])[0]
      setMethodId(def?.id || '')
      const pr = await fetch('/api/users/me/rewards/redeem/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ points: tier.points }),
      })
      const pj = await pr.json().catch(() => ({}))
      if (active) setPreview(pj.preview || null)
    })()
    return () => { active = false }
  }, [open, tier])

  const addMethod = async () => {
    if (!newMethod.label.trim()) { toast.error('Add a label'); return }
    const r = await fetch('/api/users/me/cashout-methods', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(newMethod),
    })
    const j = await r.json()
    if (!r.ok) { toast.error(j.error || 'Failed'); return }
    setMethods((arr) => [...arr, j.method])
    setMethodId(j.method.id)
    setAddingMethod(false)
    setNewMethod({ type: 'venmo', label: '', email: '' })
  }

  const submit = async () => {
    if (!methodId) { toast.error('Select or add a cashout method'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/users/me/rewards/redeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ points: tier.points, cashoutMethodId: methodId }),
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Redemption failed'); return }
      toast.success(`Redemption submitted! $${(j.redemption.netCashCents / 100).toFixed(2)} will be paid out.`)
      onRedeemed()
    } finally { setBusy(false) }
  }

  if (!open || !tier) return null
  const insufficient = balance < tier.points

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Gift className="h-4 w-4 text-emerald-600" /> Redeem ${tier.dollars}</DialogTitle></DialogHeader>
        {insufficient ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="mb-1 h-4 w-4" />
            You need {fmtPts(tier.points - balance)} more points to redeem this tier.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span>Points</span><strong>{fmtPts(tier.points)} pts</strong>
              </div>
              <div className="flex items-baseline justify-between">
                <span>Gross</span><strong>${(tier.dollars).toFixed(2)}</strong>
              </div>
              {preview && (
                <>
                  <div className="flex items-baseline justify-between text-amber-700">
                    <span>Fee</span><strong>− ${(preview.feeCents / 100).toFixed(2)}</strong>
                  </div>
                  <div className="mt-1 border-t border-emerald-200 pt-1 text-base">
                    <div className="flex items-baseline justify-between font-extrabold text-emerald-800">
                      <span>You receive</span><span>${(preview.netCashCents / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div>
              <Label className="text-xs">Cashout method</Label>
              {methods.length === 0 ? (
                <div className="mt-1 rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-500">
                  No cashout methods saved. <button className="font-bold text-brand-600 hover:underline" onClick={() => setAddingMethod(true)}>Add one</button>
                </div>
              ) : (
                <div className="mt-1 space-y-1.5">
                  {methods.map((m) => (
                    <label key={m.id} className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${methodId === m.id ? 'border-emerald-500 bg-emerald-50' : 'border-neutral-200'}`}>
                      <input type="radio" name="m" checked={methodId === m.id} onChange={() => setMethodId(m.id)} />
                      <span className="font-bold">{m.label || m.type}</span>
                      <span className="ml-auto text-[11px] uppercase tracking-wider text-neutral-500">{m.type}</span>
                    </label>
                  ))}
                  {!addingMethod && (
                    <button className="text-xs font-bold text-brand-600 hover:underline" onClick={() => setAddingMethod(true)}>+ Add another method</button>
                  )}
                </div>
              )}
            </div>

            {addingMethod && (
              <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <select className="mt-1 h-9 w-full rounded-md border border-neutral-300 px-2 text-sm" value={newMethod.type} onChange={(e) => setNewMethod({ ...newMethod, type: e.target.value })}>
                      <option value="venmo">Venmo</option>
                      <option value="cashapp">Cash App</option>
                      <option value="check">Mailed check</option>
                      <option value="facility_credit">Facility credit</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Label</Label>
                    <Input value={newMethod.label} onChange={(e) => setNewMethod({ ...newMethod, label: e.target.value })} placeholder="My Venmo" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Email or @handle</Label>
                  <Input value={newMethod.email} onChange={(e) => setNewMethod({ ...newMethod, email: e.target.value })} placeholder="@username or you@email.com" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setAddingMethod(false)}>Cancel</Button>
                  <Button size="sm" onClick={addMethod} className="bg-brand-600 hover:bg-brand-700">Save method</Button>
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || insufficient || !methodId} className="bg-emerald-600 hover:bg-emerald-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm redemption'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
