'use client'

// DumpMaps Impact Score™ card — verified environmental impact metrics with a
// loading skeleton, an empty state for new facilities, and a detail footer.
// Extracted from app/facilities/[id]/page.js. The ImpactStat helper is
// colocated as its only consumer.

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Leaf, BadgeCheck, Recycle, Activity, Trees, Star, DollarSign,
  Phone, Cloud, Droplets, Users, ShieldAlert,
} from 'lucide-react'
import { formatNumber } from './primitives'

export default function ImpactScoreCard({ impact, facility }) {
  const m = impact?.metrics
  const isNew = !impact || impact.isNew

  if (!impact) {
    return (
      <div className="rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 via-white to-emerald-50/50 p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-green-600 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">DumpMaps Impact Score™</span>
        </div>
        <div className="mt-3 h-4 w-32 animate-pulse rounded bg-green-100" />
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-green-50" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 via-white to-emerald-50/40 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-600 text-white shadow-sm">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-green-700">DumpMaps Impact Score™</div>
            <div className="text-base font-extrabold text-neutral-900">Verified environmental impact</div>
          </div>
        </div>
        {!isNew && (
          <Badge variant="outline" className="border-green-300 bg-green-100 text-[10px] font-bold uppercase tracking-wider text-green-800">
            <BadgeCheck className="mr-0.5 h-3 w-3" /> Community-verified
          </Badge>
        )}
        {isNew && (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] font-bold uppercase tracking-wider text-amber-800">
            New facility
          </Badge>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 px-5 py-4 sm:grid-cols-5 sm:gap-3">
        <ImpactStat
          icon={Recycle}
          label="Materials Diverted"
          value={isNew ? '—' : `${formatNumber(m.lbsDiverted)} lbs`}
          emoji="♻️"
        />
        <ImpactStat
          icon={Activity}
          label="Contractor Visits"
          value={isNew ? '—' : formatNumber(m.contractorVisits)}
          emoji="🚛"
        />
        <ImpactStat
          icon={Trees}
          label="Trees Equivalent"
          value={isNew ? '—' : `${formatNumber(m.treesEquivalent)}`}
          emoji="🌳"
        />
        <ImpactStat
          icon={Star}
          label="Community Rating"
          value={isNew ? 'New' : `${m.communityRating.toFixed(1)}`}
          subValue={isNew ? null : `${m.reviewCount} reviews`}
          emoji="⭐"
        />
        <ImpactStat
          icon={DollarSign}
          label="Rewards Earned Here"
          value={isNew ? '—' : `$${formatNumber(m.rewardsPaidUsd, 2)}`}
          emoji="💰"
        />
      </div>

      {/* Empty state CTA */}
      {isNew && (
        <div className="mx-5 mb-5 rounded-xl border border-dashed border-green-300 bg-white px-4 py-4 text-center">
          <p className="text-sm font-semibold text-neutral-800">
            Be the first to check in, upload a receipt, or report activity at this facility.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button asChild className="bg-green-700 hover:bg-green-800">
              <Link href="/receipt-scanner">
                <Recycle className="mr-1.5 h-4 w-4" /> Scan a receipt
              </Link>
            </Button>
            {facility?.phone && (
              <Button asChild variant="outline" className="border-green-300 text-green-800 hover:bg-green-50">
                <a href={`tel:${facility.phone}`}>
                  <Phone className="mr-1.5 h-4 w-4" /> Call facility
                </a>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Detail footer (non-empty state) */}
      {!isNew && (
        <div className="border-t border-green-100 bg-white/60 px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-600">
            {m.lbsCo2Offset > 0 && (
              <span className="inline-flex items-center gap-1">
                <Cloud className="h-3 w-3 text-green-600" /> <b>{formatNumber(m.lbsCo2Offset)} lbs</b> CO₂ offset
              </span>
            )}
            {m.gallonsWaterSaved > 0 && (
              <span className="inline-flex items-center gap-1">
                <Droplets className="h-3 w-3 text-blue-600" /> <b>{formatNumber(m.gallonsWaterSaved)} gal</b> water saved
              </span>
            )}
            {m.uniqueContractors > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3 text-neutral-500" /> <b>{m.uniqueContractors}</b> unique contractors
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-neutral-400">
              <ShieldAlert className="h-3 w-3" /> Formula v{impact.formulaVersion} · EPA-based
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function ImpactStat({ icon: Icon, label, value, subValue, emoji }) {
  return (
    <div className="rounded-xl border border-green-100 bg-white p-3">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        <span className="text-sm">{emoji}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-xl font-extrabold leading-tight text-green-800">{value}</div>
      {subValue && <div className="text-[10px] text-neutral-500">{subValue}</div>}
    </div>
  )
}
