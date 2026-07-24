'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Truck, Building2, Package, Scale, DollarSign, CheckCircle2,
  CreditCard, Receipt, MapPin, Flag, Sparkles, ArrowRight, Lock,
} from 'lucide-react'
import { toast } from 'sonner'

const STEPS = [
  { n: 1, title: 'Arrive at facility', desc: 'Pull up to the gate. Open DumpMaps on your phone.', icon: MapPin },
  { n: 2, title: 'Select facility', desc: 'Pick the facility you\u2019re at (auto-detected via GPS).', icon: Building2 },
  { n: 3, title: 'Select material / load type', desc: 'Pick what\u2019s in your truck \u2014 mixed debris, concrete, wood, mattresses, etc.', icon: Package },
  { n: 4, title: 'Scale in weight', desc: 'Drive onto the scale. Weight is captured automatically by the facility.', icon: Scale },
  { n: 5, title: 'Estimate tonnage and pricing', desc: 'DumpMaps shows tonnage \u00d7 per-ton rate + material-specific surcharges before you pay.', icon: DollarSign },
  { n: 6, title: 'Confirm disposal details', desc: 'Review the load, weight, and itemized cost on your screen.', icon: CheckCircle2 },
  { n: 7, title: 'Pay online', desc: 'Pay with card, account billing, or saved payment method \u2014 from your vehicle.', icon: CreditCard },
  { n: 8, title: 'Receive digital receipt', desc: 'Receipt is emailed and stored under your DumpMaps account.', icon: Receipt },
  { n: 9, title: 'Scale out', desc: 'Drive onto the exit scale. Net weight is calculated automatically.', icon: Scale },
  { n: 10, title: 'Complete visit', desc: 'You\u2019re done. No office line. No paperwork.', icon: Flag },
]

const LOAD_TYPES = ['Mixed debris', 'Concrete', 'Wood', 'Green waste', 'Dirt', 'Metal', 'Mattresses', 'Appliances', 'E-waste']

const COMING_SOON_MSG =
  'Online scale-in, scale-out, and in-vehicle payment is coming soon. DumpMaps is building tools to help haulers pay faster, avoid office lines, and receive digital receipts.'

// ---------- Scale Workflow Dialog ----------
export function ScaleWorkflowDialog({ open, onOpenChange, facility }) {
  const [step, setStep] = useState(1)
  const [loadType, setLoadType] = useState('')
  const [estimatedTons, setEstimatedTons] = useState('')
  const [pilotOpen, setPilotOpen] = useState(false)
  const [facilitySignupOpen, setFacilitySignupOpen] = useState(false)

  useEffect(() => {
    if (!open) { setStep(1); setLoadType(''); setEstimatedTons('') }
  }, [open])

  const p = facility?.pricing
  const matRow = p?.materialPricing?.find((m) => m.material?.toLowerCase().includes(loadType.toLowerCase()))
  const ratePerTon = matRow?.unit === 'ton' ? matRow.price : p?.pricePerTon
  const cost = ratePerTon != null && estimatedTons ? Math.max((p?.minimumCharge || 0), parseFloat(estimatedTons) * ratePerTon) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-brand-600" />
            Scale-In / Scale-Out Workflow
            <Badge className="bg-sky-100 text-sky-900 hover:bg-sky-100">🚧 Coming Soon</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Coming soon banner */}
          <div className="rounded-xl border-2 border-brand-200 bg-gradient-to-r from-brand-50 to-brand-100 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
              <div>
                <div className="text-sm font-bold text-brand-900">Coming to DumpMaps</div>
                <p className="mt-0.5 text-sm text-brand-800">{COMING_SOON_MSG}</p>
              </div>
            </div>
          </div>

          {/* Step Tracker */}
          <div className="rounded-xl border border-neutral-200 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              The 10-step in-vehicle workflow
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {STEPS.map((s) => {
                const Icon = s.icon
                const active = s.n === step
                return (
                  <button
                    key={s.n}
                    onClick={() => setStep(s.n)}
                    className={`flex items-start gap-2 rounded-lg border p-2 text-left transition ${
                      active ? 'border-brand-500 bg-brand-50' : 'border-neutral-200 bg-white hover:border-brand-300'
                    }`}
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      active ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600'
                    }`}>
                      {s.n}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-xs font-semibold text-neutral-900">
                        <Icon className="h-3.5 w-3.5 text-brand-600" /> {s.title}
                      </div>
                      <div className="text-[11px] text-neutral-600">{s.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Live estimator (functional preview) */}
          <Card className="border-amber-200">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 font-semibold">
                <DollarSign className="h-4 w-4 text-amber-600" /> Estimate Load Cost
                <span className="text-[10px] font-normal text-neutral-500">(preview — uses facility pricing)</span>
              </div>
              {facility ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">Facility</Label>
                    <Input value={facility.name} disabled className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Load type</Label>
                    <Select value={loadType} onValueChange={setLoadType}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Pick material" /></SelectTrigger>
                      <SelectContent>{LOAD_TYPES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Estimated tons</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={estimatedTons}
                      onChange={(e) => setEstimatedTons(e.target.value)}
                      placeholder="e.g. 1.5"
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500">Open this from a facility to estimate.</div>
              )}
              {cost != null && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-amber-800">Estimated cost</div>
                  <div className="text-3xl font-extrabold text-amber-900">${cost.toFixed(2)}</div>
                  <div className="mt-0.5 text-[11px] text-amber-800">
                    {estimatedTons} tons &times; ${ratePerTon}/ton
                    {p?.minimumCharge ? ` \u00b7 min charge $${p.minimumCharge}` : ''}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={() => { setStep(4); toast('Scale-in flow simulated. Real check-in coming soon.') }}
              className="bg-brand-600 hover:bg-brand-700"
            >
              <Scale className="mr-1 h-4 w-4" /> Start Scale-In
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!loadType || !estimatedTons) return toast.error('Pick a material and enter tons')
                setStep(5)
                toast.success(`Estimate: $${cost?.toFixed(2)}`)
              }}
            >
              <DollarSign className="mr-1 h-4 w-4" /> Estimate Load Cost
            </Button>
            <Button
              disabled
              className="cursor-not-allowed bg-neutral-300 text-neutral-700 hover:bg-neutral-300"
              title="Disabled — no card collection or payment processing yet"
            >
              <Lock className="mr-1 h-4 w-4" /> Pay From Vehicle — Disabled (Coming Soon)
            </Button>
            <Button
              onClick={() => setPilotOpen(true)}
              className="bg-brand-600 hover:bg-brand-700"
            >
              <Sparkles className="mr-1 h-4 w-4" /> Join Payment Pilot
            </Button>
            <Button
              onClick={() => setFacilitySignupOpen(true)}
              variant="outline"
              className="sm:col-span-2 border-purple-300 text-purple-800 hover:bg-purple-50"
            >
              <Building2 className="mr-1 h-4 w-4" /> Facility Payment Signup
            </Button>
          </div>

          <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-[12px] font-medium text-brand-900">
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
              <div>
                <div className="font-bold">No card required. No payments processed.</div>
                <div className="mt-0.5 text-brand-800">
                  We&apos;re only collecting interest for now. When DumpMaps payments launch, pilot users
                  will be invited first — and you&apos;ll only enter card details then.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-600">
            <b>Note:</b> No real payments are processed yet. The estimator uses live facility pricing.
            Pilot participants will be first when DumpMaps payments launch.
          </div>
        </div>

        <PaymentPilotDialog open={pilotOpen} onOpenChange={setPilotOpen} facilityName={facility?.name} variant="hauler" />
        <PaymentPilotDialog open={facilitySignupOpen} onOpenChange={setFacilitySignupOpen} facilityName={facility?.name} variant="facility" />
      </DialogContent>
    </Dialog>
  )
}

// Small signup dialog — reuses /api/payment-interest
function PaymentPilotDialog({ open, onOpenChange, facilityName = '', variant = 'hauler' }) {
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { if (open) { setEmail(''); setNotes(''); setDone(false) } }, [open])

  const submit = async () => {
    if (!email) return toast.error('Email required')
    setBusy(true)
    try {
      await fetch('/api/payment-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          facilityName,
          role: variant === 'facility' ? 'facility' : 'hauler',
          notes: `[${variant === 'facility' ? 'Facility signup' : 'Hauler pilot'}] ${notes}`,
        }),
      })
      setDone(true)
      toast.success("You're in — we'll be in touch!")
    } catch { toast.error('Failed to submit') } finally { setBusy(false) }
  }

  const isFacility = variant === 'facility'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isFacility ? <Building2 className="h-5 w-5 text-purple-600" /> : <Sparkles className="h-5 w-5 text-brand-600" />}
            {isFacility ? 'Facility Payment Signup' : 'Join Payment Pilot'}
          </DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="space-y-3 pt-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-2xl">✓</div>
            <div className="font-semibold">You&apos;re on the list!</div>
            <p className="text-sm text-neutral-600">
              {isFacility
                ? "We'll reach out to integrate your scale and payment hardware."
                : "We'll invite you to the pilot when in-vehicle payment goes live."}
            </p>
            <Button onClick={() => onOpenChange(false)} className="bg-brand-600 hover:bg-brand-700">Done</Button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <Badge className={isFacility ? 'bg-purple-100 text-purple-900 hover:bg-purple-100' : 'bg-sky-100 text-sky-900 hover:bg-sky-100'}>
              🚧 Phase 2 pilot
            </Badge>
            <p className="text-sm text-neutral-700">
              {isFacility
                ? 'Facilities: connect your scale system, enable in-vehicle payment, and get a steady stream of haulers who pay before they leave.'
                : 'Haulers: skip the office line. Pay tipping fees from your truck and get a digital receipt the moment you scale out.'}
            </p>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="mt-1" />
            </div>
            {!isFacility && (
              <div>
                <Label className="text-xs">Facility you visit most (optional)</Label>
                <Input value={facilityName} readOnly className="mt-1 bg-neutral-50" />
              </div>
            )}
            <div>
              <Label className="text-xs">{isFacility ? 'What scale system do you use?' : 'How often do you visit?'}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isFacility ? 'e.g. Cardinal, Mettler Toledo, custom' : 'e.g. 3-5 times per week'} className="mt-1" />
            </div>
            <div className="flex items-start gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-[11px] text-brand-900">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" />
              <div>
                <b>No card or payment info collected yet.</b> We&apos;ll reach out before launch — you&apos;ll only enter payment details then.
              </div>
            </div>
            <Button onClick={submit} disabled={busy} className="w-full bg-brand-600 hover:bg-brand-700">
              {busy ? '…' : isFacility ? 'Sign facility up' : 'Join pilot'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
