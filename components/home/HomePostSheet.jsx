'use client'

// "Post" affordance for HomeShell: the desktop floating + FAB (bottom-right,
// hidden on mobile) and the bottom sheet listing quick post actions. The mobile
// trigger lives in HomeBottomNav; both share the `open` state owned by the
// parent. Extracted from HomeShell.jsx.

import { Plus, Flame, Store, Bell, MapPin, Users, Map as MapIcon } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PostRow } from '@/components/home/ShellControls'

export default function HomePostSheet({
  open,
  onOpenChange,
  onPostJob,
  onPostMarketplace,
  onPostAlert,
  onSubmitFacility,
  onCommunity,
  onOpenMap,
}) {
  const close = () => onOpenChange(false)
  return (
    <>
      {/* DESKTOP FLOATING + POST FAB — sits bottom-right, hidden on mobile (mobile uses bottom nav) */}
      <button
        onClick={() => onOpenChange(true)}
        aria-label="Post"
        className="fixed bottom-6 right-6 z-30 hidden h-14 items-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-bold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 hover:shadow-xl active:scale-95 md:inline-flex"
      >
        <Plus className="h-5 w-5" /> Post
      </button>

      {/* POST SHEET */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-6">
          <SheetHeader className="text-left">
            <SheetTitle>What do you want to post?</SheetTitle>
            <SheetDescription className="text-xs">Quick actions for haulers and customers.</SheetDescription>
          </SheetHeader>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <PostRow icon={Flame} color="text-red-600" title="Post Job / Hot Spot" desc="Hire a verified contractor for cleanup, hauling, or pickup" onClick={() => { close(); onPostJob?.() }} />
            <PostRow icon={Store} color="text-brand-600" title="Post Marketplace Listing" desc="Sell, give away, or trade items (residential or commercial)" onClick={() => { close(); onPostMarketplace?.() }} />
            <PostRow icon={Bell} color="text-orange-600" title="Post Facility Alert" desc="Wait times, closures, accepting now, donation needs" onClick={() => { close(); onPostAlert?.() }} />
            <PostRow icon={MapPin} color="text-brand-600" title="Submit a Facility" desc="Add a recycling/donation/transfer station" onClick={() => { close(); onSubmitFacility?.() }} />
            <PostRow icon={Users} color="text-sky-600" title="Community Update" desc="Share with the community" onClick={() => { close(); onCommunity?.('community') }} />
            <PostRow icon={MapIcon} color="text-neutral-700" title="Open Map View (optional)" desc="Browse facilities geographically — feed view is the default" onClick={() => { close(); onOpenMap?.() }} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
