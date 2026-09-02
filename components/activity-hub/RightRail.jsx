'use client'

// RightRail — Activity Hub right panel.
//
// Currently just "Facilities Near You". A Google Ads slot is planned for this
// rail later; when it lands it goes above or below this card, so the rail is
// kept as a simple stack rather than a single-purpose component.

import NearbyFacilitiesCard from './NearbyFacilitiesCard'
import PromoCard from './PromoCard'

export default function RightRail() {
  return (
    <>
      <NearbyFacilitiesCard />
      <PromoCard />
    </>
  )
}
