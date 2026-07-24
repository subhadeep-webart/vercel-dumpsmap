'use client'

// FacilityStatusHistory
// ----------------------------------------------------------------------------
// Renders the most recent community check-ins for a facility on the detail page.
// Pulls from GET /api/facilities/:id/updates (added Sprint A enhancement).
// Each row: status pill + author name + "X min ago" + optional photo thumbnail.

import React, { useEffect, useState } from 'react'
import SafeImage from '@/components/SafeImage'
import { Activity, MessageSquare } from 'lucide-react'

// Color map mirroring the wait-time pills users tap in QuickCheckInModal.
const SIGNAL_META = {
  not_busy:      { dot: 'bg-emerald-500', label: 'No Wait' },
  slow:          { dot: 'bg-yellow-400',  label: 'Light Wait' },
  busy:          { dot: 'bg-orange-500',  label: 'Moderate' },
  long_wait:     { dot: 'bg-red-500',     label: 'Heavy Wait' },
  very_busy:     { dot: 'bg-red-700',     label: 'Very Heavy' },
  closed:        { dot: 'bg-neutral-500', label: 'Closed' },
  gate_closed:   { dot: 'bg-red-500',     label: 'Gate Closed' },
  scale_issue:   { dot: 'bg-amber-500',   label: 'Scale Issue' },
  accepting:     { dot: 'bg-emerald-500', label: 'Accepting' },
  not_accepting: { dot: 'bg-red-500',     label: 'Material Restriction' },
  price_update:  { dot: 'bg-violet-500',  label: 'Price Update' },
  safety_alert:  { dot: 'bg-red-700',     label: 'Safety Alert' },
}

function timeAgo(d) {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  if (ms < 0) return 'just now'
  const min = Math.round(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60); if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function FacilityStatusHistory({ facilityId, refreshKey = 0, limit = 10 }) {
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!facilityId) return undefined
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const r = await fetch(`/api/facilities/${facilityId}/updates?limit=${limit}`)
        const j = await r.json()
        if (!cancelled && r.ok) setUpdates(Array.isArray(j.updates) ? j.updates : [])
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [facilityId, refreshKey, limit])

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-700">Recent Updates</h3>
        {updates.length > 0 && <span className="text-[10px] text-neutral-400">· {updates.length}</span>}
      </div>

      {loading ? (
        <div className="py-2 text-xs text-neutral-400">Loading recent activity…</div>
      ) : updates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-3 text-center text-xs text-neutral-500">
          No check-ins yet. Be the first — tap <b>Check In</b> above to report the wait time.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {updates.map((u) => {
            const meta = SIGNAL_META[u.signal] || { dot: 'bg-neutral-400', label: u.signal || 'Update' }
            return (
              <li key={u.id} className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 text-sm">
                    <span className="font-bold text-neutral-900">{meta.label}</span>
                    <span className="text-neutral-500">·</span>
                    <span className="truncate text-neutral-700">{u.author?.name || 'User'}</span>
                    <span className="text-neutral-400">·</span>
                    <span className="shrink-0 text-[11px] text-neutral-500">{timeAgo(u.createdAt)}</span>
                  </div>
                  {u.body && u.body !== meta.label && (
                    <div className="mt-0.5 flex items-start gap-1 text-xs text-neutral-600">
                      <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-neutral-400" />
                      <span className="line-clamp-2">{u.body}</span>
                    </div>
                  )}
                  {u.photos?.[0] && (
                    <SafeImage src={u.photos[0]} alt="" className="mt-1.5 h-24 w-24 rounded-md object-cover" />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
