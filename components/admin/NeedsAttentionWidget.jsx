'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, ChevronRight, CheckCircle2 } from 'lucide-react'
import { useAdmin } from '@/components/admin/AdminContext'

/**
 * NeedsAttentionWidget — admin "command center" panel.
 * Pulls from GET /api/admin/notification-counts.
 * Refreshes every 12s.
 */
export default function NeedsAttentionWidget() {
  const { authFetch } = useAdmin()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const r = await authFetch('/api/admin/notification-counts')
        if (!r.ok) return
        const j = await r.json()
        if (mounted) setData(j)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 12000)
    return () => { mounted = false; clearInterval(id) }
  }, [authFetch])

  if (loading && !data) {
    return <Card><CardContent className="p-6 text-center text-sm text-neutral-500">Loading queue…</CardContent></Card>
  }
  if (!data) return null

  const items = data.needsAttention || []
  const total = data.totals?.all || 0
  const urgent = data.totals?.urgent || 0
  const allClear = total === 0

  return (
    <Card className={urgent > 0 ? 'border-red-200 bg-red-50/30' : allClear ? 'border-brand-200 bg-brand-50/30' : 'border-amber-200 bg-amber-50/30'}>
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {allClear
              ? <CheckCircle2 className="h-5 w-5 text-brand-600" />
              : <AlertTriangle className={`h-5 w-5 ${urgent > 0 ? 'text-red-600' : 'text-amber-600'}`} />}
            <div>
              <div className="text-sm font-extrabold">
                {allClear ? 'All clear — nothing needs attention right now' : 'Needs Attention'}
              </div>
              <div className="text-[11px] text-neutral-500">
                {allClear
                  ? 'Queues are empty. Updates refresh every 12 seconds.'
                  : `${total} item${total === 1 ? '' : 's'} pending${urgent > 0 ? ` · ${urgent} urgent` : ''}`}
              </div>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-neutral-400">Auto-refreshes</span>
        </div>
        {!allClear && (
          <ul className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {items.filter((i) => i.count > 0).map((i) => (
              <li key={i.key}>
                <Link href={i.href} className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-neutral-50">
                  <span className={`flex h-7 w-10 items-center justify-center rounded-md text-xs font-extrabold ${i.urgent ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {i.count > 99 ? '99+' : i.count}
                  </span>
                  <span className="flex-1 truncate">{i.label}</span>
                  {i.urgent && <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Urgent</span>}
                  <ChevronRight className="h-4 w-4 text-neutral-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
