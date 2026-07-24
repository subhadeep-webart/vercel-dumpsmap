'use client'

// /facilities — standalone facilities directory page.
//
// Before this page existed, /facilities returned a 404 because we only had
// /app/app/facilities/[id]/page.js (the detail view). We reuse the proven
// <FacilitiesTab /> component from HomeShell so the cards, filters, search,
// near-me, and load logic are 100% identical to what users already see in
// the in-app feed.
//
// Navigation:
//   • Logo → /dashboard (logged in) or / (logged out) via <HomeBrandLink />.
//   • Facility card click → router.push('/facilities/:id') (the real detail page).
//   • Map view toggle → router.push('/?view=map') so the existing MapView UI
//     in app/page.js still renders the geographic browser.

import React from 'react'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RouteFeatureLock from '@/components/RouteFeatureLock'
import { FacilitiesTab } from '@/components/HomeShell'
import FacilitiesHero from '@/components/facilities/FacilitiesHero'

export default function FacilitiesIndexPage() {
  return (
    <RouteFeatureLock featureKey="facilities">
      <FacilitiesIndexInner />
    </RouteFeatureLock>
  )
}

function FacilitiesIndexInner() {
  const router = useRouter()

  return (
    <div className="min-h-[100dvh] bg-neutral-50">
      <AppHeader active="facilities" />

      {/* HERO */}
      <FacilitiesHero onOpenMap={() => router.push('/?view=map')} />

      {/* DIRECTORY */}
      <section className="container mx-auto px-4 py-6 sm:py-8">
        <FacilitiesTab
          onFacilityOpen={(id) => router.push(`/facilities/${id}`)}
          onOpenMap={() => router.push('/?view=map')}
        />
      </section>
    </div>
  )
}
