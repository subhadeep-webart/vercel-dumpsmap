'use client'

import { STATS } from '@/constants/business_constants'
import { useCountUp } from '@/lib/useCountUp'

// Split a display string like "$250K+" / "10,000+" / "1" into the numeric
// target we animate plus the decorations we re-apply around it.
function parseStat(str) {
  const match = String(str).match(/^([^\d]*)([\d,]+)(.*)$/)
  if (!match) return { prefix: '', target: 0, suffix: str }
  const [, prefix, digits, suffix] = match
  return { prefix, target: Number(digits.replace(/,/g, '')), suffix }
}

// One animated stat number. Each gets its own hook instance / observed ref.
function StatCounter({ display }) {
  const { prefix, target, suffix } = parseStat(display)
  const { ref, value } = useCountUp(target)
  return (
    <div ref={ref} className="mt-3 text-2xl font-extrabold text-neutral-900 md:text-3xl tabular-nums">
      {prefix}{value.toLocaleString()}{suffix}
    </div>
  )
}

export default function BusinessStats() {
  return (
    <section className="border-y border-neutral-100 bg-white py-10">
      <div className="container mx-auto grid grid-cols-2 gap-6 px-4 text-center md:grid-cols-4">
        {STATS.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.v} className="flex flex-col items-center">
              <Icon className="h-8 w-8 text-emerald-600" />
              <StatCounter display={s.k} />
              <div className="text-sm font-semibold text-neutral-900">{s.v}</div>
              <div className="mt-0.5 max-w-[200px] text-[12px] text-neutral-500">{s.d}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
