'use client'

import { Card, CardContent } from '@/components/ui/card'
import { BadgeCheck, Bell, Crosshair, Recycle, ShieldCheck, Truck } from 'lucide-react'

// Static "why use the marketplace" marketing panel shown in the right rail.
export default function WhyUsePanel() {
  const items = [
    { icon: Recycle,        title: 'Keep it out of the landfill', desc: 'Help the environment and your wallet.' },
    { icon: Crosshair,      title: 'Find great deals nearby',     desc: 'New items posted every minute.' },
    { icon: BadgeCheck,     title: 'Verified haulers & vendors',  desc: 'Buy with confidence.' },
    { icon: Bell,           title: 'Smart alerts',                desc: 'Get notified about items you want.' },
    { icon: Truck,          title: 'Real-time updates',           desc: 'On truck, at site, or last chance.' },
    { icon: ShieldCheck,    title: 'Safety tips',                 desc: 'Meet in safe public places when possible. Never share personal info. Report suspicious activity.' },
  ]
  return (
    <Card className="border-neutral-200">
      <CardContent className="space-y-3 p-5">
        <div className="text-base font-extrabold tracking-tight">Why Use DumpMaps Marketplace?</div>
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <it.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-900">{it.title}</div>
              <div className="text-xs leading-relaxed text-neutral-600">{it.desc}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
