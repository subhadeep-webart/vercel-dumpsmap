// marketplace-helpers.js
// ---------------------------------------------------------------------------
// Pure helper functions for the Marketplace *detail* + *buyer dashboard* pages.
// These were previously inlined at the top of
// app/(app)/marketplace/[id]/page.js and app/(app)/marketplace/me/page.js.
// Hoisting them here keeps the page/view components focused on rendering and
// lets the data/action hooks share the same formatting logic.
//
// Everything here is pure (no React, no I/O): given the same input it returns
// the same output, so it's safe to call in render and trivial to unit-test.

import {
  DETAIL_STATUS_BADGE, DETAIL_STATUS_BADGE_FALLBACK,
  TILE_STATUS_STYLE, TILE_STATUS_STYLE_FALLBACK,
} from '@/constants/marketplace_detail_constants'

// --- Photo URL normalization ------------------------------------------------

// Legacy uploads stored URLs as "/uploads/<name>". We now serve via
// "/api/files/<name>" which is more reliable (reads from /data/uploads on each
// request, survives redeploys). Normalize both shapes at render time so old
// listings keep rendering.
export function normalizePhoto(url) {
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('/uploads/')) return `/api/files/${url.slice('/uploads/'.length)}`
  return url
}

// --- Formatting -------------------------------------------------------------

// Pickup windows are now stored as a "YYYY-MM-DDTHH:mm" datetime value from the
// post form's date-time picker. Render those in a friendly local format; older
// listings stored a free-text phrase, so fall back to the raw string for those.
export function formatPickupWindow(v) {
  if (!v || typeof v !== 'string') return v
  const isDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)
  if (!isDateTime) return v
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

// Milliseconds → "MM:SS" for the reservation countdown.
export function mmss(ms) {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// --- Price / status labels --------------------------------------------------

// Price label for the buyer-dashboard listing tiles. (Scoped to the tile's
// display rules — kept identical to the old inline version so behaviour is
// unchanged; the list page has its own richer priceLabel in
// constants/marketplace_constants.js.)
export function tilePriceLabel(l) {
  if (l.priceType === 'free' || l.price === 0) return 'FREE'
  if (l.priceType === 'donation') return 'DONATION'
  if (l.priceType === 'trade') return 'TRADE'
  if (l.priceType === 'obo') return l.price ? `$${l.price} or Make Offer` : 'Make Offer'
  return l.price != null ? `$${l.price}` : '—'
}

// Detail-page price label: FREE for free/donation-style listings, else the
// price or "Contact".
export function detailPriceLabel(listing) {
  const isFree = isFreeListing(listing)
  return isFree ? 'FREE' : listing.price != null ? `$${listing.price}` : 'Contact'
}

// Is a listing "free"? (kind, priceType, or a literal $0 price.)
export function isFreeListing(listing) {
  return listing?.kind === 'free' || listing?.priceType === 'free' || listing?.price === 0
}

// Buyer-dashboard tile status-pill colour classes.
export function tileStatusStyle(s) {
  return TILE_STATUS_STYLE[s] || TILE_STATUS_STYLE_FALLBACK
}

// Detail header itemStatus badge colour classes.
export function detailStatusBadge(s) {
  return DETAIL_STATUS_BADGE[s] || DETAIL_STATUS_BADGE_FALLBACK
}

// --- Detail-page domain derivations -----------------------------------------

// The current user's own reservation on a listing, or null.
export function myReservationOf(listing, userId) {
  return listing?.reservation && listing.reservation.userId === userId ? listing.reservation : null
}

// A reservation held by someone other than the current user, or null.
export function otherReservationOf(listing, userId) {
  return listing?.reservation && listing.reservation.userId !== userId ? listing.reservation : null
}

// Is the item still buyable (not sold / claimed / donated)?
export function itemActiveForBuyer(listing) {
  return !!listing && !listing.sold
    && listing.itemStatus !== 'sold'
    && listing.itemStatus !== 'claimed'
    && listing.itemStatus !== 'donated'
}

// --- Buyer-dashboard derivations --------------------------------------------

// Recompute msRemaining for each reserved listing from its expiresAt so the
// countdown ticks client-side without a refetch.
export function withLiveReservations(reserved = []) {
  return reserved.map((l) => {
    if (!l.reservation?.expiresAt) return l
    const msRemaining = Math.max(0, new Date(l.reservation.expiresAt).getTime() - Date.now())
    return { ...l, reservation: { ...l.reservation, msRemaining } }
  })
}
