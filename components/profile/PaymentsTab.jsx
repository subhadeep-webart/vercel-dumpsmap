'use client'

// Payments tab — a grid of payment-method toggles. Each toggle flips membership
// in the accepted set and persists the whole array. Options live in
// constants/profile_constants (PAYMENT_OPTIONS).

import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SavingHint } from '@/components/profile/primitives'
import { PAYMENT_OPTIONS } from '@/constants/profile_constants'
import { CheckCircle2 } from 'lucide-react'

export default function PaymentsTab({ form, setForm, save, saving }) {
  const accepted = new Set(form.paymentMethodsAccepted || [])
  const toggle = (val) => {
    const next = new Set(accepted)
    if (next.has(val)) next.delete(val); else next.add(val)
    const arr = [...next]
    setForm({ ...form, paymentMethodsAccepted: arr })
    save({ paymentMethodsAccepted: arr }, 'Payment preferences')
  }
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Payment methods accepted</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-neutral-600">Select which ways you accept payment from customers. They&apos;ll see these on your profile and job listings.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAYMENT_OPTIONS.map((o) => {
            const isOn = accepted.has(o.value)
            return (
              <button
                key={o.value}
                onClick={() => toggle(o.value)}
                className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                  isOn ? 'border-green-500 bg-green-50' : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                <span className="flex items-center gap-3">
                  {o.Icon && <o.Icon className="h-5 w-5 shrink-0 text-neutral-700" />}
                  <span className="text-sm font-bold text-neutral-900">{o.label}</span>
                </span>
                {isOn ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <span className="text-xs text-neutral-400">Off</span>}
              </button>
            )
          })}
        </div>
        {saving === 'Payment preferences' && <SavingHint label="Payment preferences" />}
        <div className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <b>Note:</b> Stripe payouts can be configured under <Link href="/settings/payment-methods" className="text-green-700 underline">Settings → Payment Methods</Link>.
        </div>
      </CardContent>
    </Card>
  )
}
