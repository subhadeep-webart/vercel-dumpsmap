'use client'

// FacilityLiveStatusBadge
// ----------------------------------------------------------------------------
// Pill shown on facility list cards and detail page header. Displays the
// current liveStatus + last-update timestamp, mirroring the Waze "current
// condition" pattern. Pulls from the facility doc fields populated by
// QuickCheckInModal → /api/activity-hub/posts.

import React from 'react'
import { Activity } from 'lucide-react'

const META = {
  not_busy:      { label: 'No Wait',     tone: 'bg-emerald-100 text-emerald-800 ring-emerald-300' },
  slow:          { label: 'Light Wait',  tone: 'bg-yellow-100 text-yellow-800 ring-yellow-300' },
  busy:          { label: 'Moderate',    tone: 'bg-orange-100 text-orange-800 ring-orange-300' },
  long_wait:     { label: 'Heavy Wait',  tone: 'bg-red-100 text-red-800 ring-red-300' },
  very_busy:     { label: 'Very Heavy',  tone: 'bg-red-200 text-red-900 ring-red-400' },
  closed:        { label: 'Closed',      tone: 'bg-neutral-200 text-neutral-700 ring-neutral-300' },
  gate_closed:   { label: 'Gate Closed', tone: 'bg-red-100 text-red-800 ring-red-300' },
  scale_issue:   { label: 'Scale Issue', tone: 'bg-amber-100 text-amber-800 ring-amber-300' },
  accepting:     { label: 'Accepting',   tone: 'bg-emerald-100 text-emerald-800 ring-emerald-300' },
  not_accepting: { label: 'Restricted',  tone: 'bg-red-100 text-red-800 ring-red-300' },
  price_update:  { label: 'Price Update', tone: 'bg-violet-100 text-violet-800 ring-violet-300' },
  safety_alert:  { label: 'Safety Alert', tone: 'bg-red-200 text-red-900 ring-red-400' },
}

export default function FacilityLiveStatusBadge({ facility, size = 'sm' }) {
  const status = facility?.liveStatus
  if (!status) return null
  const m = META[status] || { label: status.replace(/_/g, ' '), tone: 'bg-neutral-100 text-neutral-700 ring-neutral-300' }
  const updated = timeAgo(facility.liveStatusUpdatedAt)
  const px = size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider ring-1 ${m.tone} ${px}`}>
      <Activity className="h-3 w-3" /> {m.label}
      {updated && <span className="ml-1 opacity-70">· {updated}</span>}
    </span>
  )
}

function timeAgo(d) {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  if (ms < 0) return ''
  const min = Math.round(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60); if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
