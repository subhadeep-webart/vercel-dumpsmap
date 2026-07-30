'use client'

import FeatureLock from '@/components/FeatureLock'
import MarketplacePageInner from '@/components/marketplace/MarketplacePageInner'

// Page-level feature gate: when Super Admin sets `marketplace` to
// not_active/paused/demo/beta, FeatureLock renders the appropriate
// locked screen INSTEAD of the page. Existing data stays in the DB.
export default function MarketplacePage() {
  return (
    <FeatureLock featureKey="marketplace">
      <MarketplacePageInner />
    </FeatureLock>
  )
}
