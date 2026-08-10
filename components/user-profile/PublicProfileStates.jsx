'use client'

// Loading / error / not-found / private states for the public profile page.
// Visually consistent with the profile editor's states + the app's green theme.

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UserX, Lock, AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

// Full-page skeleton mimicking the hero → actions → feed layout so the load
// feels like the real page settling in, not a spinner popping.
export function PublicProfileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-44 w-full bg-gradient-to-br from-neutral-200 to-neutral-100 sm:h-60" />
      <div className="container mx-auto px-4">
        <div className="-mt-14 flex flex-col items-center gap-3 sm:-mt-16 sm:flex-row sm:items-end sm:gap-5">
          <div className="h-28 w-28 shrink-0 rounded-full border-4 border-white bg-neutral-200 sm:h-36 sm:w-36" />
          <div className="w-full space-y-2 sm:pb-3">
            <div className="mx-auto h-6 w-48 rounded bg-neutral-200 sm:mx-0" />
            <div className="mx-auto h-4 w-64 rounded bg-neutral-100 sm:mx-0" />
          </div>
        </div>
        <div className="mt-5 flex justify-center gap-2 sm:justify-start">
          <div className="h-9 w-28 rounded-lg bg-neutral-200" />
          <div className="h-9 w-24 rounded-lg bg-neutral-100" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-neutral-100" />)}
        </div>
      </div>
    </div>
  )
}

// Shared centered card for the terminal states below.
function CenteredState({ icon: Icon, tone, title, detail, children }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="dm-rise-in w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className={`mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-bold text-neutral-900">{title}</h1>
        <p className="mt-1.5 text-sm text-neutral-500">{detail}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{children}</div>
      </div>
    </div>
  )
}

export function PublicProfileNotFound() {
  return (
    <CenteredState
      icon={UserX}
      tone="bg-neutral-100 text-neutral-500"
      title="Profile not found"
      detail="This member doesn't exist or their profile is no longer available."
    >
      <Button asChild variant="outline"><Link href="/"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back home</Link></Button>
      <Button asChild className="bg-green-600 hover:bg-green-700"><Link href="/community">Explore community</Link></Button>
    </CenteredState>
  )
}

export function PublicProfileError({ onRetry }) {
  return (
    <CenteredState
      icon={AlertTriangle}
      tone="bg-amber-100 text-amber-600"
      title="Couldn't load this profile"
      detail="Something went wrong reaching the server. Check your connection and try again."
    >
      <Button onClick={onRetry} className="bg-green-600 hover:bg-green-700"><RefreshCw className="mr-1.5 h-4 w-4" /> Retry</Button>
    </CenteredState>
  )
}

// Shown when a profile is private and the viewer isn't the owner. Still renders
// the avatar/name stub above it (handled by the page), so this is the body only.
export function PublicProfilePrivate({ name }) {
  return (
    <CenteredState
      icon={Lock}
      tone="bg-neutral-100 text-neutral-500"
      title="This profile is private"
      detail={`${name || 'This member'} keeps their profile private. Only they can see their full details, posts, and listings.`}
    >
      <Button asChild variant="outline"><Link href="/community">Back to community</Link></Button>
    </CenteredState>
  )
}
