'use client'

// Quick stats bar below the hero — open/closed pill, hours, wait time, rating,
// and diversion rate rendered as compact pills. Extracted from
// app/facilities/[id]/page.js. The Stat helper is colocated as its only user.

import { Clock, Activity, Star, TrendingUp } from 'lucide-react'

export default function QuickStatsBar({ facility, statusMeta }) {
  const waitAlert = (facility.activeAlerts || []).find((a) => /wait/i.test(a.type) || a.waitMinutes != null)
  const openColor =
    statusMeta?.color === 'green' ? 'green' :
    statusMeta?.color === 'red'   ? 'red'   :
    statusMeta?.color === 'amber' ? 'amber' :
    facility.openNow === false ? 'red' : 'green'

  return (
    <section className="border-b border-neutral-200 bg-white">
      <div className="container mx-auto flex flex-wrap items-center gap-2 px-4 py-3 text-xs sm:gap-3">
        {/* Open / Closed pill */}
        <Stat
          tone={openColor}
          icon={
            <span className={`relative flex h-2 w-2`}>
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${openColor === 'green' ? 'bg-green-500' : openColor === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${openColor === 'green' ? 'bg-green-500' : openColor === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
            </span>
          }
          label={statusMeta?.label || (facility.openNow === false ? 'Closed' : 'Open Now')}
        />
        {/* Hours */}
        {facility.hours && (
          <Stat tone="slate" icon={<Clock className="h-3.5 w-3.5" />} label={facility.hours} />
        )}
        {/* Wait time */}
        {waitAlert?.waitMinutes != null && (
          <Stat tone="amber" icon={<Activity className="h-3.5 w-3.5" />} label={`~${waitAlert.waitMinutes} min wait`} />
        )}
        {/* Rating */}
        {facility.rating > 0 && (
          <Stat
            tone="slate"
            icon={<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
            label={`${Number(facility.rating).toFixed(1)} · ${facility.reviewCount || 0} reviews`}
          />
        )}
        {/* Diversion (rewards/eco metric) */}
        {facility.diversionRate != null && (
          <Stat tone="green" icon={<TrendingUp className="h-3.5 w-3.5" />} label={`${facility.diversionRate}% diversion`} />
        )}
      </div>
    </section>
  )
}

function Stat({ tone = 'slate', icon, label }) {
  const tones = {
    green: 'border-green-200 bg-green-50 text-green-800',
    red:   'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    slate: 'border-neutral-200 bg-neutral-50 text-neutral-700',
    blue:  'border-blue-200 bg-blue-50 text-blue-800',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${tones[tone] || tones.slate}`}>
      {icon}{label}
    </span>
  )
}
