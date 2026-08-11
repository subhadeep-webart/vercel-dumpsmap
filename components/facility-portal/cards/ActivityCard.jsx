'use client'

// ActivityCard — Recent Updates & Reports. A lightweight mixed feed of what's
// happened at the facility: the latest pricing update (owner edit) and recent
// alerts / user reports (facility.activeAlerts). Read-only in v1 (no reporting
// write API from the owner side — see dev doc §5); "View All" deep-links to the
// public facility page where the full history + reports live.

import Link from 'next/link'
import { DollarSign, Flag, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PortalCard from '../PortalCard'
import { timeAgo } from '../portal-helpers'

// Build a normalized, time-sorted feed from the facility record.
function buildFeed(facility) {
  const items = []

  if (facility?.pricing?.lastUpdated) {
    items.push({
      id: 'pricing-update',
      icon: DollarSign,
      tone: 'bg-green-50 text-green-600',
      title: 'You updated prices',
      detail: 'Pricing published',
      at: facility.pricing.lastUpdated,
    })
  }

  for (const a of facility?.activeAlerts || []) {
    const isReport = !(a.official || a.type === 'OWNER_UPDATE')
    items.push({
      id: a.id,
      icon: isReport ? Flag : Megaphone,
      tone: isReport ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600',
      title: isReport ? 'User Report' : 'Announcement',
      detail: a.text || a.message || String(a.type || '').replace(/_/g, ' '),
      at: a.createdAt,
    })
  }

  return items
    .filter((i) => i.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8)
}

export default function ActivityCard({ facility, index = 0 }) {
  const feed = buildFeed(facility)

  return (
    <PortalCard
      id="activity"
      title="Recent Updates & Reports"
      index={index}
      action={
        <Link href={`/facilities/${facility?.id}`}>
          <Button variant="outline" size="sm">View All</Button>
        </Link>
      }
    >
      <p className="mb-4 text-sm text-neutral-500">See what the community is saying and what you&apos;ve updated.</p>
      {feed.length ? (
        <ul className="space-y-3">
          {feed.map((i) => {
            const Icon = i.icon
            return (
              <li key={i.id} className="flex items-start gap-3">
                <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${i.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral-900">{i.title}</div>
                  <div className="truncate text-xs text-neutral-500">{i.detail}</div>
                </div>
                <span className="shrink-0 text-[11px] text-neutral-400">{timeAgo(i.at)}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-center text-sm text-neutral-500">
          No recent activity yet.
        </div>
      )}
    </PortalCard>
  )
}
