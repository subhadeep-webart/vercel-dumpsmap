'use client'

// QuickViewModal — fast-preview dialog for a marketplace listing.
// Design goal (from July 2026 UX brief): keep buyers on the browse page.
// Contents: photo carousel + price + title + short description +
// condition + location + [Contact Seller] + [View Full Details] buttons.
//
// Used by the marketplace grid — clicking a card opens Quick View by
// default. "View Full Details" navigates to /marketplace/[id].

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogClose, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, MapPin, Clock, ExternalLink, MessageSquare, BadgeCheck, Heart, X, ImageOff } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function QuickViewModal({ open, onOpenChange, listing, onContactSeller, onSave, isSaved, viewerIsOwner }) {
  const router = useRouter()
  const [idx, setIdx] = useState(0)

  useEffect(() => { if (open) setIdx(0) }, [open, listing?.id])

  if (!listing) return null
  const photos = (listing.photos || []).map(normalizePhoto).filter(Boolean)
  const hasPhotos = photos.length > 0
  const priceStr = (() => {
    if (listing.priceType === 'free' || listing.price === 0) return 'FREE'
    if (listing.priceType === 'donation') return 'Donation'
    if (listing.priceType === 'trade')    return 'Trade'
    if (listing.priceType === 'obo')      return `$${Number(listing.price || 0).toFixed(0)} OBO`
    return `$${Number(listing.price || 0).toFixed(0)}`
  })()

  const goPrev = () => setIdx((i) => (i - 1 + photos.length) % photos.length)
  const goNext = () => setIdx((i) => (i + 1) % photos.length)

  const goFull = () => {
    onOpenChange(false)
    router.push(`/marketplace/${listing.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* [&>button]:hidden suppresses DialogContent's built-in top-right close,
          which would otherwise float over the scrollable details panel. We
          render our own close control below, anchored to the modal corner. */}
      <DialogContent className="max-w-3xl overflow-hidden p-0 gap-0 [&>button]:hidden">
        {/* Accessible title for screen readers (visually hidden). */}
        <DialogTitle className="sr-only">{listing.title}</DialogTitle>

        {/* Floating close — always in the modal's top-right, above both panels
            and never overlapping the details text. Wrapped in a div so the
            [&>button]:hidden rule above (which suppresses DialogContent's own
            close) does not also hide this custom close button. */}
        <div className="absolute right-3 top-3 z-20">
          <DialogClose
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-neutral-700 shadow-md ring-1 ring-black/5 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogClose>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr]">
          {/* ───── LEFT: photo carousel ───── */}
          <div className="relative aspect-[4/3] bg-neutral-900 md:aspect-auto md:min-h-[340px]">
            {hasPhotos ? (
              <img
                src={photos[idx]}
                alt={listing.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-neutral-400">
                <div className="text-center">
                  <ImageOff className="mx-auto h-10 w-10" />
                  <div className="mt-2 text-xs">No photos</div>
                </div>
              </div>
            )}

            {/* photo counter */}
            {hasPhotos && photos.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={goNext}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setIdx(i)}
                      className={`h-1.5 rounded-full transition ${i === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
                      aria-label={`Photo ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Corner chips */}
            <div className="absolute left-3 top-3 flex flex-col gap-1.5">
              <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">
                {listing.itemStatus === 'sold' || listing.itemStatus === 'claimed' ? 'Sold' : 'Available'}
              </Badge>
              {listing.leavingInMinutes != null && listing.leavingInMinutes > 0 && listing.itemStatus !== 'sold' && (
                <Badge className="bg-black/75 text-white hover:bg-black/75">
                  <Clock className="mr-1 h-3 w-3" /> {listing.leavingInMinutes} min left
                </Badge>
              )}
            </div>

          </div>

          {/* ───── RIGHT: details ───── */}
          <div className="flex flex-col p-4 md:max-h-[520px] md:overflow-y-auto">
            <div className="flex-1">
              {/* pr-10 reserves the top-right corner for the floating close
                  button so the Save heart never sits underneath it. */}
              <div className="flex items-start justify-between gap-2 pr-10">
                <div className="min-w-0">
                  <h3 className="line-clamp-2 text-base font-extrabold leading-tight">{listing.title}</h3>
                  <div className={`mt-1 text-xl font-black ${listing.priceType === 'free' || listing.price === 0 ? 'text-emerald-600' : 'text-neutral-900'}`}>
                    {priceStr}
                  </div>
                </div>
                <button
                  onClick={() => onSave?.(listing)}
                  className="shrink-0 rounded-full border border-neutral-200 p-2 hover:bg-neutral-50"
                  aria-label="Save"
                >
                  <Heart className={`h-4 w-4 ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-neutral-600'}`} />
                </button>
              </div>

              {/* Chips: category / condition / location */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {listing.category && (
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">{listing.category}</span>
                )}
                {listing.condition && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">{prettyCondition(listing.condition)}</span>
                )}
                {listing.city && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                    <MapPin className="h-3 w-3" /> {listing.city}{listing.state ? `, ${listing.state}` : ''}
                  </span>
                )}
              </div>

              {/* Description */}
              {listing.description && (
                <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700">
                  {listing.description}
                </p>
              )}

              {/* Seller card */}
              {listing.seller && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                  <div className="h-9 w-9 overflow-hidden rounded-full bg-neutral-200">
                    {listing.seller.avatarUrl
                      ? <img src={normalizePhoto(listing.seller.avatarUrl)} alt="" className="h-full w-full object-cover" />
                      : <div className="grid h-full w-full place-items-center text-sm font-bold text-neutral-500">{(listing.seller.name || '?')[0].toUpperCase()}</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm font-bold text-neutral-900">
                      <span className="truncate">{listing.seller.name || 'Seller'}</span>
                      {listing.seller.badge && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                    </div>
                    <div className="truncate text-[11px] text-neutral-500">Verified marketplace seller</div>
                  </div>
                </div>
              )}
            </div>

            {/* ───── ACTIONS ───── */}
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                onClick={onContactSeller}
                disabled={viewerIsOwner || listing.itemStatus === 'sold' || listing.itemStatus === 'claimed'}
                className="h-10 min-w-0 bg-emerald-600 px-3 text-sm font-semibold hover:bg-emerald-700"
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate">{viewerIsOwner ? 'This is your listing' : 'Contact Seller'}</span>
              </Button>
              <Button onClick={goFull} variant="outline" className="h-10 min-w-0 border-emerald-200 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className="truncate">View Full Details</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function prettyCondition(c) {
  const map = { new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair', for_parts: 'For Parts' }
  return map[c] || c
}

function normalizePhoto(url) {
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('/uploads/')) return `/api/files/${url.slice('/uploads/'.length)}`
  return url
}
