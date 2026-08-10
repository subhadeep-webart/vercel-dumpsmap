'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Star, BadgeCheck, MapPin, Search } from 'lucide-react'
import PageShell from '@/components/PageShell'
import { useContractorRecommendations } from '@/hooks/use-recommendations'
import { deriveCities, isVerified } from '@/lib/recommendations-helpers'
import { CARD_BADGE_LIMIT } from '@/constants/recommendations_constants'

export default function ContractorsDirectoryPage() {
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  // Debounce the search/city filters (250ms) before they reach the API — mirrors
  // the original page's setTimeout-guarded load so typing doesn't fire a request
  // per keystroke.
  const [debouncedQ, setDebouncedQ] = useState('')
  const [debouncedCity, setDebouncedCity] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setDebouncedCity(city) }, 250)
    return () => clearTimeout(t)
  }, [q, city])

  const { contractors, loading } = useContractorRecommendations(debouncedQ, debouncedCity)

  const cities = useMemo(() => deriveCities(contractors), [contractors])

  return (
    <PageShell active="feed" breadcrumbs={[{ label: 'Recommendations', href: '/recommendations' }, { label: 'Contractors' }]} maxWidth="max-w-4xl">
      <div className="container mx-auto px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, service, or city" className="pl-7" />
          </div>
          <div className="flex flex-wrap gap-1">
            {cities.length > 0 && (
              <button onClick={() => setCity('')} className={`rounded-full border px-2 py-0.5 text-[11px] ${!city ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-neutral-600'}`}>All cities</button>
            )}
            {cities.map((c) => (
              <button key={c} onClick={() => setCity(c)} className={`rounded-full border px-2 py-0.5 text-[11px] ${city === c ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'}`}>{c}</button>
            ))}
          </div>
        </div>
        <p className="mb-2 text-[11px] text-neutral-500">{loading ? 'Loading…' : `${contractors.length} contractor${contractors.length === 1 ? '' : 's'}`}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {contractors.map((c) => (
            <Link key={c.id} href={`/recommendations/contractors/${c.id}`} className="block">
              <Card className="h-full transition hover:border-neutral-300 hover:shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">{(c.name || '?')[0].toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-sm font-bold">
                        <span className="truncate">{c.name}</span>
                        {isVerified(c.verificationLevel) && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                        {c.contractorRating ? c.contractorRating.toFixed(1) : 'New'}
                        {c.contractorReviewCount > 0 && <span>({c.contractorReviewCount})</span>}
                        {c.completedJobs > 0 && <span>· {c.completedJobs} jobs</span>}
                      </div>
                      {c.city && <div className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-neutral-500"><MapPin className="h-2.5 w-2.5" /> {c.city}{c.state ? `, ${c.state}` : ''}</div>}
                    </div>
                  </div>
                  {c.bio && <p className="mt-1.5 line-clamp-2 text-[11px] text-neutral-600">{c.bio}</p>}
                  {Array.isArray(c.services) && c.services.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.services.slice(0, CARD_BADGE_LIMIT).map((s, i) => <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {!loading && contractors.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Search className="mx-auto h-8 w-8 text-neutral-400" />
            <p className="mt-2 text-sm text-neutral-600">No contractors match your search yet.</p>
            <p className="mt-1 text-xs text-neutral-500">Tip: contractors appear here once they complete jobs and receive reviews.</p>
          </div>
        )}
      </div>
    </PageShell>
  )
}
