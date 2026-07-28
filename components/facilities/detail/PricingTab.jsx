'use client'

// Pricing tab — headline price, secondary fees, accepted payments, and
// material-specific rates. Extracted from app/facilities/[id]/page.js.

import { Card, CardContent } from '@/components/ui/card'
import { CircleDollarSign, AlertTriangle } from 'lucide-react'
import { SectionCard, KV } from './primitives'

export default function PricingTab({ facility }) {
  const fields = facility.pricingFields || {}
  const pricing = facility.pricing
  const pricingUnknown = facility.pricingUnknown

  const headlinePrice =
    fields.pricePerTon ? { value: `$${fields.pricePerTon}`, unit: '/ton' } :
    fields.pricePerPound ? { value: `$${fields.pricePerPound}`, unit: '/lb' } :
    fields.pricePerItem ? { value: `$${fields.pricePerItem}`, unit: '/item' } :
    (pricing && typeof pricing === 'object' && pricing.pricePerTon) ? { value: `$${pricing.pricePerTon}`, unit: '/ton' } :
    null

  const minCharge = fields.minimumCharge || pricing?.minimumCharge
  const crvRate = fields.crvRate
  const payments = fields.paymentMethods || pricing?.paymentMethods
  const surcharge = fields.mixedLoadSurcharge || pricing?.mixedLoadSurcharge
  const discount = fields.cleanLoadDiscount || pricing?.cleanLoadDiscount
  const materialRates = fields.materialRates || pricing?.materialRates

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-green-600" />
            <span className="text-sm font-bold uppercase tracking-wide text-neutral-700">Pricing</span>
          </div>
          {pricingUnknown ? (
            <p className="mt-3 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Pricing not posted. Call ahead to confirm rates before arrival.
            </p>
          ) : headlinePrice ? (
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-5xl font-extrabold tracking-tight text-green-700">{headlinePrice.value}</span>
              <span className="text-xl font-bold text-green-700/80">{headlinePrice.unit}</span>
            </div>
          ) : typeof pricing === 'string' && pricing ? (
            <p className="mt-3 text-sm text-neutral-800">{pricing}</p>
          ) : (
            <p className="mt-3 text-sm italic text-neutral-500">Pricing not yet posted. Call to confirm.</p>
          )}

          {(minCharge || crvRate || surcharge || discount) && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {minCharge && <KV label="Minimum charge" value={`$${minCharge}`} />}
              {crvRate && <KV label="CRV rate" value={`$${crvRate}/lb`} />}
              {surcharge && <KV label="Mixed load surcharge" value={`+$${surcharge}`} />}
              {discount && <KV label="Clean load discount" value={`-${discount}%`} />}
            </div>
          )}

          {Array.isArray(payments) && payments.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Accepted payments</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {payments.map((p) => (
                  <span key={p} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700">{p}</span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {materialRates && (
        <SectionCard icon={CircleDollarSign} title="Material-specific rates">
          <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">{materialRates}</p>
        </SectionCard>
      )}
    </div>
  )
}
