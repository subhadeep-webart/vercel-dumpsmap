'use client'

// /dashboard — Smart entrypoint. Picks the right role-specific dashboard
// based on the user's profileType / role. Logged-out users land on
// /activity-hub (public). Defaults to /dashboard/resident.
//
// The page itself is intentionally thin: the fetch + redirect lifecycle lives
// in useDashboardRedirect, and the role → route decision is a pure helper
// (lib/dashboard-routing). All this component renders is a dashboard-shaped
// skeleton while the redirect resolves.

import React from 'react'
import AppHeader from '@/components/AppHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardRedirect } from '@/hooks/use-dashboard-redirect'

export default function DashboardEntrypoint() {
  useDashboardRedirect()
  return <DashboardEntrySkeleton />
}

// A shimmer preview shaped like a real dashboard (hero + KPI row + sections),
// so the hand-off to the resolved role dashboard feels continuous instead of
// flashing a bare spinner. Cards cascade in with the shared dm-rise-in stagger.
function DashboardEntrySkeleton() {
  return (
    <div className="min-h-[100dvh] bg-neutral-50" aria-busy="true" aria-label="Opening your dashboard">
      <AppHeader />

      {/* Hero band — mirrors DashboardShell's header */}
      <section className="border-b border-neutral-200 bg-gradient-to-br from-white via-white to-emerald-50/30">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-3 w-28 bg-emerald-200/50" />
              <Skeleton className="h-7 w-56 sm:h-8 sm:w-72" />
              <Skeleton className="h-3.5 w-64 sm:w-80" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-6 pb-24">
        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="dm-rise-in border-neutral-200/80" style={{ '--dm-i': i }}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-2.5 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Two skeleton sections (header + card grid) */}
        {[0, 1].map((section) => (
          <div key={section} className="mt-6">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-2.5 w-52" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="dm-rise-in border-neutral-200/80" style={{ '--dm-i': i + 1 }}>
                  <CardContent className="space-y-2 p-3.5">
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
