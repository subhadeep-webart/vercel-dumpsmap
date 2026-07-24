'use client'

// Overview tab — live status, quick check-in CTA, status history, impact score,
// about, contractor intel, materials/pricing previews, and provenance.
// Extracted from app/facilities/[id]/page.js.

import { Badge } from '@/components/ui/badge'
import { Activity, ShieldAlert } from 'lucide-react'
import FacilityStatusHistory from '@/components/FacilityStatusHistory'
import ImpactScoreCard from './ImpactScoreCard'
import { LiveStatusCard, AcceptedMaterialsCard, PricingPreviewCard, ContractorIntelCard } from './OverviewCards'
import { SectionCard, KV } from './primitives'

export default function OverviewTab({ facility, statusMeta, editing, editForm, setEditForm, impact, statusHistoryKey, onCheckIn }) {
  return (
    <div className="space-y-4">
      {/* Live status banner */}
      <LiveStatusCard facility={facility} statusMeta={statusMeta} />

      {/* Quick Check-In CTA — primary call-to-action for live facility activity.
          Tapping opens the Waze-style 5-pill modal that auto-mirrors onto
          facility.liveStatus and creates a community_posts entry. */}
      <button
        onClick={onCheckIn}
        className="flex w-full items-center justify-between rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-white p-4 text-left shadow-sm transition hover:border-emerald-500 hover:shadow-md"
      >
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Quick Check-In</div>
          <div className="mt-0.5 text-base font-extrabold tracking-tight text-neutral-900">Report current wait time</div>
          <div className="mt-0.5 text-xs text-neutral-500">Takes 10 seconds · earns +25 reward points</div>
        </div>
        <div className="ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow group-hover:bg-emerald-700">
          <Activity className="h-5 w-5" />
        </div>
      </button>

      {/* Recent Updates (Sprint A enhancement) — community check-ins history.
          Lives high on the page so contractors see live status before scrolling. */}
      <FacilityStatusHistory facilityId={facility.id} refreshKey={statusHistoryKey} limit={10} />

      {/* DumpMaps Impact Score™ */}
      <ImpactScoreCard impact={impact} facility={facility} />

      {/* About / description */}
      {(facility.description || facility.about) && (
        <SectionCard icon={Activity} title="About">
          <p className="text-sm leading-relaxed text-neutral-700">{facility.description || facility.about}</p>
        </SectionCard>
      )}

      {/* Contractor intel */}
      <ContractorIntelCard facility={facility} />

      {/* Materials preview */}
      <div className="grid gap-4 sm:grid-cols-2">
        <AcceptedMaterialsCard facility={facility} compact />
        <PricingPreviewCard facility={facility} />
      </div>

      {/* Provenance */}
      {(facility.sourceUrl || facility.sourceType || facility.confidenceScore != null || facility.lastVerifiedAt) && (
        <SectionCard icon={ShieldAlert} title="Data Source & Verification">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            {facility.sourceType && (
              <KV label="Source type" value={facility.sourceType.replace(/_/g, ' ')} />
            )}
            {facility.confidenceScore != null && (
              <div>
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">Confidence</span>
                <div className="font-semibold">
                  {facility.confidenceScore}%
                  {facility.confidenceScore >= 80 ? <Badge variant="outline" className="ml-2 border-green-200 bg-green-50 text-green-800">High</Badge> :
                   facility.confidenceScore >= 60 ? <Badge variant="outline" className="ml-2 border-amber-200 bg-amber-50 text-amber-800">Medium</Badge> :
                   <Badge variant="outline" className="ml-2 border-red-200 bg-red-50 text-red-800">Low — please call</Badge>}
                </div>
              </div>
            )}
            {facility.sourceUrl && (
              <div className="sm:col-span-2">
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">Source URL</span>
                <div className="truncate"><a href={facility.sourceUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{facility.sourceUrl}</a></div>
              </div>
            )}
            {facility.lastVerifiedAt && (
              <KV label="Last verified" value={new Date(facility.lastVerifiedAt).toLocaleDateString()} />
            )}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
