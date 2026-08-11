'use client'

// StatusStrip — the 4-tile strip under the hero: Facility Status pill, Last
// Updated stamp, Profile Strength meter, and the primary Update Status dropdown.
// The status dropdown writes facility.currentStatus via the portal hook; the
// strength meter is derived client-side from the facility record.

import { ChevronDown, CircleCheck } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { STATUS_OPTIONS } from '@/constants/facility_portal_constants'
import { facilityStatus, profileStrength, timestamp } from './portal-helpers'

function Tile({ label, children, className = '' }) {
  return (
    <div className={`flex-1 px-4 py-3 ${className}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

export default function StatusStrip({ facility, saving, onUpdateStatus }) {
  if (!facility) return null
  const current = facilityStatus(facility)
  const active = STATUS_OPTIONS.find((o) => o.value === current) || STATUS_OPTIONS[0]
  const strength = profileStrength(facility)
  const lastUpdated = facility.updatedAt || facility.pricing?.lastUpdated

  return (
    <section
      className="dm-rise-in overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm"
      style={{ '--dm-i': 1 }}
    >
      <div className="flex flex-col divide-y divide-neutral-100 sm:flex-row sm:divide-x sm:divide-y-0">
        {/* Facility status */}
        <Tile label="Facility Status">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold uppercase tracking-wide ring-1 ${active.tone}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" /> {active.label}
          </span>
        </Tile>

        {/* Last updated */}
        <Tile label="Last Updated">
          <div className="text-sm font-bold text-neutral-900">{timestamp(lastUpdated)}</div>
          <div className="text-[11px] text-neutral-400">by Facility</div>
        </Tile>

        {/* Profile strength */}
        <Tile label="Profile Strength">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-neutral-900">{strength.percent}%</span>
            <span className="text-[11px] text-neutral-400">
              {strength.percent === 100 ? 'Complete' : `${strength.done}/${strength.total}`}
            </span>
          </div>
          <Progress
            value={strength.percent}
            className="mt-1.5 h-1.5 bg-emerald-100"
            indicatorClassName="bg-emerald-500"
          />
        </Tile>

        {/* Update status */}
        <div className="flex items-center justify-start px-4 py-3 sm:justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
              disabled={saving}
            >
              Update Status <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {STATUS_OPTIONS.map((o) => {
                const Icon = o.Icon
                return (
                  <DropdownMenuItem
                    key={o.value}
                    onClick={() => onUpdateStatus?.(o.value)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4 text-neutral-500" />
                    <span className="flex-1">{o.label}</span>
                    {o.value === current && <CircleCheck className="h-4 w-4 text-emerald-600" />}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  )
}
