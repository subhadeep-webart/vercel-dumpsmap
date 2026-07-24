'use client'

import { FOOTER_BADGES } from '@/constants/business_constants'

export default function BusinessFooterStrip() {
  return (
    <section className="border-t border-neutral-100 bg-white py-8">
      <div className="container mx-auto grid grid-cols-2 gap-6 px-4 text-center md:grid-cols-4">
        {FOOTER_BADGES.map((b) => {
          const Icon = b.icon
          return (
            <div key={b.t} className="flex flex-col items-center gap-1">
              <Icon className="h-6 w-6 text-emerald-600" />
              <div className="text-[13px] font-semibold">{b.t}</div>
              <div className="text-[12px] text-neutral-500">{b.d}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
