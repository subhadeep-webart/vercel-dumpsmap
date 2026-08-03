'use client'

// Loading / error shells for the profile editor. Wrapped in the same PageShell
// so the header + layout stay consistent with the ready state.

import React from 'react'
import PageShell from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'

export function ProfileSkeleton() {
  return (
    <PageShell active="profile" maxWidth={null} padding="" bg="bg-neutral-50">
      <div className="h-40 w-full animate-pulse bg-neutral-200 sm:h-56" />
      <div className="container mx-auto -mt-12 px-4 sm:-mt-14">
        <div className="flex items-end gap-3">
          <div className="h-24 w-24 animate-pulse rounded-full border-4 border-white bg-neutral-200 sm:h-28 sm:w-28" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-32 animate-pulse rounded bg-neutral-200" />
          </div>
        </div>
      </div>
      <div className="container mx-auto mt-8 grid gap-4 px-4 md:grid-cols-3">
        <div className="space-y-3 md:col-span-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white shadow-sm" />)}
        </div>
        <div className="space-y-3"><div className="h-32 animate-pulse rounded-xl bg-white shadow-sm" /></div>
      </div>
      <div className="container mx-auto mt-6 flex items-center gap-2 px-4 text-xs text-neutral-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading profile…
      </div>
    </PageShell>
  )
}

export function ProfileError({ onRetry }) {
  return (
    <PageShell active="profile" maxWidth="max-w-md">
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <AlertCircle className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="text-lg font-bold">Couldn&apos;t load your profile</h2>
          <p className="text-sm text-neutral-600">Check your connection and try again.</p>
          <Button onClick={onRetry} className="bg-green-700 hover:bg-green-800"><RefreshCw className="mr-1.5 h-4 w-4" /> Retry</Button>
        </CardContent>
      </Card>
    </PageShell>
  )
}
