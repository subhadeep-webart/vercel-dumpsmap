'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import SellerDashboard from '@/components/marketplace/SellerDashboard'
import WhyUsePanel from '@/components/marketplace/WhyUsePanel'

// Right column: seller dashboard when signed in, sign-in CTA otherwise, plus
// the evergreen "why use" panel.
export default function MarketplaceRightRail({ user, myListings }) {
  return (
    <aside className="space-y-4">
      {user ? (
        <SellerDashboard user={user} myListings={myListings} />
      ) : (
        <Card className="border-neutral-200 bg-gradient-to-br from-brand-50 to-white">
          <CardContent className="space-y-3 p-5 text-sm">
            <div className="text-base font-extrabold tracking-tight">Sign in to sell or save</div>
            <p className="text-neutral-700">Post items, message sellers, reserve free pickups, and track your impact.</p>
            <Link href="/?login=1&returnTo=/marketplace" className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white hover:bg-brand-700">Sign in / Sign up</Link>
          </CardContent>
        </Card>
      )}
      <WhyUsePanel />
    </aside>
  )
}
