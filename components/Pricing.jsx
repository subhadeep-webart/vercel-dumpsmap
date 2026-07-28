'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  CircleDollarSign, Scale, CreditCard, Banknote, FileText, Clock,
  BadgeCheck, Building2, ShieldCheck, AlertCircle, ArrowRight, Sparkles,
  CircleCheck, Construction, Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { timeAgo } from '@/components/AlertSystem'

const PRICING_TYPES = {
  per_ton: { label: 'Per ton', color: 'bg-amber-100 text-amber-900' },
  flat_rate: { label: 'Flat rate', color: 'bg-sky-100 text-sky-900' },
  per_item: { label: 'Per item', color: 'bg-purple-100 text-purple-900' },
  free: { label: 'Free', color: 'bg-brand-100 text-brand-900' },
  donation_only: { label: 'Donation only', color: 'bg-rose-100 text-rose-900' },
  unknown: { label: 'Unknown', color: 'bg-neutral-100 text-neutral-700' },
}

const VERIFIED_BY_BADGE = {
  admin: { label: 'Verified by DumpMaps', color: 'bg-brand-600 text-white', icon: ShieldCheck },
  facility: { label: 'Verified by facility', color: 'bg-purple-600 text-white', icon: BadgeCheck },
  user: { label: 'User-reported', color: 'bg-amber-500 text-white', icon: AlertCircle },
}

// ---------- Main Pricing Section ----------
export function PricingSection({ facility, onReportPrice, onOpenPaymentInterest, onOpenScaleWorkflow }) {
  const p = facility?.pricing || { pricingType: 'unknown', materialPricing: [], paymentMethods: {} }
  const type = PRICING_TYPES[p.pricingType] || PRICING_TYPES.unknown
  const verified = VERIFIED_BY_BADGE[p.verifiedBy] || VERIFIED_BY_BADGE.user
  const VerifiedIcon = verified.icon

  return (
    <Card className="border-amber-200">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-neutral-900">
            <CircleDollarSign className="h-4 w-4 text-amber-600" /> Pricing & Scale
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={type.color + ' hover:' + type.color}>{type.label}</Badge>
            <Badge className={verified.color + ' hover:' + verified.color}>
              <VerifiedIcon className="mr-0.5 h-3 w-3" /> {verified.label}
            </Badge>
          </div>
        </div>

        {/* Headline pricing */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-[10px] uppercase tracking-wide text-neutral-500">Est. price / ton</div>
            <div className="mt-0.5 text-xl font-extrabold text-neutral-900">
              {p.pricingType === 'free' ? 'FREE' : p.pricingType === 'donation_only' ? 'Donation' : p.pricePerTon != null ? `$${p.pricePerTon}` : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-[10px] uppercase tracking-wide text-neutral-500">Minimum charge</div>
            <div className="mt-0.5 text-xl font-extrabold text-neutral-900">
              {p.minimumCharge != null ? `$${p.minimumCharge}` : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-[10px] uppercase tracking-wide text-neutral-500">Last updated</div>
            <div className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-neutral-900">
              <Clock className="h-3 w-3" />
              {p.lastUpdated ? timeAgo(p.lastUpdated) : '—'}
            </div>
          </div>
        </div>

        {/* Material-specific table */}
        {(p.materialPricing || []).length > 0 && (
          <div>
            <div className="mb-1 text-sm font-semibold">Material-specific pricing</div>
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-semibold">Material</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Price</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {p.materialPricing.map((m, i) => (
                    <tr key={i} className="border-t border-neutral-100">
                      <td className="px-3 py-1.5">{m.material}</td>
                      <td className="px-3 py-1.5 text-right font-semibold">
                        {m.price === 0 ? <span className="text-brand-700">FREE</span> : `$${m.price}`}
                      </td>
                      <td className="px-3 py-1.5 text-right text-neutral-500">/ {m.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Surge / sorting */}
        {(p.surgeFeeNotes || p.sortingFeeNotes) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {p.surgeFeeNotes && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
                <div className="font-semibold text-amber-900">Surge fee</div>
                <div className="text-amber-800">{p.surgeFeeNotes}</div>
              </div>
            )}
            {p.sortingFeeNotes && (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs">
                <div className="font-semibold text-sky-900">Sorting note</div>
                <div className="text-sky-800">{p.sortingFeeNotes}</div>
              </div>
            )}
          </div>
        )}

        {/* Scale + Payment grid */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-neutral-200 p-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
              <Scale className="h-3.5 w-3.5 text-neutral-600" /> Scale procedure
            </div>
            <ul className="ml-4 mt-1 list-disc space-y-0.5 text-[11px] text-neutral-700">
              <li>Scale-in: <b>{p.scaleInRequired ? 'Required' : 'Not required'}</b></li>
              <li>Scale-out: <b>{p.scaleOutRequired ? 'Required' : 'Not required'}</b></li>
            </ul>
          </div>
          <div className="rounded-md border border-neutral-200 p-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
              <CreditCard className="h-3.5 w-3.5 text-neutral-600" /> Payment accepted
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {p.paymentMethods?.cash && <Badge variant="outline" className="text-[10px]"><Banknote className="mr-0.5 h-3 w-3" /> Cash</Badge>}
              {p.paymentMethods?.card && <Badge variant="outline" className="text-[10px]"><CreditCard className="mr-0.5 h-3 w-3" /> Card</Badge>}
              {p.paymentMethods?.accountBilling && <Badge variant="outline" className="text-[10px]"><FileText className="mr-0.5 h-3 w-3" /> Account billing</Badge>}
              {!p.paymentMethods?.cash && !p.paymentMethods?.card && !p.paymentMethods?.accountBilling && (
                <span className="text-[11px] text-neutral-500">No payment (donation/free)</span>
              )}
              <Badge variant="outline" className="border-dashed text-[10px] text-neutral-500">
                <Sparkles className="mr-0.5 h-3 w-3" /> Online — soon
              </Badge>
            </div>
          </div>
        </div>

        {/* Online payment teaser */}
        <button
          onClick={onOpenPaymentInterest}
          className="flex w-full items-center justify-between rounded-lg border-2 border-dashed border-brand-300 bg-gradient-to-r from-brand-50 to-brand-100 p-3 text-left hover:from-brand-100"
        >
          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-brand-900">
              <Sparkles className="h-4 w-4 text-brand-600" />
              Pay online — coming soon
            </div>
            <div className="mt-0.5 text-[11px] text-brand-800">
              Pre-pay tipping fees from the app. Facilities can join the early-access list.
            </div>
          </div>
          <Badge className="bg-brand-600 text-white hover:bg-brand-600">Join interest list</Badge>
        </button>

        {/* Scale-In / Scale-Out workflow */}
        {onOpenScaleWorkflow && (
          <button
            onClick={onOpenScaleWorkflow}
            className="flex w-full items-center justify-between rounded-lg border-2 border-dashed border-sky-300 bg-gradient-to-r from-sky-50 to-cyan-50 p-3 text-left hover:from-sky-100"
          >
            <div>
              <div className="flex items-center gap-1.5 text-sm font-bold text-sky-900">
                <Scale className="h-4 w-4 text-sky-600" />
                Scale-In / Scale-Out workflow — preview
              </div>
              <div className="mt-0.5 text-[11px] text-sky-800">
                See the 10-step in-vehicle flow. Estimate your load. Join the payment pilot.
              </div>
            </div>
            <Badge className="bg-sky-600 text-white hover:bg-sky-600">Start Scale-In</Badge>
          </button>
        )}

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="text-[11px] text-neutral-500">
            Prices change. Always confirm at the gate.
          </div>
          <Button size="sm" variant="outline" onClick={onReportPrice}>
            Report price update
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- Payment Interest Dialog ----------
export function PaymentInterestDialog({ open, onOpenChange, facilityName = '' }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [notes, setNotes] = useState('')
  const [name, setName] = useState(facilityName)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (open) { setName(facilityName); setDone(false); setEmail(''); setRole(''); setNotes('') }
  }, [open, facilityName])

  const submit = async () => {
    if (!email) return toast.error('Email required')
    setBusy(true)
    try {
      const r = await fetch('/api/payment-interest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, facilityName: name, role, notes }),
      })
      if (!r.ok) throw new Error('fail')
      setDone(true)
      toast.success("You're on the early access list!")
    } catch { toast.error('Failed to submit') } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-600" />
            Online payments — Coming Soon
          </DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="space-y-3 pt-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700"><CircleCheck className="h-7 w-7" /></div>
            <div className="font-semibold">You&apos;re on the list!</div>
            <p className="text-sm text-neutral-600">We&apos;ll reach out when DumpMaps payments go live.</p>
            <Button onClick={() => onOpenChange(false)} className="bg-brand-600 hover:bg-brand-700">Done</Button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <Badge className="inline-flex items-center gap-1 bg-sky-100 text-sky-900 hover:bg-sky-100"><Construction className="h-3 w-3" /> Coming in Phase 2</Badge>
            <p className="text-sm text-neutral-700">
              Soon, contractors and haulers will be able to pre-pay tipping fees in-app, get receipts, and settle account billing. Join the early access list to be first.
            </p>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">I am a</Label>
                <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Hauler / Facility / Contractor" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Facility (optional)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Facility name" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Anything else?</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Use case, volume, integrations…" rows={2} className="mt-1" />
            </div>
            <div className="flex items-start gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-[11px] text-brand-900">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <b>No card or payment info collected yet.</b> Just your email so we can invite you when payments go live.
              </div>
            </div>
            <Button onClick={submit} disabled={busy} className="w-full bg-brand-600 hover:bg-brand-700">
              {busy ? '…' : 'Join early access'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
