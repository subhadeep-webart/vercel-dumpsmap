'use client'

// Client-only loader for FacilityMap. Leaflet must not run during SSR, so the
// interactive map is imported with ssr:false and shows a neutral placeholder
// while its chunk loads. Import THIS wherever the map is rendered.

import dynamic from 'next/dynamic'

const FacilityMap = dynamic(() => import('./FacilityMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[240px] w-full animate-pulse items-center justify-center rounded-2xl bg-neutral-100 text-xs text-neutral-400">
      Loading map…
    </div>
  ),
})

export default FacilityMap
