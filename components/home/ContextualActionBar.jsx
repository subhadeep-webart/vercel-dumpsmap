'use client'

// Contextual action bar — the toolbar under the SiteHeader whose left-side
// actions change per active tab (feed / facilities / jobs / marketplace), with
// a persistent Inbox button on the right. Extracted from HomeShell.jsx.

import {
  Map as MapIcon,
  Plus,
  Star,
  MapPin,
  Briefcase,
  Bookmark,
  Store,
  Inbox as InboxIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import ViewModeToggle from '@/components/field/ViewModeToggle'

export default function ContextualActionBar({
  tab,
  setTab,
  user,
  unread,
  onOpenMap,
  onSubmitFacility,
  onPostJob,
  onJobs,
  onLogin,
}) {
  return (
    <div className="z-20 flex flex-none items-center justify-between gap-2 border-b border-neutral-200 bg-white/95 px-3 py-1.5 md:px-4">
      <div className="flex items-center gap-1.5">
        {tab === 'feed' && (
          <>
            <Button onClick={onOpenMap} variant="outline" size="sm" className="h-8">
              <MapIcon className="h-3.5 w-3.5 text-brand-600 sm:mr-1" />
              <span className="hidden sm:inline">Open Map</span>
            </Button>
            <span className="hidden md:inline-flex"><ViewModeToggle /></span>
            <Button onClick={onSubmitFacility} size="sm" className="h-8 bg-brand-600 hover:bg-brand-700">
              <Plus className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Submit Update</span>
            </Button>
          </>
        )}
        {tab === 'facilities' && (
          <>
            <Button onClick={onOpenMap} variant="outline" size="sm" className="h-8">
              <MapIcon className="h-3.5 w-3.5 text-brand-600 sm:mr-1" />
              <span className="hidden sm:inline">Map View</span>
            </Button>
            <Button onClick={() => { setTab('feed'); onOpenMap?.() }} variant="outline" size="sm" className="h-8">
              <MapPin className="h-3.5 w-3.5 text-brand-600 sm:mr-1" />
              <span className="hidden sm:inline">Nearby</span>
            </Button>
            <Button onClick={() => (user ? (window.location.href = '/recommendations') : onLogin?.())} variant="outline" size="sm" className="h-8">
              <Star className="h-3.5 w-3.5 text-amber-500 sm:mr-1" />
              <span className="hidden sm:inline">Favorites</span>
            </Button>
          </>
        )}
        {tab === 'jobs' && (
          <>
            <Button onClick={() => onPostJob?.()} size="sm" className="h-8 bg-brand-600 hover:bg-brand-700">
              <Plus className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Post Job</span>
            </Button>
            <Button onClick={() => onJobs?.()} variant="outline" size="sm" className="h-8">
              <Briefcase className="h-3.5 w-3.5 text-brand-600 sm:mr-1" />
              <span className="hidden sm:inline">Browse All</span>
            </Button>
          </>
        )}
        {tab === 'marketplace' && (
          <>
            <Button onClick={() => (window.location.href = '/marketplace')} size="sm" className="h-8 bg-brand-600 hover:bg-brand-700">
              <Plus className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Post Item</span>
            </Button>
            <Button onClick={() => (window.location.href = '/marketplace/me?tab=saved')} variant="outline" size="sm" className="h-8">
              <Bookmark className="h-3.5 w-3.5 text-brand-600 sm:mr-1" />
              <span className="hidden sm:inline">Saved Items</span>
            </Button>
            <Button onClick={() => (window.location.href = '/marketplace?mine=1')} variant="outline" size="sm" className="h-8">
              <Store className="h-3.5 w-3.5 text-brand-600 sm:mr-1" />
              <span className="hidden sm:inline">My Listings</span>
            </Button>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button onClick={() => (user ? (window.location.href = '/inbox') : onLogin?.())} variant="outline" size="sm" className="relative h-8" aria-label="Inbox">
          <InboxIcon className="h-3.5 w-3.5 text-brand-600 sm:mr-1" />
          <span className="hidden sm:inline">Inbox</span>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
