'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingBag, MapPin, MessageCircle, Bookmark, BadgeCheck, AlertTriangle, Loader2, Gift, Clock, Timer, ShieldCheck, X, CheckCircle2, Truck, Check } from 'lucide-react'
import FieldFrame from '@/components/field/FieldFrame'
import ReportButton from '@/components/ReportButton'
import CategoryPlaceholder from '@/components/marketplace/CategoryPlaceholder'
import { timeAgo } from '@/lib/community-categories'
import { resolveMarketplaceRole, allowedStatusesForUser, STATUS_META } from '@/lib/marketplace-roles'
import { SoftLoginModal } from '@/components/SoftLoginModal'

// Legacy uploads stored URLs as "/uploads/<name>". We now serve via
// "/api/files/<name>" which is more reliable (reads from /data/uploads on each
// request, survives redeploys). Normalize both shapes at render time so old
// listings keep rendering.
function normalizePhoto(url) {
  if (!url) return null
  if (typeof url !== 'string') return null
  if (url.startsWith('/uploads/')) return `/api/files/${url.slice('/uploads/'.length)}`
  return url
}

function authHeaders() {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function MarketplaceListingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [imgIdx, setImgIdx] = useState(0)
  // Per-photo failure tracking so we can swap a broken <img> for a clean
  // <CategoryPlaceholder /> instead of showing a broken icon.
  const [imgFailed, setImgFailed] = useState({})
  // Soft-login modal state
  const [softLogin, setSoftLogin] = useState(null)
  const requireAuth = (action) => {
    if (user) return true
    setSoftLogin(action)
    return false
  }

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!t) return
    fetch('/api/auth/me', { headers: authHeaders() }).then((r) => r.ok ? r.json() : null).then((j) => setUser(j?.user || null)).catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/marketplace/${id}`, { headers: authHeaders() })
      if (!r.ok) { setErr((await r.json()).error || 'Not found'); return }
      const j = await r.json()
      setListing(j.listing || j)
    } finally { setLoading(false) }
  }
  useEffect(() => { if (id) load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [id])

  const save = async () => {
    if (!requireAuth('save')) return
    try {
      const r = await fetch(`/api/marketplace/${id}/save`, { method: 'POST', headers: authHeaders() })
      const j = await r.json()
      toast.success(j.saved ? 'Saved' : 'Unsaved')
    } catch {}
  }

  const message = () => {
    if (!requireAuth('message')) return
    if (listing?.seller?.id) router.push(`/inbox?dm=${listing.seller.id}`)
  }

  // ---- Reserve flow ----
  const [reserving, setReserving] = useState(false)
  const [reserveOpen, setReserveOpen] = useState(false)   // confirmation modal
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const myReservation = listing?.reservation && listing.reservation.userId === user?.id ? listing.reservation : null
  const someoneElseReservation = listing?.reservation && listing.reservation.userId !== user?.id ? listing.reservation : null
  const myMsLeft = myReservation ? Math.max(0, new Date(myReservation.expiresAt).getTime() - now) : 0
  const mmss = (ms) => {
    const s = Math.floor(ms / 1000)
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }
  // Auto-refresh when timer hits zero
  useEffect(() => {
    if (myReservation && myMsLeft === 0) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReservation, myMsLeft])

  const doReserve = async () => {
    if (!requireAuth('save')) return
    setReserving(true)
    try {
      const r = await fetch(`/api/marketplace/${id}/reserve`, { method: 'POST', headers: authHeaders() })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not reserve')
      setListing(j.listing)
      setReserveOpen(false)
      toast.success('Reserved! You have 15 minutes to coordinate pickup.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setReserving(false)
    }
  }
  const cancelReserve = async () => {
    setReserving(true)
    try {
      const r = await fetch(`/api/marketplace/${id}/reserve/cancel`, { method: 'POST', headers: authHeaders() })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not cancel')
      setListing(j.listing)
      toast.success('Reservation cancelled')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setReserving(false)
    }
  }
  const completePickup = async (finalStatus = 'claimed') => {
    setReserving(true)
    try {
      const r = await fetch(`/api/marketplace/${id}/reserve/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ finalStatus }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not complete')
      setListing(j.listing)
      toast.success('Pickup completed')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setReserving(false)
    }
  }

  // Seller one-tap status change (mobile-friendly field action)
  const quickStatus = async (itemStatus) => {
    setReserving(true)
    try {
      const r = await fetch(`/api/marketplace/${id}/quick-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ itemStatus }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      setListing(j.listing)
      toast.success(`Status: ${itemStatus.replace('_', ' ')}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setReserving(false)
    }
  }

  const isOwner = user?.id && listing?.sellerId === user.id
  const isReserver = !!myReservation
  const itemActiveForBuyer = listing && !listing.sold && listing.itemStatus !== 'sold' && listing.itemStatus !== 'claimed' && listing.itemStatus !== 'donated'

  if (loading) return <FieldFrame hideHeader title="Listing" back="/"><div className="py-10 text-center text-sm text-neutral-400">Loading…</div></FieldFrame>
  if (err || !listing) return <FieldFrame hideHeader title="Listing" back="/"><div className="px-4 py-10 text-center text-sm text-neutral-500">{err || 'Listing not found.'}</div></FieldFrame>

  const photos = listing.photos || []
  const isFree = listing.kind === 'free' || listing.priceType === 'free' || listing.price === 0
  const priceLabel = isFree ? 'FREE' : listing.price != null ? `$${listing.price}` : 'Contact'

  return (
    <FieldFrame
      hideHeader
      title={isFree ? 'Free item' : 'Marketplace'}
      back="/marketplace"
      right={<ReportButton kind="marketplace_listing" targetId={listing.id} variant="inline" label="" />}
      bodyClassName="!pb-28"
    >
      <div className="space-y-3 p-3">
        {photos.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="aspect-[4/3] w-full bg-neutral-100">
              {imgFailed[imgIdx] ? (
                <CategoryPlaceholder category={listing.category} size="lg" />
              ) : (
                <img
                  src={normalizePhoto(photos[imgIdx])}
                  alt={listing.title || ''}
                  className="h-full w-full object-cover"
                  onError={() => setImgFailed((f) => ({ ...f, [imgIdx]: true }))}
                />
              )}
            </div>
            {photos.length > 1 && (
              <div className="flex gap-1 overflow-x-auto p-1">
                {photos.map((p, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} className={`h-12 w-12 shrink-0 overflow-hidden rounded ${i === imgIdx ? 'ring-2 ring-brand-500' : ''}`}>
                    {imgFailed[i] ? (
                      <CategoryPlaceholder category={listing.category} size="sm" showLabel={false} />
                    ) : (
                      <img
                        src={normalizePhoto(p)}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setImgFailed((f) => ({ ...f, [i]: true }))}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="aspect-[4/3] w-full">
              <CategoryPlaceholder category={listing.category} size="lg" />
            </div>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-base font-extrabold leading-snug text-neutral-900">{listing.title}</h1>
              <div className={`shrink-0 rounded-md px-2 py-1 text-sm font-bold ${isFree ? 'bg-brand-100 text-brand-800' : 'bg-neutral-900 text-white'}`}>{priceLabel}</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {listing.itemStatus && listing.itemStatus !== 'available' && (
                <Badge className={
                  listing.itemStatus === 'on_truck' ? 'bg-emerald-600 text-white' :
                  listing.itemStatus === 'at_site' ? 'bg-blue-600 text-white' :
                  listing.itemStatus === 'last_chance' ? 'bg-rose-600 text-white' :
                  listing.itemStatus === 'reserved' ? 'bg-amber-500 text-white' :
                  listing.itemStatus === 'sold' || listing.itemStatus === 'claimed' ? 'bg-neutral-700 text-white' :
                  'bg-neutral-200 text-neutral-700'
                }>{listing.itemStatus.replace('_', ' ').toUpperCase()}</Badge>
              )}
              {listing.leavingInMinutes != null && listing.leavingInMinutes > 0 && (
                <Badge className="bg-black text-white"><Clock className="mr-1 h-3 w-3" />Leaving in {listing.leavingInMinutes} min</Badge>
              )}
              {listing.condition && <Badge variant="outline" className="text-[10px]">{listing.condition.replace('_', ' ')}</Badge>}
              {listing.category && <Badge variant="outline" className="text-[10px]">{listing.category}</Badge>}
              {listing.sold && <Badge className="bg-neutral-200 text-neutral-700">Sold</Badge>}
            </div>
            {listing.description && <p className="whitespace-pre-wrap text-sm text-neutral-800">{listing.description}</p>}
            {(listing.location || listing.city) && (
              <div className="flex items-start gap-1 text-[11px] text-neutral-600">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  {listing.addressHidden
                    ? <>{[listing.city, listing.state].filter(Boolean).join(', ') || 'Location hidden'} · <span className="font-semibold text-amber-700">exact address shared after reservation</span></>
                    : (listing.location || [listing.city, listing.state, listing.zip].filter(Boolean).join(', '))
                  }
                </span>
              </div>
            )}
            {listing.pickupWindow && (
              <div className="text-[11px] text-neutral-700"><b>Pickup window:</b> {listing.pickupWindow}</div>
            )}
            <header className="flex items-center gap-2 border-t border-neutral-100 pt-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-bold text-white">
                {(listing.seller?.name || '?')[0].toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 text-xs">
                <div className="flex items-center gap-1 font-bold">
                  <span className="truncate">{listing.seller?.name || 'Seller'}</span>
                  {(listing.seller?.isVerified || listing.seller?.verificationLevel?.startsWith?.('verified')) && <BadgeCheck className="h-3 w-3 text-brand-600" />}
                </div>
                {listing.seller?.badge && <div className="text-[10px] text-brand-700">{listing.seller.badge}</div>}
                <div className="text-[10px] text-neutral-500">{timeAgo(listing.createdAt)}</div>
              </div>
            </header>
          </CardContent>
        </Card>

        {/* Active reservation bar */}
        {isReserver && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="space-y-2 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-bold text-amber-900"><Timer className="h-4 w-4" /> You have this reserved</span>
                <span className="rounded-md bg-amber-900 px-2 py-0.5 font-mono text-white">{mmss(myMsLeft)}</span>
              </div>
              <p className="text-xs text-amber-800">First come, first served — coordinate pickup with the seller now. The exact pickup address has been revealed below.</p>
              {!listing.addressHidden && (listing.location || listing.zip) && (
                <div className="rounded-md border border-amber-300 bg-white p-2 text-xs">
                  <div className="font-bold text-neutral-700">Pickup address</div>
                  <div className="text-neutral-800">{listing.location || ''} {[listing.city, listing.state, listing.zip].filter(Boolean).join(', ')}</div>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={message} className="flex-1 bg-brand-600 hover:bg-brand-700"><MessageCircle className="mr-1 h-4 w-4" /> Message seller</Button>
                <Button size="sm" variant="outline" onClick={cancelReserve} disabled={reserving}><X className="mr-1 h-4 w-4" /> Cancel hold</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {someoneElseReservation && !isOwner && (
          <Card className="border-neutral-300 bg-neutral-50">
            <CardContent className="p-3 text-xs text-neutral-700">
              <span className="inline-flex items-center gap-1 font-semibold"><Timer className="h-3.5 w-3.5" /> Another buyer has this reserved right now.</span>
              <div>Their 15-minute hold expires {someoneElseReservation.expiresAt ? new Date(someoneElseReservation.expiresAt).toLocaleTimeString() : 'soon'}. Check back if they don't follow through.</div>
            </CardContent>
          </Card>
        )}

        {isOwner && listing.reservation && (
          <Card className="border-blue-300 bg-blue-50">
            <CardContent className="space-y-2 p-3 text-sm">
              <div className="font-bold text-blue-900">Buyer reserved this item</div>
              <div className="text-xs text-blue-800">Coordinate pickup. When the buyer arrives, mark this complete:</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => completePickup('claimed')} disabled={reserving} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="mr-1 h-4 w-4" /> Mark claimed</Button>
                <Button size="sm" onClick={() => completePickup('sold')} disabled={reserving} variant="outline"><CheckCircle2 className="mr-1 h-4 w-4" /> Mark sold</Button>
                <Button size="sm" onClick={() => completePickup('donated')} disabled={reserving} variant="outline"><Gift className="mr-1 h-4 w-4" /> Mark donated</Button>
                <Button size="sm" onClick={cancelReserve} disabled={reserving} variant="ghost"><X className="mr-1 h-4 w-4" /> Cancel hold</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seller Quick Actions — one-tap, mobile-friendly, role-aware status switcher.
            Each role sees only the statuses relevant to its workflow. */}
        {isOwner && (() => {
          // Resolve role + allowed statuses from the shared lib (kept in sync with backend validation).
          const { key: roleKey, label: roleLabel } = resolveMarketplaceRole(user)
          // Always include the listing's current status so a listing posted
          // under an older role can still be moved away (we just restrict NEW
          // transitions to the current role's allowed set).
          const baseStatuses = allowedStatusesForUser(user)
          const statuses = listing.itemStatus && !baseStatuses.includes(listing.itemStatus)
            ? [listing.itemStatus, ...baseStatuses]
            : baseStatuses
          return (
            <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-white">
              <CardContent className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-900"><Truck className="h-4 w-4" /> Seller quick actions</span>
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">{roleLabel}</span>
                </div>
                <div className={`grid gap-1.5 ${statuses.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : statuses.length <= 6 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                  {statuses.map((s) => {
                    const meta = STATUS_META[s] || { label: s, style: 'bg-neutral-200 text-neutral-700' }
                    const isActive = listing.itemStatus === s
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => quickStatus(s)}
                        disabled={reserving || isActive}
                        className={`min-h-[44px] rounded-md px-2 py-2 text-xs font-bold transition disabled:opacity-50 ${meta.style} ${isActive ? 'ring-2 ring-brand-700 ring-offset-1' : ''}`}
                      >
                        {meta.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[10px] leading-snug text-neutral-600">Statuses shown match your account type ({roleLabel}). Terminal states (Claimed / Sold / Donated / Recycled / Disposed / Processed) clear any active hold.</p>
              </CardContent>
            </Card>
          )
        })()}

        <Card>
          <CardContent className="flex items-start gap-2 p-3 text-xs text-amber-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>Meet in safe public places when possible. Never share personal financial info. Verify items in person before any off-platform payment. <a href="#" onClick={(e) => { e.preventDefault(); }} className="font-semibold underline">Report this listing</a> if anything seems off.</span>
          </CardContent>
        </Card>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-neutral-200 bg-white/95 p-2 backdrop-blur" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" onClick={save} className="h-11 shrink-0 px-3" aria-label="Save"><Bookmark className="h-4 w-4" /></Button>
          {!isOwner && itemActiveForBuyer && !someoneElseReservation && !isReserver && (
            <Button onClick={() => setReserveOpen(true)} className="h-11 flex-1 bg-brand-600 hover:bg-brand-700">
              <Timer className="mr-1 h-4 w-4" /> Reserve Item
            </Button>
          )}
          {(!itemActiveForBuyer || someoneElseReservation || isReserver || isOwner) && (
            <Button onClick={message} disabled={!user || isOwner} className="h-11 flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50">
              <MessageCircle className="mr-1 h-4 w-4" /> {isFree ? 'Message for pickup' : 'Message seller'}
            </Button>
          )}
        </div>
      </div>

      {/* Reserve confirmation modal */}
      {reserveOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setReserveOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-neutral-900 p-6 text-white shadow-2xl">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-neutral-800 text-brand-400">
              <Timer className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-center text-xl font-extrabold">Reserve This Item?</h3>
            <p className="mt-2 text-center text-sm text-neutral-300">You'll have <b>15 minutes</b> to coordinate pickup with the seller.</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> Item will be held for you</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> Seller will share exact location</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> First come, first served</li>
            </ul>
            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={doReserve} disabled={reserving} className="h-12 bg-brand-600 hover:bg-brand-700">
                {reserving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Reserve Now
              </Button>
              <Button variant="ghost" onClick={() => setReserveOpen(false)} disabled={reserving} className="text-neutral-300 hover:bg-neutral-800 hover:text-white">Cancel</Button>
            </div>
          </div>
        </div>
      )}
      <SoftLoginModal action={softLogin} onClose={() => setSoftLogin(null)} />
    </FieldFrame>
  )
}
