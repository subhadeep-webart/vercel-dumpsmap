'use client'

import { useState } from 'react'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import PostItemDialog from '@/components/marketplace/PostItemDialog'
import QuickViewModal from '@/components/marketplace/QuickViewModal'
import ContactSellerModal from '@/components/marketplace/ContactSellerModal'
import CommercialB2BTab from '@/components/marketplace/CommercialB2BTab'
import MarketplaceHeader from '@/components/marketplace/MarketplaceHeader'
import MarketplaceSubNav from '@/components/marketplace/MarketplaceSubNav'
import FilterSidebar from '@/components/marketplace/FilterSidebar'
import ListingsPanel from '@/components/marketplace/ListingsPanel'
import MarketplaceRightRail from '@/components/marketplace/MarketplaceRightRail'
import AudienceBar from '@/components/marketplace/AudienceBar'
import ActiveFilterChips from '@/components/facilities/ActiveFilterChips'
import FeatureLock from '@/components/FeatureLock'
import { SoftLoginModal } from '@/components/SoftLoginModal'
import { CATEGORIES, CONDITIONS } from '@/constants/marketplace_constants'
import { useMarketplace } from '@/hooks/use-marketplace'

// Container: owns state via useMarketplace and wires presentational pieces.
export default function MarketplacePageInner() {
  const m = useMarketplace()
  // Mobile-only filter drawer. On desktop the FilterSidebar is always visible in
  // the left column; on small screens it collapses behind a single "Filters"
  // button (e-commerce pattern) so it doesn't push the listings way down.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilterCount = m.activeChips?.length || 0

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="container mx-auto px-4 py-6">
        <MarketplaceHeader
          user={m.user}
          savedCount={m.savedCount}
          myListingsCount={m.myListings.length}
          onOpenSaved={() => m.router.push('/marketplace/me?tab=saved')}
          onOpenMyListings={() => m.router.push('/marketplace/me')}
          onPost={() => { if (m.requireAuth('post')) m.setPostOpen(true) }}
        />

        <MarketplaceSubNav
          tabs={m.subNavTabs}
          marketView={m.marketView}
          statusChip={m.statusChip}
          listingsCount={m.listings.length}
        />

        {/* MAIN BODY — switches between residential grid and B2B tab */}
        {m.marketView === 'commercial_b2b' ? (
          <FeatureLock featureKey="commercialB2B">
            <CommercialB2BTab user={m.user} />
          </FeatureLock>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_1fr_320px]">
            {/* Mobile filter trigger — opens the sidebar in a slide-in sheet.
                Hidden on lg+ where the sidebar is always in view.
                Note: the "Clear all" action lives with the active-filter chips
                (ActiveFilterChips) below, so we deliberately don't repeat it
                here — otherwise two "Clear all" buttons show on mobile. */}
            <div className="flex items-center justify-between gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm transition hover:border-brand-400 hover:text-brand-700"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Active filters + current sort, shown above the results in the
                center column (spans the sidebar gutter on large screens). */}
            {(m.activeChips.length > 0 || m.sortLabel) && (
              <div className="lg:col-span-3">
                <ActiveFilterChips
                  chips={m.activeChips}
                  onClearAll={m.clearFilters}
                  sortLabel={m.sortLabel}
                />
              </div>
            )}
            {/* Desktop sidebar — always visible from lg up. */}
            <div className="hidden lg:block">
              <FilterSidebar
                coordsLabel={m.coordsLabel}
                onUseMyLocation={m.useMyLocation}
                distancePreset={m.distancePreset}
                onDistanceChange={m.setDistancePreset}
                cat={m.cat}
                onCatChange={m.setCat}
                condition={m.condition}
                onConditionChange={m.setCondition}
                priceBucket={m.priceBucket}
                onPriceBucketChange={m.setPriceBucket}
              />
            </div>

            <ListingsPanel
              q={m.q}
              onQChange={m.setQ}
              sort={m.sort}
              onSortChange={m.setSort}
              viewMode={m.viewMode}
              onViewModeChange={m.setViewMode}
              statusChip={m.statusChip}
              onStatusChipChange={m.setStatusChip}
              loading={m.loading}
              listings={m.listings}
              isSaved={m.isSaved}
              onSave={m.onSave}
              onOpenListing={m.openListing}
              onClearFilters={m.clearFilters}
            />

            {/* Seller/CTA rail — desktop only; on mobile it just pushed the
                listings down without adding browsing value. */}
            <div className="hidden lg:block">
              <MarketplaceRightRail user={m.user} myListings={m.myListings} />
            </div>
          </div>
        )}

        <AudienceBar />
      </main>

      {/* Mobile filter drawer — same FilterSidebar, slides in from the left. */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="flex w-[88vw] max-w-sm flex-col gap-0 p-0 lg:hidden">
          <SheetHeader className="border-b border-neutral-200 px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-brand-600" /> Filters
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <FilterSidebar
              coordsLabel={m.coordsLabel}
              onUseMyLocation={m.useMyLocation}
              distancePreset={m.distancePreset}
              onDistanceChange={m.setDistancePreset}
              cat={m.cat}
              onCatChange={m.setCat}
              condition={m.condition}
              onConditionChange={m.setCondition}
              priceBucket={m.priceBucket}
              onPriceBucketChange={m.setPriceBucket}
            />
          </div>
          <div className="flex items-center gap-2 border-t border-neutral-200 p-3">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={m.clearFilters}
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="flex-1 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
            >
              Show results
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Floating + on mobile */}
      <button
        onClick={() => { if (m.requireAuth('post')) m.setPostOpen(true) }}
        className="fixed bottom-36 right-4 z-40 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl hover:bg-brand-700 md:hidden"
        aria-label="Post Item"
      >
        <Plus className="h-5 w-5" />
      </button>

      <PostItemDialog
        open={m.postOpen}
        onClose={() => m.setPostOpen(false)}
        onCreated={m.onCreated}
        categories={CATEGORIES}
        conditions={CONDITIONS}
        user={m.user}
      />
      <SoftLoginModal action={m.softLogin} onClose={() => m.setSoftLogin(null)} />

      {/* Quick View → shows on grid card click without leaving the page */}
      <QuickViewModal
        open={!!m.quickView}
        onOpenChange={(o) => !o && m.setQuickView(null)}
        listing={m.quickView}
        viewerIsOwner={!!m.user && m.quickView && m.quickView.sellerId === m.user.id}
        isSaved={m.quickView ? m.isSaved(m.quickView) : false}
        onSave={(l) => m.onSave(l)}
        onContactSeller={() => {
          if (!m.requireAuth('contact_seller')) return
          m.setContactOpen(true)
        }}
      />

      {/* Contact Seller → sends email via Gmail SMTP (graceful fallback if not configured) */}
      <ContactSellerModal
        open={m.contactOpen}
        onOpenChange={m.setContactOpen}
        listing={m.quickView}
        user={m.user}
      />
    </div>
  )
}
