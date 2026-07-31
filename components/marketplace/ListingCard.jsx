'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { BadgeCheck, Clock, Heart, MapPin } from 'lucide-react'
import CategoryPlaceholder from '@/components/marketplace/CategoryPlaceholder'
import SafeImage from '@/components/SafeImage'
import {
  distMiles, normalizePhoto, priceLabel, sellerBadgeStyle,
  statusBadgeStyle, statusLabel, timeAgoShort,
} from '@/constants/marketplace_constants'

// Grid-mode listing tile. Purely presentational: takes a listing plus save
// state/handlers and renders the card. All click behavior is delegated up.
export default function ListingCard({ l, onSave, isSaved, onClick }) {
  const miles = distMiles(l.distanceKm)
  const photo = normalizePhoto((l.photos && l.photos[0]) || null)
  const [imgFailed, setImgFailed] = useState(false)
  const priceIsFree = l.priceType === 'free' || l.price === 0
  const showLastChance = l.leavingInMinutes != null && l.leavingInMinutes > 0
    && l.itemStatus !== 'sold' && l.itemStatus !== 'claimed'
  return (
    <Card
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm ring-1 ring-transparent transition-all duration-200 hover:-translate-y-1 hover:border-transparent hover:shadow-xl hover:ring-brand-200"
      onClick={onClick}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
        {photo && !imgFailed ? (
          <img
            src={photo}
            alt={l.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <CategoryPlaceholder category={l.category} />
        )}

        {/* Top scrim so badges stay legible over any photo. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent" />

        {/* ── TOP BAR ── status/last-chance on the left, save heart on the
            right. Given a shared row with min-w-0 so the two sides can never
            overlap: the left column truncates before it reaches the heart. */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className={`max-w-full truncate rounded-full px-2 py-[3px] text-[9px] font-semibold uppercase leading-none tracking-wide shadow-sm ${statusBadgeStyle(l.itemStatus)}`}>
              {statusLabel(l.itemStatus)}
            </span>
            {showLastChance && (
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-black/75 px-2 py-[3px] text-[9px] font-semibold leading-none text-white shadow-sm backdrop-blur">
                <Clock className="h-2.5 w-2.5 shrink-0" /> {l.leavingInMinutes} min left
              </span>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onSave?.(l) }}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-neutral-700 shadow-md ring-1 ring-black/5 backdrop-blur transition hover:scale-105 hover:bg-white"
            aria-label="Save"
          >
            <Heart className={`h-4 w-4 ${isSaved ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>

        {/* PRICE — pinned to the bottom-left of the photo, out of the way of
            the top badges. Bottom scrim keeps it readable over the image. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
        <span className={`absolute bottom-2.5 left-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-lg px-2.5 py-1 text-[13px] font-bold leading-none shadow-md backdrop-blur ${priceIsFree ? 'bg-emerald-500 text-white' : 'bg-white/95 text-neutral-900'}`}>
          {priceLabel(l)}
        </span>
      </div>

      <CardContent className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="line-clamp-1 text-sm font-bold text-neutral-900">{l.title}</div>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{miles != null ? `${miles.toFixed(1)} mi · ` : ''}{l.city || '—'}</span>
          </span>
          <span className="shrink-0">{timeAgoShort(l.createdAt)}</span>
        </div>
        {l.seller && (
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-neutral-200">
                {l.seller.avatarUrl ? <SafeImage src={l.seller.avatarUrl} alt="" kind="avatar" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-[10px] font-bold text-neutral-500">{(l.seller.name || '?')[0].toUpperCase()}</div>}
              </div>
              <span className="truncate text-xs font-medium text-neutral-700">{l.seller.name}</span>
            </div>
            {l.seller.badge && (
              <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-[3px] text-[9px] font-medium leading-none ${sellerBadgeStyle(l.seller.badge)}`}>
                <BadgeCheck className="h-2.5 w-2.5" />{l.seller.badge.replace('Verified ', '')}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
