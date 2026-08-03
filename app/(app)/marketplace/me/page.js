'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Heart, Bookmark, Bell, MessageCircle, Timer, CheckCircle2, Package,
  Sparkles, CircleDollarSign, Eye, Recycle, Bookmark as BookmarkIcon, MapPin,
  ShoppingBag, Plus, X, Trash2, Pencil, BellOff,
} from 'lucide-react'
import CategoryPlaceholder from '@/components/marketplace/CategoryPlaceholder'
import { isLikelyLoggedIn } from '@/lib/api-client'

function normalizePhoto(url) {
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('/uploads/')) return `/api/files/${url.slice('/uploads/'.length)}`
  return url
}

const TABS = [
  { value: 'saved',      label: 'Saved',              icon: BookmarkIcon },
  { value: 'reserved',   label: 'Reserved',           icon: Timer },
  { value: 'messages',   label: 'Messages',           icon: MessageCircle },
  { value: 'claimed',    label: 'Claimed',            icon: CheckCircle2 },
  { value: 'alerts',     label: 'Nearby Alerts',      icon: Bell },
  { value: 'searches',   label: 'Saved Searches',     icon: Sparkles },
]

const statusStyle = (s) => ({
  on_truck: 'bg-emerald-600 text-white',
  at_site: 'bg-blue-600 text-white',
  last_chance: 'bg-rose-600 text-white',
  reserved: 'bg-amber-500 text-white',
  sold: 'bg-neutral-700 text-white',
  claimed: 'bg-neutral-700 text-white',
  donated: 'bg-purple-600 text-white',
}[s] || 'bg-neutral-200 text-neutral-700')

const priceLabel = (l) => {
  if (l.priceType === 'free' || l.price === 0) return 'FREE'
  if (l.priceType === 'donation') return 'DONATION'
  if (l.priceType === 'trade') return 'TRADE'
  if (l.priceType === 'obo') return l.price ? `$${l.price} or Make Offer` : 'Make Offer'
  return l.price != null ? `$${l.price}` : '—'
}

function ListingTile({ l, extra }) {
  const [imgFailed, setImgFailed] = useState(false)
  return (
    <Link href={`/marketplace/${l.id}`} className="block group">
      <Card className="overflow-hidden transition group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="relative aspect-[4/3] w-full bg-neutral-100">
          {l.photos?.[0] && !imgFailed ? (
            <img
              src={normalizePhoto(l.photos[0])}
              alt={l.title}
              className="h-full w-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <CategoryPlaceholder category={l.category} size="sm" />
          )}
          {l.itemStatus && l.itemStatus !== 'available' && (
            <span className={`absolute left-2 top-2 rounded px-2 py-0.5 text-[10px] font-bold ${statusStyle(l.itemStatus)}`}>
              {l.itemStatus.replace('_', ' ').toUpperCase()}
            </span>
          )}
          {l.reservation?.msRemaining > 0 && (
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
              <Timer className="h-3 w-3" />{Math.floor((l.reservation.msRemaining||0)/60000)}:{String(Math.floor(((l.reservation.msRemaining||0)%60000)/1000)).padStart(2,'0')}
            </span>
          )}
        </div>
        <CardContent className="space-y-1 p-3">
          <div className="line-clamp-1 text-sm font-bold">{l.title}</div>
          <div className={`text-base font-extrabold ${l.priceType === 'free' || l.price === 0 ? 'text-emerald-600' : 'text-neutral-900'}`}>{priceLabel(l)}</div>
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{l.city || '—'}</span>
            {extra}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function MetricCard({ icon: Icon, label, value, accent = 'brand' }) {
  const accents = {
    brand: 'from-brand-50 to-white text-brand-700',
    green: 'from-emerald-50 to-white text-emerald-700',
    rose: 'from-rose-50 to-white text-rose-700',
    amber: 'from-amber-50 to-white text-amber-700',
    purple: 'from-purple-50 to-white text-purple-700',
  }[accent]
  return (
    <Card className="border-neutral-200">
      <CardContent className={`flex items-center gap-3 bg-gradient-to-br p-4 ${accents}`}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-current shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{label}</div>
          <div className="text-xl font-extrabold text-neutral-900">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function SavedSearchEditor({ open, initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { name: '', category: '', city: '', keyword: '', maxKm: '', priceType: '', freeOnly: false, donationOnly: false, enabled: true })
  useEffect(() => { setForm(initial || { name: '', category: '', city: '', keyword: '', maxKm: '', priceType: '', freeOnly: false, donationOnly: false, enabled: true }) }, [initial])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{initial?.id ? 'Edit saved search' : 'New saved search'}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-neutral-500" /></button>
        </div>
        <div className="space-y-2 text-sm">
          <Input placeholder="Search name (e.g. Free office furniture near Hayward)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Category (Furniture / Appliances / Scrap Metal …)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Input placeholder="City contains…" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input placeholder="Keyword (matches title, description, tags)" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.freeOnly} onChange={(e) => setForm({ ...form, freeOnly: e.target.checked })} /> Free only</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.donationOnly} onChange={(e) => setForm({ ...form, donationOnly: e.target.checked })} /> Donation only</label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} className="bg-brand-600 hover:bg-brand-700">Save</Button>
        </div>
      </div>
    </div>
  )
}

// useSearchParams() must live inside a <Suspense> boundary (see default export
// below) so the page can be statically prerendered without a CSR bailout.
function BuyerDashboardPageInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const initialTab = sp.get('tab') || 'saved'
  const [tab, setTab] = useState(initialTab)
  const [user, setUser] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // saved-search edit object
  const [editorOpen, setEditorOpen] = useState(false)

  // Load me
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isLikelyLoggedIn()) { router.push('/?login=1&returnTo=/marketplace/me'); return }
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (!j?.user) { router.push('/?login=1&returnTo=/marketplace/me'); return }
        setUser(j.user)
      })
      .catch(() => router.push('/?login=1&returnTo=/marketplace/me'))
  }, [router])

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/marketplace/me')
      if (r.status === 401) { router.push('/?login=1&returnTo=/marketplace/me'); return }
      const j = await r.json()
      setData(j)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { if (user) load() /* eslint-disable-line */ }, [user])

  // Live countdown refresh once per second when on reserved tab
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (tab !== 'reserved') return
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [tab])
  const reservedWithLive = useMemo(() => {
    if (!data?.reserved) return []
    return data.reserved.map((l) => {
      if (!l.reservation?.expiresAt) return l
      const msRemaining = Math.max(0, new Date(l.reservation.expiresAt).getTime() - Date.now())
      return { ...l, reservation: { ...l.reservation, msRemaining } }
    })
  }, [data?.reserved, tick])

  // Saved-search handlers
  const onSaveSearch = async (form) => {
    try {
      const url = form.id ? `/api/marketplace/saved-searches/${form.id}` : '/api/marketplace/saved-searches'
      const method = form.id ? 'PATCH' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!r.ok) throw new Error((await r.json()).error || 'Failed')
      toast.success(form.id ? 'Saved search updated' : 'Saved search created')
      setEditorOpen(false)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }
  const onDeleteSearch = async (id) => {
    if (!confirm('Delete this saved search?')) return
    const r = await fetch(`/api/marketplace/saved-searches/${id}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Deleted'); load() }
  }
  const onToggleSearch = async (s) => {
    const r = await fetch(`/api/marketplace/saved-searches/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !s.enabled }) })
    if (r.ok) load()
  }

  const m = data?.metrics || {}

  return (
    <div className="min-h-screen bg-neutral-50">

      <main className="container mx-auto px-4 py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">My Marketplace</h1>
            <p className="text-sm text-neutral-600">Track items you've saved, reserved, claimed, and alerts you've set up.</p>
          </div>
          <Link href="/marketplace" className="inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">Browse Marketplace</Link>
        </div>

        {/* Metric strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard icon={BookmarkIcon} label="Items Saved"    value={m.itemsSaved ?? 0}                                             accent="brand"  />
          <MetricCard icon={Timer}        label="Items Reserved" value={m.itemsReserved ?? 0}                                          accent="amber"  />
          <MetricCard icon={CheckCircle2} label="Items Claimed"  value={m.itemsClaimed ?? 0}                                           accent="green"  />
          <MetricCard icon={CircleDollarSign}   label="Value Recovered" value={`$${(m.valueRecovered ?? 0).toLocaleString()}`}              accent="green"  />
          <MetricCard icon={Eye}          label="Listings Viewed" value={(m.listingsViewed ?? 0).toLocaleString()}                    accent="purple" />
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-1.5 border-b border-neutral-200 pb-2">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setTab(t.value); router.replace(`/marketplace/me?tab=${t.value}`, { scroll: false }) }}
              className={`inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-semibold ${tab === t.value ? 'border-b-2 border-brand-600 text-brand-700' : 'text-neutral-600 hover:text-neutral-900'}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {t.value === 'messages' && m.unreadMessages > 0 && <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{m.unreadMessages}</span>}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="mt-5">
          {loading ? (
            <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>
          ) : (
            <>
              {tab === 'saved' && (
                data?.saved?.length === 0 ? (
                  <Empty icon={BookmarkIcon} title="No saved items yet" cta="Browse Marketplace" href="/marketplace" />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {data?.saved?.map((l) => <ListingTile key={l.id} l={l} />)}
                  </div>
                )
              )}
              {tab === 'reserved' && (
                reservedWithLive.length === 0 ? (
                  <Empty icon={Timer} title="No active reservations" cta="Find items to reserve" href="/marketplace" />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {reservedWithLive.map((l) => <ListingTile key={l.id} l={l} extra={l.reservation?.msRemaining > 0 ? <span className="font-bold text-amber-700">{Math.floor(l.reservation.msRemaining/60000)}:{String(Math.floor((l.reservation.msRemaining%60000)/1000)).padStart(2,'0')}</span> : <span className="text-rose-600">Expired</span>} />)}
                  </div>
                )
              )}
              {tab === 'messages' && (
                <Card>
                  <CardContent className="space-y-2 p-5 text-sm">
                    <div className="flex items-center gap-2 text-base font-bold"><MessageCircle className="h-4 w-4" /> Marketplace messages</div>
                    <p className="text-neutral-600">You have {m.unreadMessages || 0} unread message{(m.unreadMessages||0)===1?'':'s'}.</p>
                    <Button asChild className="bg-brand-600 hover:bg-brand-700"><Link href="/inbox">Open Inbox →</Link></Button>
                  </CardContent>
                </Card>
              )}
              {tab === 'claimed' && (
                data?.claimed?.length === 0 ? (
                  <Empty icon={CheckCircle2} title="You haven't claimed any items yet" cta="Browse Marketplace" href="/marketplace" />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {data?.claimed?.map((l) => <ListingTile key={l.id} l={l} />)}
                  </div>
                )
              )}
              {tab === 'alerts' && (
                <Card>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center gap-2 text-base font-bold"><Bell className="h-4 w-4" /> Nearby activity (last 24 h)</div>
                    <p className="text-sm text-neutral-700"><span className="text-2xl font-extrabold text-brand-700">{m.nearbyAlerts || 0}</span> new listings posted in the last 24 hours across the marketplace.</p>
                    <p className="text-xs text-neutral-500">Tip: create a <button className="font-semibold text-brand-700 underline" onClick={() => { setEditing(null); setEditorOpen(true) }}>saved search</button> to get notified when matching items go live.</p>
                    {data?.favoriteCategories?.length > 0 && (
                      <div>
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Your favorite categories</div>
                        <div className="flex flex-wrap gap-2">
                          {data.favoriteCategories.map((c) => (
                            <Link key={c.name} href={`/marketplace?category=${encodeURIComponent(c.name)}`} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100">
                              {c.name} <span className="ml-1 text-brand-500">{c.count}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {tab === 'searches' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-neutral-600">Create alerts that fire when a matching listing posts. Email-out comes online once mail provider is configured — for now, alerts appear in this dashboard.</p>
                    <Button onClick={() => { setEditing(null); setEditorOpen(true) }} className="bg-brand-600 hover:bg-brand-700"><Plus className="mr-1 h-4 w-4" /> New saved search</Button>
                  </div>
                  {data?.savedSearches?.length === 0 ? (
                    <Empty icon={Sparkles} title="No saved searches yet" cta="Create your first one" onClick={() => { setEditing(null); setEditorOpen(true) }} />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {data?.savedSearches?.map((s) => (
                        <Card key={s.id}>
                          <CardContent className="space-y-2 p-4 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="line-clamp-1 font-bold">{s.name}</div>
                                <div className="text-xs text-neutral-500">
                                  {[s.category && `Cat: ${s.category}`, s.city && `City: ${s.city}`, s.freeOnly && 'Free only', s.donationOnly && 'Donation only', s.keyword && `"${s.keyword}"`].filter(Boolean).join(' · ') || 'All items'}
                                </div>
                              </div>
                              <Badge variant="outline" className={s.enabled ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-neutral-300 bg-neutral-50 text-neutral-500'}>
                                {s.enabled ? 'On' : 'Off'}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => onToggleSearch(s)}>{s.enabled ? <><BellOff className="mr-1 h-3.5 w-3.5" />Pause</> : <><Bell className="mr-1 h-3.5 w-3.5" />Enable</>}</Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditing(s); setEditorOpen(true) }}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
                              <Button size="sm" variant="outline" className="text-rose-600" onClick={() => onDeleteSearch(s.id)}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
                              <Button size="sm" asChild className="ml-auto bg-brand-600 hover:bg-brand-700">
                                <Link href={`/marketplace?${[s.category && `category=${encodeURIComponent(s.category)}`, s.freeOnly && 'priceType=free', s.donationOnly && 'priceType=donation'].filter(Boolean).join('&')}`}>View matches →</Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <SavedSearchEditor open={editorOpen} initial={editing} onClose={() => setEditorOpen(false)} onSave={onSaveSearch} />
    </div>
  )
}

function Empty({ icon: Icon, title, cta, href, onClick }) {
  return (
    <Card className="border-dashed">
      <CardContent className="grid place-items-center gap-3 p-10 text-center">
        <Icon className="h-10 w-10 text-neutral-300" />
        <div className="text-sm font-semibold text-neutral-700">{title}</div>
        {href ? (
          <Button asChild className="bg-brand-600 hover:bg-brand-700"><Link href={href}>{cta}</Link></Button>
        ) : (
          <Button onClick={onClick} className="bg-brand-600 hover:bg-brand-700">{cta}</Button>
        )}
      </CardContent>
    </Card>
  )
}

export default function BuyerDashboardPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[100dvh] place-items-center bg-neutral-50"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>}>
      <BuyerDashboardPageInner />
    </Suspense>
  )
}
