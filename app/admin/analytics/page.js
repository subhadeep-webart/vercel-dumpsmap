'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Flame, Zap, Users, Store, Briefcase, Activity } from 'lucide-react'

function List({ title, icon: Icon, items, renderItem, emptyText = 'No data yet.' }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4 text-brand-600" />{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {(!items || items.length === 0) && <div className="text-xs text-neutral-500">{emptyText}</div>}
        <ul className="divide-y divide-neutral-100">
          {(items || []).map((it, i) => (
            <li key={i} className="py-1.5 text-sm">{renderItem(it)}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export default function AdminAnalytics() {
  const { authFetch } = useAdmin()
  const [data, setData] = useState(null)
  useEffect(() => {
    (async () => {
      const r = await authFetch('/api/admin/analytics')
      const j = await r.json()
      setData(j)
    })()
  }, [authFetch])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Analytics</h1>
        <p className="text-sm text-neutral-500">Trending facilities, busiest spots, most-active users, content trends.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <List
          title="Trending facilities (most active alerts)"
          icon={TrendingUp}
          items={data?.trendingFacilities}
          renderItem={(f) => (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0"><div className="truncate font-medium">{f.name}</div><div className="text-[11px] text-neutral-500">{f.type}</div></div>
              <Badge variant="outline" className="inline-flex items-center gap-1"><Flame className="h-3 w-3" /> {f.activeAlertCount}</Badge>
            </div>
          )}
        />
        <List
          title="Busiest facilities (wait time / full / long line)"
          icon={Flame}
          items={data?.busiestFacilities}
          renderItem={(f) => (
            <div className="flex items-center justify-between gap-2"><div className="truncate">{f.name}</div><Badge variant="outline">{f.activeAlertCount}</Badge></div>
          )}
        />
        <List
          title="Fastest moving (good news)"
          icon={Zap}
          items={data?.fastestMoving}
          renderItem={(f) => (
            <div className="truncate text-sm">{f.name} <span className="text-[11px] text-neutral-500">· {f.type}</span></div>
          )}
        />
        <List
          title="Most active users (last 30d)"
          icon={Users}
          items={data?.mostActiveUsers}
          renderItem={(u) => (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0"><div className="truncate font-medium">{u.name || u.email}</div><div className="text-[11px] text-neutral-500">{u.email}</div></div>
              <Badge variant="outline">{u.alertsPosted} alerts</Badge>
            </div>
          )}
        />
        <List
          title="Top marketplace categories"
          icon={Store}
          items={data?.topMarketCategories}
          renderItem={(c) => (
            <div className="flex items-center justify-between gap-2"><div>{c.category}</div><Badge variant="outline">{c.count}</Badge></div>
          )}
        />
        <List
          title="Active jobs by category"
          icon={Briefcase}
          items={data?.activeJobsByCategory}
          renderItem={(c) => (
            <div className="flex items-center justify-between gap-2"><div>{c.category}</div><Badge variant="outline">{c.count}</Badge></div>
          )}
        />
        <List
          title="Top alert types (last 7d)"
          icon={Activity}
          items={data?.topAlertTypes}
          renderItem={(c) => (
            <div className="flex items-center justify-between gap-2"><div>{c.type}</div><Badge variant="outline">{c.count}</Badge></div>
          )}
        />
      </div>
    </div>
  )
}
