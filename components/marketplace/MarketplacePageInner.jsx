'use client'

import { Plus } from 'lucide-react'
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

            <MarketplaceRightRail user={m.user} myListings={m.myListings} />
          </div>
        )}

        <AudienceBar />
      </main>

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
