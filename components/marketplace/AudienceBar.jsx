'use client'

import { Building2, HeartHandshake, ShoppingBag, Truck } from 'lucide-react'

// Single audience callout tile.
function AudienceItem({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-neutral-600">{desc}</div>
      </div>
    </div>
  )
}

// Footer strip describing who the marketplace is for.
export default function AudienceBar() {
  return (
    <section className="mt-10 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-5 md:grid-cols-4">
      <AudienceItem icon={Truck}          title="For Haulers"  desc="Make extra money, save on dump fees, and build your reputation." />
      <AudienceItem icon={ShoppingBag}    title="For Buyers"   desc="Find amazing items for less and help the planet." />
      <AudienceItem icon={Building2}      title="For Vendors"  desc="Get early access to inventory before it hits the market." />
      <AudienceItem icon={HeartHandshake} title="For Everyone" desc="Stronger communities through reuse and sustainability." />
    </section>
  )
}
