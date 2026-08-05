'use client'

// LayoutPreferenceCard — desktop/mobile canvas override (the P4 segmented
// toggle) wrapped in a labeled settings card.

import { Card, CardContent } from '@/components/ui/card'
import LayoutModeToggle from '@/components/LayoutModeToggle'

export default function LayoutPreferenceCard() {
  return (
    <Card className="mt-4">
      <CardContent className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-bold text-neutral-900">Layout preference</div>
            <div className="mt-0.5 text-xs text-neutral-500">Force a desktop or mobile canvas across DumpMaps, or let it auto-detect your device. Synced across devices when signed in.</div>
          </div>
          <LayoutModeToggle variant="segmented" className="w-full shrink-0 sm:w-auto" />
        </div>
      </CardContent>
    </Card>
  )
}
