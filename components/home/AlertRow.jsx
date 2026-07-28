'use client'

// Single live-community-alert row in the Feed tab.
// Extracted from HomeShell.jsx.

import { BadgeCheck, Bell, ChevronRight, Clock, Truck, Recycle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ALERT_TYPE_LABEL } from '@/constants/facility_constants'

const timeAgo = (d) => {
  if (!d) return ''
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return Math.floor(diff / 86400) + 'd ago'
}

export default function AlertRow({ alert, onFacilityOpen }) {
  const severity = alert.severity || 'medium'
  const sevColor =
    severity === 'high' ? 'border-red-300 bg-red-50' :
    severity === 'low' ? 'border-brand-200 bg-brand-50' :
    'border-amber-200 bg-amber-50'
  return (
    <button
      onClick={() => alert.facilityId && onFacilityOpen?.(alert.facilityId)}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition active:bg-neutral-50 ${sevColor}`}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm">
        {alert.isOfficial ? <BadgeCheck className="h-4 w-4 text-brand-600" /> : <Bell className="h-4 w-4 text-orange-600" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="bg-white text-[10px]">
            {ALERT_TYPE_LABEL[alert.type] || alert.type}
          </Badge>
          {alert.isOfficial && <Badge className="bg-brand-100 text-[10px] text-brand-800">Official</Badge>}
          <span className="ml-auto text-[10px] text-neutral-500">{timeAgo(alert.createdAt)}</span>
        </div>
        <div className="mt-1 text-sm font-semibold text-neutral-900">{alert.facilityName || 'Facility'}</div>
        <div className="mt-0.5 line-clamp-2 text-xs text-neutral-700">{alert.text || ''}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
          {alert.waitMinutes != null && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> ~{alert.waitMinutes} min wait</span>}
          {alert.truckCount != null && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" /> {alert.truckCount} trucks</span>}
          {alert.material && <span className="inline-flex items-center gap-1"><Recycle className="h-3 w-3" /> {alert.material}</span>}
          {alert.user?.name && <span>· by {alert.user.name}</span>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
    </button>
  )
}
