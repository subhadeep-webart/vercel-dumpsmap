'use client'

import { Button } from '@/components/ui/button'
import { Heart, Plus, User } from 'lucide-react'

// Page title, saved/my-listings shortcuts, and the primary "Post Item" action.
export default function MarketplaceHeader({
  user, savedCount, myListingsCount,
  onOpenSaved, onOpenMyListings, onPost,
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Marketplace</h1>
        <p className="text-sm text-neutral-600">Rescue. Reuse. Recycle. Profit. <span className="ml-1 text-emerald-700">Find incredible items near you and keep them out of the landfill.</span></p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 md:justify-start">
        {user && (
          <>
            <button
              onClick={onOpenSaved}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 text-[13px] font-semibold text-rose-700 hover:bg-rose-50"
              title="Items you've saved"
            >
              <Heart className="h-4 w-4" />
              Saved
              {savedCount > 0 && <span className="rounded-full bg-rose-100 px-1.5 text-[10px]">{savedCount}</span>}
            </button>
            <button
              onClick={onOpenMyListings}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50"
              title="Your listings"
            >
              <User className="h-4 w-4" />
              My Listings
              {myListingsCount > 0 && <span className="rounded-full bg-neutral-100 px-1.5 text-[10px]">{myListingsCount}</span>}
            </button>
          </>
        )}
        <Button onClick={onPost} className="ml-auto h-8 md:ml-0 md:h-10 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
          <Plus className="mr-1 h-4 w-4" /> Post Item
        </Button>
      </div>
    </div>
  )
}
