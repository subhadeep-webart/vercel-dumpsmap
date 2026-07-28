'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Store,
  Plus,
  Search,
  Heart,
  Send,
  Flag,
  MessageCircle,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Tag,
  Sofa,
  Tv,
  Wrench,
  Forklift,
  Building2,
  Home,
  Package,
  Sparkles,
  Lock,
  X,
  ImageOff,
  Inbox as InboxIcon,
  Star,
  CreditCard,
  User,
  Hand,
  Building,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import ReportButton from '@/components/ReportButton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import PhotoUploader, { toUrlList } from '@/components/PhotoUploader'
import StartDmButton from '@/components/messaging/StartDmButton'

const authHeaders = () => {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const timeAgo = (d) => {
  if (!d) return ''
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h'
  return Math.floor(diff / 86400) + 'd'
}

export const RESIDENTIAL_CATEGORIES = [
  { value: 'furniture', label: 'Furniture', icon: Sofa },
  { value: 'appliances', label: 'Appliances', icon: Package },
  { value: 'electronics', label: 'Electronics', icon: Tv },
  { value: 'tools', label: 'Tools', icon: Wrench },
  { value: 'household', label: 'Household', icon: Home },
  { value: 'yard_garden', label: 'Yard & garden', icon: Package },
  { value: 'reuse', label: 'Reuse / donation', icon: Heart },
  { value: 'baby_kids', label: 'Baby & kids', icon: Package },
  { value: 'sports', label: 'Sports', icon: Package },
  { value: 'other_res', label: 'Other', icon: Tag },
]
export const COMMERCIAL_CATEGORIES = [
  { value: 'pallets', label: 'Pallets', icon: Package },
  { value: 'shelving_fixtures', label: 'Shelving / fixtures', icon: Building2 },
  { value: 'office_furniture', label: 'Office furniture', icon: Sofa },
  { value: 'construction_materials', label: 'Construction materials', icon: Wrench },
  { value: 'restaurant_equipment', label: 'Restaurant equipment', icon: Package },
  { value: 'warehouse_equipment', label: 'Warehouse equipment', icon: Forklift },
  { value: 'bulk_lots', label: 'Bulk lots / liquidation', icon: Package },
  { value: 'scrap_industrial', label: 'Scrap / industrial', icon: Wrench },
  { value: 'electronics_commercial', label: 'Electronics (commercial)', icon: Tv },
  { value: 'other_com', label: 'Other', icon: Tag },
]
export const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'for_parts', label: 'For parts / scrap' },
]
export const KINDS = [
  { value: 'sell', label: 'Sell', color: 'bg-brand-100 text-brand-800 border-brand-200' },
  { value: 'free', label: 'Free', color: 'bg-brand-100 text-brand-800 border-brand-200' },
  { value: 'trade', label: 'Trade', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  { value: 'buy', label: 'Wanted to buy', color: 'bg-violet-100 text-violet-800 border-violet-200' },
  { value: 'request', label: 'Request / Looking for', color: 'bg-amber-100 text-amber-800 border-amber-200' },
]
const DELIVERY = [
  { v: 'pickup', label: 'Buyer pickup' },
  { v: 'local_delivery', label: 'Local delivery' },
  { v: 'meet_halfway', label: 'Meet halfway' },
]

const formatPrice = (l) => {
  if (l.priceType === 'free' || l.kind === 'free') return 'Free'
  if (l.priceType === 'trade' || l.kind === 'trade') return 'Trade'
  if (l.priceType === 'contact') return 'Contact for price'
  if (l.price != null) return `$${l.price}${l.priceType === 'obo' ? ' OBO' : ''}`
  return '—'
}

const allCats = (segment) => (segment === 'commercial' ? COMMERCIAL_CATEGORIES : RESIDENTIAL_CATEGORIES)

// ============================================================
// MAIN INLINE TAB COMPONENT
// ============================================================
export function MarketplaceTab({ user, onLogin }) {
  const [segment, setSegment] = useState('residential')
  const [postOpen, setPostOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <Store className="h-4 w-4 text-brand-600" /> Marketplace
          </div>
          <div className="text-xs text-neutral-500">
            Buy · sell · trade · giveaway — for residents and commercial accounts
          </div>
        </div>
        <Button
          onClick={() => (user ? setPostOpen(true) : onLogin?.())}
          className="bg-brand-600 hover:bg-brand-700"
          size="sm"
        >
          <Plus className="mr-1 h-4 w-4" /> Post listing
        </Button>
      </div>
      <div className="flex gap-1.5">
        <SegmentPill active={segment === 'residential'} onClick={() => setSegment('residential')} icon={Home} label="Residential" />
        <SegmentPill active={segment === 'commercial'} onClick={() => setSegment('commercial')} icon={Building} label="Commercial" />
      </div>
      <MarketplaceFeed key={segment} segment={segment} user={user} onOpen={setDetailId} />

      <MarketplacePostDialog open={postOpen} onOpenChange={setPostOpen} user={user} defaultSegment={segment} onPosted={() => {}} />
      <MarketplaceDetailDialog listingId={detailId} onClose={() => setDetailId(null)} user={user} onAuthRequest={onLogin} />
    </div>
  )
}

function SegmentPill({ active, onClick, label, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold ${
        active ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </button>
  )
}

// ============================================================
// FEED (with filters)
// ============================================================
function MarketplaceFeed({ segment, user, onOpen, mode = 'browse' }) {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [kind, setKind] = useState('all')
  const [condition, setCondition] = useState('all')
  const [maxPrice, setMaxPrice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (segment) p.set('segment', segment)
      if (mode === 'mine') p.set('mine', 'true')
      if (mode === 'saved') p.set('saved', 'true')
      if (category !== 'all') p.set('category', category)
      if (kind !== 'all') p.set('kind', kind)
      if (condition !== 'all') p.set('condition', condition)
      if (maxPrice) p.set('maxPrice', maxPrice)
      if (q) p.set('q', q)
      const r = await fetch(`/api/marketplace?${p.toString()}`, { headers: authHeaders() })
      const j = await r.json()
      setListings(j.listings || [])
    } catch {
      setListings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [segment, category, kind, condition, maxPrice, refreshKey, mode])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setRefreshKey((k) => k + 1)}
            placeholder="Search title, city, material…"
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {allCats(segment).map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All listings</SelectItem>
            {KINDS.map((k) => (<SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger className="h-8 w-auto"><SelectValue placeholder="Condition" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any condition</SelectItem>
            {CONDITIONS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Input
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          onBlur={() => setRefreshKey((k) => k + 1)}
          placeholder="Max $"
          inputMode="decimal"
          className="h-8 w-24"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {loading && <div className="col-span-full p-4 text-sm text-neutral-500">Loading listings…</div>}
        {!loading && listings.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No listings yet. Tap <span className="font-semibold">Post listing</span> to be first.
          </div>
        )}
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} onOpen={() => onOpen?.(l.id)} />
        ))}
      </div>
    </div>
  )
}

// ============================================================
// LISTING CARD (grid tile)
// ============================================================
function ListingCard({ listing, onOpen }) {
  const k = KINDS.find((x) => x.value === listing.kind) || KINDS[0]
  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left transition hover:border-brand-600 hover:shadow ${
      listing.sold ? 'opacity-60' : 'border-neutral-200'
    }`}>
      <button onClick={onOpen} className="flex flex-col overflow-hidden text-left active:bg-neutral-50">
      <div className="relative aspect-square bg-neutral-100">
        {listing.photos?.[0] ? (
          <img src={listing.photos[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
          <Badge className={`border text-[10px] ${k.color}`}>{k.label}</Badge>
          {listing.featured && <Badge className="inline-flex items-center gap-1 border bg-amber-100 text-[10px] text-amber-800"><Star className="h-3 w-3" /> Featured</Badge>}
        </div>
        {listing.sold && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Badge className="bg-neutral-900 text-white">SOLD</Badge>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2">
        <div className="flex items-baseline justify-between gap-1">
          <div className="text-sm font-bold text-brand-700">{formatPrice(listing)}</div>
          <div className="text-[10px] text-neutral-500">{timeAgo(listing.createdAt)}</div>
        </div>
        <div className="line-clamp-1 text-sm font-semibold text-neutral-900">{listing.title}</div>
        <div className="line-clamp-1 text-[11px] text-neutral-500">
          {listing.city || listing.location || '—'}
          {listing.distanceKm != null && ` · ${listing.distanceKm.toFixed(1)} km`}
        </div>
      </div>
      </button>
      <div className="absolute right-1.5 top-1.5">
        <ReportButton kind="marketplace" targetId={listing.id} targetUserId={listing.sellerId} />
      </div>
    </div>
  )
}

// ============================================================
// POST DIALOG
// ============================================================
export function MarketplacePostDialog({ open, onOpenChange, user, defaultSegment = 'residential', onPosted, existing = null }) {
  const [segment, setSegment] = useState(existing?.segment || defaultSegment)
  const [kind, setKind] = useState(existing?.kind || 'sell')
  const [title, setTitle] = useState(existing?.title || '')
  const [category, setCategory] = useState(existing?.category || (defaultSegment === 'commercial' ? 'pallets' : 'furniture'))
  const [condition, setCondition] = useState(existing?.condition || 'good')
  const [description, setDescription] = useState(existing?.description || '')
  const [photos, setPhotos] = useState(existing?.photos ? existing.photos.map((u) => ({ url: u })) : [])
  const [price, setPrice] = useState(existing?.price != null ? String(existing.price) : '')
  const [priceType, setPriceType] = useState(existing?.priceType || 'fixed')
  const [quantity, setQuantity] = useState(existing?.quantity || 1)
  const [city, setCity] = useState(existing?.city || '')
  const [stateField, setStateField] = useState(existing?.state || 'CA')
  const [zip, setZip] = useState(existing?.zip || '')
  const [location, setLocation] = useState(existing?.location || '')
  const [delivery, setDelivery] = useState(existing?.deliveryOptions || ['pickup'])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { setSegment(defaultSegment) }, [defaultSegment])
  useEffect(() => {
    // reset category when segment changes
    if (!allCats(segment).some((c) => c.value === category)) {
      setCategory(allCats(segment)[0].value)
    }
  }, [segment])

  const submit = async () => {
    if (!user) return toast.error('Log in first')
    if (!title.trim()) return toast.error('Please add a title')
    if (kind === 'sell' && !price && priceType === 'fixed') return toast.error('Please add a price or change price type')
    setSubmitting(true)
    try {
      const payload = {
        segment, kind,
        title: title.trim(),
        category, condition,
        description,
        photos: toUrlList(photos),
        price: price ? parseFloat(price) : null,
        priceType: kind === 'free' ? 'free' : (kind === 'trade' ? 'trade' : priceType),
        quantity: parseInt(quantity, 10) || 1,
        location, city, state: stateField, zip,
        deliveryOptions: delivery,
      }
      const r = await fetch('/api/marketplace', {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      toast.success(existing ? 'Listing updated' : 'Listing posted!')
      onOpenChange(false)
      onPosted?.(j.listing)
      if (!existing) {
        // reset
        setTitle(''); setDescription(''); setPhotos([]); setPrice('')
      }
    } catch (e) {
      toast.error(e.message || 'Could not save listing')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-neutral-200 px-4 py-3 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-brand-600" />
            {existing ? 'Edit listing' : 'Post a listing'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Share what you're selling, trading, or giving away. Tap photos to add up to 10.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh] px-4 pb-4 pt-3 sm:px-6">
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Marketplace</Label>
              <div className="mt-1 flex gap-1.5">
                <SegmentPill active={segment === 'residential'} onClick={() => setSegment('residential')} icon={Home} label="Residential" />
                <SegmentPill active={segment === 'commercial'} onClick={() => setSegment('commercial')} icon={Building} label="Commercial" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Listing type</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    onClick={() => setKind(k.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      kind === k.value ? 'border-brand-600 bg-brand-50 text-brand-800' : k.color
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="E.g. IKEA Kallax shelf · Free in San Jose" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allCats(segment).map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Size, condition, brand, why you're selling…" />
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3">
              <PhotoUploader value={photos} onChange={setPhotos} max={10} label="Photos" hint="Up to 10 — camera or upload" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Price ($)</Label>
                <Input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={kind === 'free' ? 'Free' : '125'}
                  inputMode="decimal"
                  disabled={kind === 'free' || kind === 'trade'}
                />
              </div>
              <div>
                <Label>Price type</Label>
                <Select value={priceType} onValueChange={setPriceType} disabled={kind === 'free' || kind === 'trade'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="obo">OBO (or best offer)</SelectItem>
                    <SelectItem value="contact">Contact for price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min="1" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Label>Pickup location / neighborhood</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Willow Glen, near Lincoln Ave" />
              </div>
              <div>
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Jose" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>State</Label>
                  <Input value={stateField} onChange={(e) => setStateField(e.target.value)} maxLength={2} />
                </div>
                <div>
                  <Label>ZIP</Label>
                  <Input value={zip} onChange={(e) => setZip(e.target.value)} maxLength={10} />
                </div>
              </div>
            </div>
            <div>
              <Label>Delivery options</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {DELIVERY.map((d) => {
                  const on = delivery.includes(d.v)
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => setDelivery((arr) => on ? arr.filter((x) => x !== d.v) : [...arr, d.v])}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-neutral-600'}`}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Payment teaser */}
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="inline-flex items-center gap-1 font-semibold"><CreditCard className="h-4 w-4" /> Secure marketplace payments — coming soon</div>
                  <div className="mt-0.5">For now, arrange payment offline. Buyer protection &amp; in-app payments launch in a future phase.</div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
        <div className="border-t border-neutral-200 px-4 py-3 sm:px-6">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="bg-brand-600 hover:bg-brand-700">
              {submitting ? 'Posting…' : existing ? 'Save changes' : 'Post listing'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// DETAIL DIALOG
// ============================================================
export function MarketplaceDetailDialog({ listingId, onClose, user, onAuthRequest }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('details')
  const [messages, setMessages] = useState([])
  const [msgInput, setMsgInput] = useState('')
  const [reportOpen, setReportOpen] = useState(false)

  const load = async () => {
    if (!listingId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/marketplace/${listingId}`, { headers: authHeaders() })
      const j = await r.json()
      setData(j.listing || null)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async () => {
    if (!listingId || !user) return
    try {
      const r = await fetch(`/api/marketplace/${listingId}/messages`, { headers: authHeaders() })
      const j = await r.json()
      if (r.ok) setMessages(j.messages || [])
    } catch {}
  }

  useEffect(() => { if (listingId) { load(); setTab('details') } }, [listingId])
  useEffect(() => { if (tab === 'messages') loadMessages() }, [tab, listingId])

  // 5s polling for messages while messages tab is open
  useEffect(() => {
    if (tab !== 'messages' || !listingId) return
    const t = setInterval(loadMessages, 5000)
    return () => clearInterval(t)
  }, [tab, listingId])

  if (!listingId) return null
  const isSeller = user && data && data.sellerId === user.id

  const doAction = async (path, body = {}, success = 'Done') => {
    if (!user) return onAuthRequest?.()
    try {
      const r = await fetch(`/api/marketplace/${listingId}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      toast.success(success)
      load()
      return j
    } catch (e) {
      toast.error(e.message || 'Failed')
    }
  }

  const sendMsg = async () => {
    if (!msgInput.trim()) return
    try {
      const r = await fetch(`/api/marketplace/${listingId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ message: msgInput.trim() }),
      })
      if (r.ok) {
        setMsgInput('')
        loadMessages()
      }
    } catch {
      toast.error('Could not send message')
    }
  }

  const markSold = async () => {
    if (!isSeller) return
    try {
      const r = await fetch(`/api/marketplace/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ sold: true }),
      })
      const j = await r.json()
      if (r.ok) { toast.success('Marked sold'); load() }
    } catch { toast.error('Failed') }
  }

  const k = data && (KINDS.find((x) => x.value === data.kind) || KINDS[0])

  return (
    <Dialog open={!!listingId} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-neutral-200 px-4 py-3 sm:px-6">
          <DialogTitle className="line-clamp-2 pr-6 text-base sm:text-lg">
            {loading ? 'Loading…' : data?.title || 'Listing'}
          </DialogTitle>
          {data && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              {k && <Badge className={`border ${k.color}`}>{k.label}</Badge>}
              <Badge variant="outline" className="capitalize">{data.condition?.replace('_', ' ')}</Badge>
              <Badge variant="outline" className="capitalize">{data.segment}</Badge>
              {data.sold && <Badge className="bg-neutral-900 text-white">SOLD</Badge>}
              <span className="text-neutral-500">· {timeAgo(data.createdAt)}</span>
            </div>
          )}
        </DialogHeader>

        {data && (
          <Tabs value={tab} onValueChange={setTab} className="px-4 sm:px-6">
            <TabsList className="mt-3 w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="messages" className="flex-1">
                Messages {data.messageCount > 0 && <Badge className="ml-1 h-4 px-1 text-[9px]">{data.messageCount}</Badge>}
              </TabsTrigger>
            </TabsList>
            <ScrollArea className="mt-3 max-h-[55vh] pr-2">
              <TabsContent value="details" className="space-y-3">
                {data.photos && data.photos.length > 0 && (
                  <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1">
                    {data.photos.map((src, i) => (
                      <img key={i} src={src} alt="" className="h-48 shrink-0 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
                <div className="text-2xl font-bold text-brand-700">{formatPrice(data)}</div>
                {data.description && <p className="whitespace-pre-wrap text-sm text-neutral-700">{data.description}</p>}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <DetailLine label="Quantity" value={data.quantity} />
                  <DetailLine label="Pickup" value={(data.deliveryOptions || []).map((d) => DELIVERY.find((x) => x.v === d)?.label || d).join(', ') || '—'} />
                  <DetailLine label="Location" value={[data.location, data.city, data.state, data.zip].filter(Boolean).join(', ') || '—'} />
                  {data.distanceKm != null && <DetailLine label="Distance" value={`${data.distanceKm.toFixed(1)} km`} />}
                </div>
                {data.seller && (
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs">
                    <div className="flex items-center gap-2">
                      {data.seller.avatarUrl ? (
                        <img src={data.seller.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-neutral-500"><User className="h-4 w-4" /></div>
                      )}
                      <div>
                        <div className="font-semibold">{data.seller.name}</div>
                        <div className="text-[10px] text-neutral-500">Karma {data.seller.karma}</div>
                      </div>
                      {data.seller.isVerified && <Badge className="ml-auto bg-brand-100 text-[10px] text-brand-800">Verified</Badge>}
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="messages">
                {!user && (
                  <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
                    Log in to message the seller.
                    <div className="mt-3"><Button onClick={onAuthRequest} className="bg-brand-600 hover:bg-brand-700">Log in</Button></div>
                  </div>
                )}
                {user && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {messages.length === 0 && (
                        <div className="inline-flex w-full items-center justify-center gap-1 text-center text-xs text-neutral-500">No messages yet — say hi <Hand className="h-3.5 w-3.5" /> (messages auto-refresh every 5s)</div>
                      )}
                      {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.senderId === user.id ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                            {m.message}
                            <div className={`mt-0.5 text-[10px] ${m.senderId === user.id ? 'text-brand-100' : 'text-neutral-500'}`}>{timeAgo(m.createdAt)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={msgInput}
                        onChange={(e) => setMsgInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
                        placeholder="Type your message…"
                      />
                      <Button onClick={sendMsg} className="bg-brand-600 hover:bg-brand-700"><Send className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}

        {data && (
          <div className="border-t border-neutral-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => doAction('/save', {}, 'Saved')}>
                <Heart className="mr-1 h-4 w-4" /> Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
                <Flag className="mr-1 h-4 w-4 text-red-500" /> Report
              </Button>
              {isSeller && !data.sold && (
                <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={markSold}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Mark sold
                </Button>
              )}
              {!isSeller && (
                <>
                  <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={() => { if (!user) onAuthRequest?.(); else setTab('messages') }}>
                    <MessageCircle className="mr-1 h-4 w-4" /> Message seller
                  </Button>
                  {user && data?.sellerId && data.sellerId !== user.id && (
                    <StartDmButton
                      targetUserId={data.sellerId}
                      targetUserName={data.seller?.name || 'Seller'}
                      currentUser={user}
                      token={typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null}
                      size="sm"
                      variant="outline"
                      label="DM"
                      className="border-blue-300 text-blue-700 hover:bg-blue-50"
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <ReportDialog open={reportOpen} onOpenChange={setReportOpen} listingId={listingId} />
      </DialogContent>
    </Dialog>
  )
}

function DetailLine({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-sm text-neutral-800">{value}</div>
    </div>
  )
}

function ReportDialog({ open, onOpenChange, listingId }) {
  const [reason, setReason] = useState('Spam')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      const r = await fetch(`/api/marketplace/${listingId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reason, notes }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      toast.success('Report submitted — moderators will review')
      onOpenChange(false)
    } catch (e) {
      toast.error(e.message || 'Failed')
    } finally { setBusy(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Flag className="h-4 w-4 text-red-600" /> Report listing</DialogTitle>
          <DialogDescription className="text-xs">Help keep DumpMaps safe and clean.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Spam">Spam</SelectItem>
                <SelectItem value="Fraud / Scam">Fraud / scam</SelectItem>
                <SelectItem value="Prohibited item">Prohibited item</SelectItem>
                <SelectItem value="Offensive">Offensive content</SelectItem>
                <SelectItem value="Wrong category">Wrong category</SelectItem>
                <SelectItem value="Duplicate">Duplicate</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="More context for moderators…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy} className="bg-red-600 hover:bg-red-700">Submit report</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// INBOX (combined marketplace + jobs threads, with 5s polling + unread badge)
// ============================================================
export function useInboxBadge(user) {
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    if (!user) return
    let alive = true
    const load = async () => {
      try {
        // Try the unified counter (DM + marketplace + jobs + group chats)
        const r = await fetch('/api/inbox/unread-count', { headers: authHeaders() })
        if (r.ok) {
          const j = await r.json()
          if (alive) setUnread(j.count || 0)
          return
        }
        // Fallback to legacy marketplace+jobs counter
        const r2 = await fetch('/api/marketplace/inbox/threads', { headers: authHeaders() })
        if (!r2.ok) return
        const j2 = await r2.json()
        if (alive) setUnread(j2.totalUnread || 0)
      } catch {}
    }
    load()
    const t = setInterval(load, 5000)
    return () => { alive = false; clearInterval(t) }
  }, [user])
  return unread
}

export function InboxDialog({ open, onOpenChange, user, onAuthRequest, onOpenListing, onOpenJob }) {
  const [data, setData] = useState({ marketplaceThreads: [], jobThreads: [], totalUnread: 0 })
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      const r = await fetch('/api/marketplace/inbox/threads', { headers: authHeaders() })
      const j = await r.json()
      setData(j)
    } finally { setLoading(false) }
  }

  useEffect(() => { if (open) load() }, [open, user])
  useEffect(() => {
    if (!open) return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [open, user])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-neutral-200 px-4 py-3 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <InboxIcon className="h-5 w-5 text-brand-600" /> Inbox
            {data.totalUnread > 0 && <Badge className="bg-red-600 text-white">{data.totalUnread} unread</Badge>}
          </DialogTitle>
          <DialogDescription className="text-xs">Marketplace and job conversations · refreshes every 5s</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh] p-3 sm:p-6">
          {!user && (
            <div className="p-4 text-center text-sm text-neutral-500">
              Log in to view your inbox.
              <div className="mt-3"><Button onClick={onAuthRequest} className="bg-brand-600 hover:bg-brand-700">Log in</Button></div>
            </div>
          )}
          {user && loading && <div className="p-4 text-sm text-neutral-500">Loading…</div>}
          {user && !loading && data.marketplaceThreads.length === 0 && data.jobThreads.length === 0 && (
            <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
              No messages yet. Tap "Message seller" or "Message customer" on any listing or job to start a conversation.
            </div>
          )}
          {user && data.marketplaceThreads.length > 0 && (
            <div className="mb-4">
              <div className="mb-1 text-xs font-bold text-neutral-500">Marketplace</div>
              <div className="space-y-2">
                {data.marketplaceThreads.map((t, i) => (
                  <ThreadRow key={i} t={t} onClick={() => onOpenListing?.(t.listingId)} />
                ))}
              </div>
            </div>
          )}
          {user && data.jobThreads.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-bold text-neutral-500">Jobs</div>
              <div className="space-y-2">
                {data.jobThreads.map((t, i) => (
                  <ThreadRow key={i} t={{ ...t, listingId: t.jobId }} onClick={() => onOpenJob?.(t.jobId)} kind="job" />
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function ThreadRow({ t, onClick, kind = 'marketplace' }) {
  return (
    <button onClick={onClick} className="flex w-full items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left hover:border-brand-600 active:bg-neutral-50">
      {t.listingPhoto ? (
        <img src={t.listingPhoto} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-400">
          {kind === 'job' ? <Wrench className="h-5 w-5" /> : <Store className="h-5 w-5" />}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="truncate text-sm font-semibold">{t.listingTitle}</div>
          {t.unread > 0 && (
            <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {t.unread}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-neutral-500">{t.otherUserName} · {timeAgo(t.lastMessageAt)}</div>
        <div className="mt-1 line-clamp-1 text-xs text-neutral-700">{t.lastMessage}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
    </button>
  )
}
