'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Leaf, Recycle, Sparkles, Truck } from 'lucide-react'

// Single label/value row inside the dashboard.
function Row({ icon: Icon, label, value, highlight }) {
  return (
    <div className="flex items-center justify-between">
      <div className="inline-flex items-center gap-2 text-neutral-600">
        {Icon && <Icon className="h-4 w-4 text-brand-600" />}
        <span>{label}</span>
      </div>
      <span className={`font-bold ${highlight ? 'text-brand-700' : 'text-neutral-900'}`}>{value}</span>
    </div>
  )
}

// Right-rail impact/summary panel for a signed-in seller. Derives all metrics
// from the passed-in listings; renders nothing when there is no user.
export default function SellerDashboard({ user, myListings }) {
  if (!user) return null
  const active = myListings.filter((l) => !l.sold && l.itemStatus !== 'sold' && l.itemStatus !== 'claimed')
  const reserved = myListings.filter((l) => l.itemStatus === 'reserved')
  const claimed = myListings.filter((l) => l.itemStatus === 'sold' || l.itemStatus === 'claimed' || l.itemStatus === 'donated')
  const revenue = claimed.reduce((s, l) => s + (Number(l.price) || 0), 0)
  const itemsDiverted = claimed.length
  const dumpFeesAvoided = itemsDiverted * 40 // est. $40 per item diverted
  const co2 = (itemsDiverted * 28 / 1000).toFixed(2) // ~28kg per item heuristic

  return (
    <Card className="border-neutral-200">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div className="text-base font-extrabold tracking-tight">Seller Dashboard</div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">This Month</span>
        </div>
        <div className="space-y-2 text-sm">
          <Row icon={Sparkles}        label="Revenue Recovered"  value={`$${revenue.toLocaleString()}`} highlight />
          <Row icon={Truck}           label="Dump Fees Avoided"  value={`$${dumpFeesAvoided.toLocaleString()}`} highlight />
          <Row icon={Recycle}         label="Items Diverted"     value={itemsDiverted} highlight />
          <Row icon={Leaf}            label="CO₂ Saved"          value={`${co2} tons`} highlight />
        </div>
        <div className="space-y-1 border-t border-neutral-100 pt-3 text-sm">
          <Row label="Active Listings" value={active.length} />
          <Row label="Items Reserved"  value={reserved.length} />
          <Row label="Items Sold/Claimed" value={claimed.length} />
        </div>
        <Link href="/marketplace?mine=1" className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-neutral-50">
          View All My Listings
        </Link>
      </CardContent>
    </Card>
  )
}
