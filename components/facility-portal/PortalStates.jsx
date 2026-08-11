'use client'

// Loading / error / no-facility states for the Facility Portal. Kept out of the
// page so the orchestration file stays a thin switch (per the hooks/components
// split). The skeleton echoes the real layout (sidebar + hero + status strip +
// stacked cards) so there's no jarring reflow when data arrives.

import Link from 'next/link'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PORTAL_COPY } from '@/constants/facility_portal_constants'

function Block({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-neutral-200/70 ${className}`} />
}

export function PortalSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-brand-surface">
      <div className="h-14 border-b border-neutral-200 bg-white" />
      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 space-y-2 lg:block">
          {Array.from({ length: 8 }).map((_, i) => <Block key={i} className="h-9" />)}
        </aside>
        <div className="min-w-0 flex-1 space-y-5">
          <Block className="h-40" />
          <Block className="h-24" />
          <Block className="h-52" />
          <Block className="h-40" />
        </div>
      </div>
    </div>
  )
}

export function PortalError({ onRetry }) {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center bg-brand-surface px-4">
      <Card className="max-w-md">
        <CardContent className="space-y-3 p-6 text-center">
          <h2 className="text-lg font-extrabold tracking-tight text-neutral-900">Couldn&apos;t load your portal</h2>
          <p className="text-sm text-neutral-600">Something went wrong fetching your facilities. Check your connection and try again.</p>
          <Button onClick={onRetry} className="mt-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function PortalNoFacility() {
  const { icon: Icon, title, body, cta, href } = PORTAL_COPY.noFacility
  return (
    <div className="flex min-h-[70dvh] items-center justify-center bg-brand-surface px-4">
      <Card className="max-w-lg border-amber-200 bg-amber-50/40">
        <CardContent className="space-y-3 p-7 text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Icon className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-extrabold tracking-tight text-neutral-900">{title}</h2>
          <p className="mx-auto max-w-md text-sm text-neutral-600">{body}</p>
          <Link href={href}>
            <Button className="mt-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700">{cta}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

export function PortalRedirecting() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-brand-surface text-sm text-neutral-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening your portal…
    </div>
  )
}
