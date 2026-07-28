'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Star, ArrowLeft, MapPin, Search, Sparkles } from 'lucide-react'
import { FACILITY_TYPE_CONFIG } from '@/lib/facility-types'
import { TypeIcon } from '@/lib/facility-icons'
import PageShell from '@/components/PageShell'

export default function TopFacilitiesPage() {
  const [facilities, setFacilities] = useState([])
  const [q, setQ] = useState('')
  const [typeKey, setTypeKey] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (typeKey) params.set('typeKey', typeKey)
    params.set('limit', '60')
    const r = await fetch(`/api/recommendations/facilities?${params.toString()}`)
    const j = await r.json()
    let list = j.facilities || []
    if (q) {
      const t = q.toLowerCase()
      list = list.filter((f) => (f.name || '').toLowerCase().includes(t) || (f.city || '').toLowerCase().includes(t))
    }
    setFacilities(list)
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-line */ }, [typeKey])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) /* eslint-disable-line */ }, [q])

  return (
    <PageShell active="facilities" breadcrumbs={[{ label: 'Recommendations', href: '/recommendations' }, { label: 'Facilities' }]} maxWidth="max-w-4xl">
      <div className="container mx-auto px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by facility name or city" className="pl-7" />
          </div>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setTypeKey('')} className={`rounded-full border px-2 py-0.5 text-[11px] ${!typeKey ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-neutral-600'}`}>All types</button>
            {Object.entries(FACILITY_TYPE_CONFIG || {}).slice(0, 8).map(([k, v]) => (
              <button key={k} onClick={() => setTypeKey(k)} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${typeKey === k ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'}`}><TypeIcon typeKey={k} className="h-3.5 w-3.5" /> {v.label}</button>
            ))}
          </div>
        </div>
        <p className="mb-2 flex items-center gap-1 text-[11px] text-neutral-500">{loading ? 'Loading…' : <>{`${facilities.length} facility${facilities.length === 1 ? '' : 'ies'} rated 3.5`}<Star className="h-3 w-3 fill-amber-500 text-amber-500" />{' or higher'}</>}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((f) => (
            <Link key={f.id} href={`/facilities/${f.id}`} className="block">
              <Card className="h-full transition hover:border-neutral-300 hover:shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold">{f.name}</h3>
                      <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                        {f.rating ? f.rating.toFixed(1) : ''}
                        {f.reviewsCount > 0 && <span>({f.reviewsCount})</span>}
                        {f.city && <span className="inline-flex items-center gap-0.5">· <MapPin className="h-2.5 w-2.5" /> {f.city}{f.state ? `, ${f.state}` : ''}</span>}
                      </div>
                    </div>
                    {f.claimed && <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700">Verified owner</Badge>}
                  </div>
                  {Array.isArray(f.accepted) && f.accepted.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {f.accepted.slice(0, 4).map((a, i) => <Badge key={i} variant="outline" className="text-[10px]">{a}</Badge>)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {!loading && facilities.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Sparkles className="mx-auto h-7 w-7 text-neutral-400" />
            <p className="mt-2 flex items-center justify-center gap-1 text-sm text-neutral-600">No facilities meet the 3.5<Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> bar yet.</p>
            <p className="mt-1 text-xs text-neutral-500">Review a facility you’ve used — it helps the whole community.</p>
          </div>
        )}
      </div>
    </PageShell>
  )
}
