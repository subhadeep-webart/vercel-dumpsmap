'use client'

// /activity-hub — DumpMaps Activity Hub (Option 2 redesign)
//
// Thin orchestration component. Data reads live in hooks/use-activity-hub
// (useSWRInfinite feed); writes in hooks/use-activity-hub-actions; constants in
// constants/activity_hub_constants; presentation in components/activity-hub/*.
// This file only wires them together and lays out the page.
//
// Logged-in home feed. Replaces separate Live Feed + Community surfaces.
// Mobile-first; clean visual cards; story-style filter bar; FAB composer.

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import RouteFeatureLock from '@/components/RouteFeatureLock'
import ActivityHubInner from '@/components/activity-hub/ActivityHubInner'

export default function ActivityHubPage() {
  return (
    <RouteFeatureLock featureKey="activityHub">
      {/* Suspense boundary required by Next 15 for useSearchParams() inside
          ActivityHubInner (reads ?filter= from the URL). */}
      <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}>
        <ActivityHubInner />
      </Suspense>
    </RouteFeatureLock>
  )
}


