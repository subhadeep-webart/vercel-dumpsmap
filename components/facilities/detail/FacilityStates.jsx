'use client'

// Loading skeleton, not-found, and generic error states for the facility detail
// page. Extracted from app/facilities/[id]/page.js.

import Link from 'next/link'
import PageShell from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, MapPin, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react'

export function FacilityDetailSkeleton({ onBack }) {
  return (
    <PageShell active="facilities" maxWidth={null} padding="" bg="bg-neutral-50">
      <div className="relative h-48 w-full animate-pulse bg-neutral-200 sm:h-64 md:h-80" />
      <div className="border-b border-neutral-200 bg-white">
        <div className="container mx-auto flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="h-6 w-24 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-6 w-32 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-6 w-28 animate-pulse rounded-full bg-neutral-200" />
        </div>
      </div>
      <main className="container mx-auto grid gap-4 px-4 py-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="space-y-2 p-5">
              <div className="h-4 w-1/4 animate-pulse rounded bg-neutral-200" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200" />
            </CardContent></Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card><CardContent className="space-y-2 p-5">
            <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-full animate-pulse rounded bg-neutral-200" />
          </CardContent></Card>
        </div>
      </main>
      <div className="container mx-auto flex items-center gap-2 px-4 pb-10 text-xs text-neutral-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading facility…
      </div>
    </PageShell>
  )
}

export function FacilityNotFound({ onBack, onRetry, id }) {
  return (
    <PageShell active="facilities" maxWidth={null} padding="">
      <main className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-md">
          <CardContent className="space-y-3 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <MapPin className="h-6 w-6 text-neutral-400" />
            </div>
            <h1 className="text-lg font-bold text-neutral-900">Facility not found</h1>
            <p className="text-sm text-neutral-600">
              We couldn't find a facility with the ID <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">{id}</code>.
            </p>
            <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-center">
              <Button asChild className="bg-green-700 hover:bg-green-800">
                <Link href="/facilities"><ArrowRight className="mr-1.5 h-4 w-4 rotate-180" /> Browse facilities</Link>
              </Button>
              <Button variant="outline" onClick={onRetry}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </PageShell>
  )
}

export function FacilityErrorState({ title, detail, onBack, onRetry }) {
  return (
    <PageShell active="facilities" maxWidth={null} padding="">
      <main className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-md">
          <CardContent className="space-y-3 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <h1 className="text-lg font-bold text-neutral-900">{title}</h1>
            <p className="text-sm text-neutral-600">{detail}</p>
            <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-center">
              <Button onClick={onRetry} className="bg-green-700 hover:bg-green-800">
                <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
              </Button>
              <Button asChild variant="outline">
                <Link href="/facilities">Browse facilities</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </PageShell>
  )
}
