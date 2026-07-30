'use client'

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowUpDown, Clock, LayoutGrid, List as ListIcon, Loader2, Search, ShoppingBag,
} from 'lucide-react'
import ListingCard from '@/components/marketplace/ListingCard'
import ListingThumb from '@/components/marketplace/ListingThumb'
import MarketDropdown from '@/components/marketplace/MarketDropdown'
import {
  SORTS, STATUS_CHIPS, priceLabel, statusBadgeStyle, statusLabel, timeAgoShort,
} from '@/constants/marketplace_constants'

// Sort options mapped to the shared dropdown's { value, label } shape.
const SORT_OPTIONS = SORTS.map((s) => ({ value: s.value, label: s.label }))

// How many listings to reveal per "page" as the user scrolls. The API returns
// the full result set at once (see useMarketplace), so infinite scroll here is
// purely client-side: we render a growing slice and reveal more when a sentinel
// near the bottom of the list scrolls into view.
const PAGE_SIZE = 12

// Center column: search/sort toolbar + status chips, followed by the results
// in grid or list mode (with loading + empty states). Fully controlled.
export default function ListingsPanel({
  q, onQChange,
  sort, onSortChange,
  viewMode, onViewModeChange,
  statusChip, onStatusChipChange,
  loading, listings,
  isSaved, onSave, onOpenListing, onClearFilters,
}) {
  // ── Client-side infinite scroll ──
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef(null)

  // Reset the reveal window whenever the underlying results change (new search,
  // filter, sort, or view switch) so we always start from the top.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [listings, viewMode])

  const visibleListings = useMemo(
    () => listings.slice(0, visibleCount),
    [listings, visibleCount],
  )
  const hasMore = visibleCount < listings.length

  useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, listings.length))
        }
      },
      { rootMargin: '600px 0px' }, // start loading before the sentinel is on-screen
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, listings.length])

  return (
    <section className="space-y-4">
      <Card className="border-neutral-200">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input value={q} onChange={(e) => onQChange(e.target.value)} placeholder="Search items…" className="pl-9" />
            </div>
            <MarketDropdown
              options={SORT_OPTIONS}
              value={sort}
              onChange={onSortChange}
              icon={ArrowUpDown}
              align="right"
              className="md:w-44"
              menuWidth="w-44"
            />
            <div className="flex overflow-hidden rounded-md border border-neutral-300">
              <button onClick={() => onViewModeChange('grid')} className={`px-2.5 py-2 ${viewMode === 'grid' ? 'bg-brand-50 text-brand-700' : 'bg-white text-neutral-600'}`}><LayoutGrid className="h-4 w-4" /></button>
              <button onClick={() => onViewModeChange('list')} className={`px-2.5 py-2 border-l ${viewMode === 'list' ? 'bg-brand-50 text-brand-700' : 'bg-white text-neutral-600'}`}><ListIcon className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_CHIPS.map((c) => (
              <button
                key={c.value}
                onClick={() => onStatusChipChange(c.value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${statusChip === c.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>
      ) : listings.length === 0 ? (
        <Card className="border-dashed"><CardContent className="grid place-items-center gap-2 p-10 text-center text-sm text-neutral-500">
          <ShoppingBag className="h-8 w-8 text-neutral-300" />
          <div>No listings match your filters yet.</div>
          <Button onClick={onClearFilters} variant="outline">Clear filters</Button>
        </CardContent></Card>
      ) : viewMode === 'grid' ? (
        <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleListings.map((l) => (
            <ListingCard key={l.id} l={l} onSave={onSave} isSaved={isSaved(l)} onClick={() => onOpenListing(l)} />
          ))}
        </div>
        <InfiniteFooter
          ref={sentinelRef}
          hasMore={hasMore}
          total={listings.length}
        />
        </>
      ) : (
        <>
        <div className="space-y-2">
          {visibleListings.map((l) => (
            <Card key={l.id} onClick={() => onOpenListing(l)} className="cursor-pointer hover:bg-neutral-50">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                  <ListingThumb photo={l.photos?.[0]} category={l.category} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${statusBadgeStyle(l.itemStatus)}`}>{statusLabel(l.itemStatus)}</span>
                    {l.leavingInMinutes != null && l.leavingInMinutes > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white"><Clock className="h-3 w-3" />Leaving in {l.leavingInMinutes} min</span>
                    )}
                  </div>
                  <div className="line-clamp-1 text-sm font-bold">{l.title}</div>
                  <div className="text-xs text-neutral-500">{l.city} · {timeAgoShort(l.createdAt)}</div>
                </div>
                <div className={`shrink-0 text-lg font-extrabold ${l.priceType === 'free' || l.price === 0 ? 'text-emerald-600' : 'text-neutral-900'}`}>{priceLabel(l)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <InfiniteFooter
          ref={sentinelRef}
          hasMore={hasMore}
          total={listings.length}
        />
        </>
      )}
    </section>
  )
}

// Sentinel + status line rendered below the results. The IntersectionObserver
// in the parent watches the forwarded ref; when it nears the viewport we reveal
// the next page. When everything is shown, we surface a subtle end-of-results
// note instead so the list has a clear stopping point.
const InfiniteFooter = forwardRef(function InfiniteFooter({ hasMore, total }, ref) {
  if (total === 0) return null
  return (
    <div ref={ref} className="py-6">
      {hasMore ? (
        <div className="flex items-center justify-center gap-2 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading more…
        </div>
      ) : (
        <div className="text-center text-xs text-neutral-400">
          You&rsquo;ve reached the end · {total} {total === 1 ? 'listing' : 'listings'}
        </div>
      )}
    </div>
  )
})
