'use client'

// Commercial B2B Marketplace tab
// ---------------------------------------------------------------------------
// Public-readable B2B exchange. Anyone can browse + search. Posting,
// messaging, offering, reserving, and marking-sold are gated behind
// hasCommercialAccess() — non-approved users see the Apply CTA.

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  ShieldCheck, Lock, Plus, Search, MapPin, Building2, Truck,
  Wrench, Package, Boxes, Loader2, Recycle, Tag, ArrowRight, CheckCircle2,
} from 'lucide-react'
import CommercialAccessApplyDialog from './CommercialAccessApplyDialog'
import PostCommercialListingDialog from './PostCommercialListingDialog'
import SafeImage from '@/components/SafeImage'

function authHeaders() {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}
function authFetch(url, opts = {}) {
  return fetch(url, { ...opts, headers: { ...(opts.headers || {}), ...authHeaders() } })
}
function fmtUSD(n) {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n) }
  catch { return `$${Number(n).toFixed(2)}` }
}

const CATEGORY_ICONS = {
  equipment: Wrench,
  materials: Package,
  vehicles: Truck,
  commercial_inventory: Boxes,
  services: Building2,
  wholesale_liquidation: Tag,
}

const SELLER_TYPE_LABELS = {
  contractor: 'Contractor',
  vendor: 'Vendor',
  facility_owner: 'Facility Owner',
  property_manager: 'Property Mgr',
  recycler: 'Recycler',
}

function fmtMoney(n, c = 'USD') {
  if (n == null || !Number.isFinite(Number(n))) return null
  try { return fmtUSD(Number(n)) } catch { return `$${Number(n).toFixed(2)}` }
}

function VerificationBadge({ tier, verified }) {
  if (tier === 'pro' || tier === 'enterprise') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
        <ShieldCheck className="h-3 w-3" /> {tier === 'enterprise' ? 'Enterprise' : 'Pro'}
      </span>
    )
  }
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-800">
        <ShieldCheck className="h-3 w-3" /> Verified
      </span>
    )
  }
  return null
}

function LockedActionCTA({ onApply, label = 'Apply for Commercial Access' }) {
  return (
    <button
      onClick={onApply}
      className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
    >
      <Lock className="h-3 w-3" /> {label}
    </button>
  )
}

function ListingCard({ listing, hasAccess, onApply, onOpen, onMessage }) {
  const Icon = CATEGORY_ICONS[listing.b2bCategory] || Boxes
  const price = fmtMoney(listing.price, listing.currency)
  const sellerTypeLabel = SELLER_TYPE_LABELS[listing.sellerType] || listing.sellerType
  const photo = listing.photos?.[0]
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:border-brand-300 hover:shadow-md">
      <button onClick={() => onOpen?.(listing)} className="relative block aspect-[4/3] w-full overflow-hidden bg-neutral-100 text-left">
        <SafeImage src={photo} alt={listing.title} kind="listing" className="h-full w-full object-cover transition group-hover:scale-105" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-700 backdrop-blur">
            <Icon className="h-3 w-3 text-brand-600" />
            {listing.b2bCategory?.replace(/_/g, ' ')}
          </span>
          {listing.condition && listing.condition !== 'good' && (
            <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-700 backdrop-blur">
              {listing.condition.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <div className="absolute right-2 top-2">
          <VerificationBadge tier={listing.sellerMembership} verified={listing.sellerVerified} />
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <button onClick={() => onOpen?.(listing)} className="text-left">
          <div className="line-clamp-1 text-sm font-bold text-neutral-900 group-hover:text-brand-700">{listing.title}</div>
          {listing.description && <div className="line-clamp-2 text-xs text-neutral-600">{listing.description}</div>}
        </button>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-1.5 text-[11px] text-neutral-500">
          <div className="flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{[listing.city, listing.state].filter(Boolean).join(', ') || 'Location TBD'}</span>
          </div>
          {listing.quantity && listing.quantity > 1 && (
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 font-semibold">Qty {listing.quantity}</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-2">
          <div>
            <div className="text-base font-extrabold text-neutral-900">{price || <span className="text-xs font-normal italic text-neutral-500">Contact for price</span>}</div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">{sellerTypeLabel}</div>
          </div>
          {hasAccess ? (
            <Button size="sm" variant="outline" onClick={() => onMessage?.(listing)} className="h-7 px-2 text-xs">
              Message
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          ) : (
            <LockedActionCTA onApply={onApply} label="Apply to Message" />
          )}
        </div>
      </div>
    </div>
  )
}

export default function CommercialB2BTab({ user, openApplyOnMount = false }) {
  const router = useRouter()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [categories, setCategories] = useState([])
  const [access, setAccess] = useState(null)            // /api/commercial-access/me result
  const [applyOpen, setApplyOpen] = useState(!!openApplyOnMount)
  const [postOpen, setPostOpen] = useState(false)

  // Fetch access status whenever user changes
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await authFetch('/api/commercial-access/me')
        const j = await r.json()
        if (alive) setAccess(j)
      } catch {
        if (alive) setAccess({ loggedIn: !!user, hasAccess: false, reason: 'error' })
      }
    })()
    return () => { alive = false }
  }, [user?.id])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (category && category !== 'all') params.set('category', category)
      if (search.trim()) params.set('q', search.trim())
      if (verifiedOnly) params.set('verifiedOnly', 'true')
      params.set('limit', '120')
      const r = await fetch('/api/marketplace/commercial?' + params.toString())
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed to load B2B listings')
      setListings(j.listings || [])
      setCategories(j.categories || [])
    } catch (e) {
      setError(e.message || 'Failed to load')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [category, verifiedOnly])

  const onSearchSubmit = (e) => { e.preventDefault(); load() }

  const hasAccess = !!access?.hasAccess

  const handlePostClick = () => {
    if (!user) {
      router.push('/?login=1&returnTo=/marketplace?tab=commercial_b2b')
      return
    }
    if (!hasAccess) { setApplyOpen(true); return }
    setPostOpen(true)
  }

  const handleOpenListing = (l) => {
    router.push(`/marketplace/${l.id}`)
  }
  const handleMessage = (l) => {
    if (!user) {
      router.push(`/?login=1&returnTo=/marketplace/${l.id}`)
      return
    }
    if (!hasAccess) { setApplyOpen(true); return }
    router.push(`/marketplace/${l.id}#message`)
  }

  const allCategories = useMemo(() => {
    return [{ key: 'all', label: 'All B2B' }, ...categories]
  }, [categories])

  return (
    <div className="space-y-4">
      {/* Hero strip */}
      <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-800">
              <Building2 className="h-3 w-3" /> Commercial Exchange
            </div>
            <h2 className="mt-1.5 text-xl font-extrabold tracking-tight text-neutral-900">Commercial B2B Marketplace</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-neutral-600">
              The exchange network for contractors, vendors, recyclers, facilities, property managers, liquidators, and haulers. Bulk equipment, materials, vehicles, FF&amp;E, services, and wholesale lots — verified sellers only.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Button onClick={handlePostClick} className="rounded-full bg-indigo-600 px-4 hover:bg-indigo-700">
              {hasAccess ? <Plus className="mr-1 h-4 w-4" /> : <Lock className="mr-1 h-4 w-4" />}
              {hasAccess ? 'Post B2B Listing' : 'Apply for Commercial Access'}
            </Button>
            {access && !access.hasAccess && access.reason !== 'not_signed_in' && (
              <span className="text-[10px] uppercase tracking-wider text-amber-700">
                {access.reason === 'pending_review' ? 'Application pending review' : access.reason === 'denied' ? 'Application denied' : 'No commercial access yet'}
              </span>
            )}
            {hasAccess && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Commercial access enabled
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search + category chips */}
      <div className="space-y-3">
        <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, materials, or description…"
              className="h-10 pl-9"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10">Search</Button>
          <label className="ml-1 hidden cursor-pointer items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 md:inline-flex">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Verified only
          </label>
        </form>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {allCategories.map((c) => {
            const Icon = CATEGORY_ICONS[c.key] || Boxes
            const active = category === c.key
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${active ? 'bg-indigo-600 text-white shadow-sm' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
              >
                {c.key !== 'all' && <Icon className={`h-3.5 w-3.5 ${active ? '' : 'text-indigo-600'}`} />}
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Listings */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-sm text-neutral-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading B2B listings…
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}
      {!loading && !error && listings.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <Boxes className="mx-auto h-10 w-10 text-neutral-300" />
          <div className="mt-2 text-sm font-bold text-neutral-900">No B2B listings yet in this category</div>
          <div className="mt-1 text-xs text-neutral-600">
            Be the first to post — contractors, vendors, and facilities are watching this feed.
          </div>
          <div className="mt-3">
            <Button onClick={handlePostClick} className="bg-indigo-600 hover:bg-indigo-700">
              {hasAccess ? <Plus className="mr-1 h-4 w-4" /> : <Lock className="mr-1 h-4 w-4" />}
              {hasAccess ? 'Post B2B Listing' : 'Apply for Commercial Access'}
            </Button>
          </div>
        </div>
      )}
      {!loading && !error && listings.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              hasAccess={hasAccess}
              onApply={() => setApplyOpen(true)}
              onOpen={handleOpenListing}
              onMessage={handleMessage}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CommercialAccessApplyDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onApproved={() => { setApplyOpen(false); toast.success('Approved! You can now post B2B listings.'); /* refetch access */ ;(async () => { try { const r = await authFetch('/api/commercial-access/me'); setAccess(await r.json()) } catch {} })() }}
        onPending={() => { setApplyOpen(false); toast.success('Application received — admin will review shortly.'); ;(async () => { try { const r = await authFetch('/api/commercial-access/me'); setAccess(await r.json()) } catch {} })() }}
        currentAccess={access}
      />
      <PostCommercialListingDialog
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onCreated={() => { setPostOpen(false); toast.success('Listing posted'); load() }}
      />
    </div>
  )
}
