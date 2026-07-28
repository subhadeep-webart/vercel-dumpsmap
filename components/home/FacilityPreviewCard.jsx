'use client'

import { Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getStatusMeta } from '@/lib/facility-types'
import { TypeIcon, StatusIcon } from '@/lib/facility-icons'

// ---------- Facility Preview Card (used in Submit form) ----------
export default function FacilityPreviewCard({ facility: f }) {
  const statusMeta = f.currentStatus ? getStatusMeta(f.currentStatus) : null
  const statusColorMap = {
    green: 'border-brand-600 bg-brand-50 text-brand-800',
    red:   'border-red-600 bg-red-50 text-red-800',
    amber: 'border-amber-600 bg-amber-50 text-amber-800',
    blue:  'border-blue-600 bg-blue-50 text-blue-800',
  }
  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-700">
        <TypeIcon typeKey={f.typeKey} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="truncate font-semibold">{f.name}</div>
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">Pending review</Badge>
        </div>
        <div className="mt-0.5 text-xs text-neutral-500">{f.type}</div>
        <div className="mt-1 line-clamp-1 text-xs text-neutral-600">{f.address}</div>
        {statusMeta && (
          <div className="mt-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColorMap[statusMeta.color]}`}>
              <StatusIcon status={f.currentStatus} className="h-3 w-3" /> {statusMeta.label}
            </span>
          </div>
        )}
        {f.accepted?.length > 0 && (
          <div className="mt-1 text-[11px] text-neutral-700">
            <span className="font-semibold">Accepts:</span> {f.accepted.slice(0, 5).join(' · ')}{f.accepted.length > 5 ? ` +${f.accepted.length - 5}` : ''}
          </div>
        )}
        {f.notAccepted?.length > 0 && (
          <div className="mt-0.5 text-[11px] text-red-700">
            <span className="font-semibold">No:</span> {f.notAccepted.slice(0, 4).join(' · ')}{f.notAccepted.length > 4 ? ` +${f.notAccepted.length - 4}` : ''}
          </div>
        )}
        {f.contractorNotes?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {f.contractorNotes.slice(0, 5).map((n) => (
              <span key={n} className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
                {n}
              </span>
            ))}
          </div>
        )}
        {f.tags?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {f.tags.slice(0, 6).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
            ))}
            {f.tags.length > 6 && (
              <span className="text-[10px] text-neutral-400">+{f.tags.length - 6}</span>
            )}
          </div>
        )}
        {f.hours && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-neutral-500"><Clock className="h-3 w-3" /> {f.hours}</div>
        )}
      </div>
    </div>
  )
}
