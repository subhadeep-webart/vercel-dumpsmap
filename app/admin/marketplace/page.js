'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  Search, Star, CheckCircle2, Flag, Trash2, ShieldAlert, UserX, Eye, Loader2,
  MessageCircle, RefreshCw, AlertTriangle, BadgeCheck, ExternalLink,
} from 'lucide-react'

const TABS = [
  { value: 'listings', label: 'Listings' },
  { value: 'reports',  label: 'Reports Queue' },
  { value: 'sellers',  label: 'Seller Lookup' },
]

export default function AdminMarketplacePage() {
  const { authFetch } = useAdmin()
  const [tab, setTab] = useState('listings')

  // -------------- LISTINGS TAB --------------
  const [q, setQ] = useState('')
  const [segment, setSegment] = useState('')
  const [status, setStatus] = useState('')
  const [itemStatusF, setItemStatusF] = useState('')
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(false)

  const loadListings = async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (q) p.set('q', q); if (segment) p.set('segment', segment); if (status) p.set('status', status); if (itemStatusF) p.set('itemStatus', itemStatusF)
    const r = await authFetch(`/api/admin/marketplace?${p}`)
    const j = await r.json()
    setListings(j.listings || []); setLoading(false)
  }
  useEffect(() => { if (tab === 'listings') loadListings() /* eslint-disable-line */ }, [tab, segment, status, itemStatusF])

  const act = async (id, action, extra = {}) => {
    const r = await authFetch(`/api/admin/marketplace/${id}`, { method: 'PATCH', body: JSON.stringify({ action, ...extra }) })
    if (r.ok) { toast.success(action); loadListings() } else toast.error('Failed')
  }

  // -------------- REPORTS TAB --------------
  const [reports, setReports] = useState([])
  const [reportFilter, setReportFilter] = useState('pending')
  const [reportsLoading, setReportsLoading] = useState(false)

  const loadReports = async () => {
    setReportsLoading(true)
    const r = await authFetch(`/api/admin/marketplace/reports?status=${reportFilter}`)
    const j = await r.json()
    setReports(j.reports || [])
    setReportsLoading(false)
  }
  useEffect(() => { if (tab === 'reports') loadReports() /* eslint-disable-line */ }, [tab, reportFilter])

  const resolveReport = async (id, status, note = '') => {
    const r = await authFetch(`/api/admin/marketplace/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status, moderatorNote: note }) })
    if (r.ok) { toast.success(status); loadReports() } else toast.error('Failed')
  }

  // -------------- SELLER LOOKUP TAB --------------
  const [sellerId, setSellerId] = useState('')
  const [sellerData, setSellerData] = useState(null)
  const [sellerLoading, setSellerLoading] = useState(false)
  const lookupSeller = async () => {
    if (!sellerId.trim()) return
    setSellerLoading(true)
    const r = await authFetch(`/api/admin/marketplace/seller/${sellerId.trim()}`)
    const j = await r.json()
    setSellerData(j)
    setSellerLoading(false)
  }
  const banSeller = async (action) => {
    if (!sellerData?.user?.id) return
    const r = await authFetch(`/api/admin/users/${sellerData.user.id}`, { method: 'PATCH', body: JSON.stringify({ action }) })
    if (r.ok) { toast.success(action); lookupSeller() } else toast.error('Failed')
  }

  // -------------- RENDER --------------
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Marketplace</h1>
          <p className="text-sm text-neutral-500">Approve, feature, flag, remove · review reports · investigate sellers.</p>
        </div>
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${tab === t.value ? 'bg-brand-600 text-white' : 'border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'listings' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadListings()} placeholder="Search…" className="w-56 pl-8" />
            </div>
            <Select value={segment || 'all'} onValueChange={(v) => setSegment(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Segment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All segments</SelectItem>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="removed">Removed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={itemStatusF || 'all'} onValueChange={(v) => setItemStatusF(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Item status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All items</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="on_truck">On Truck</SelectItem>
                <SelectItem value="at_site">At Site</SelectItem>
                <SelectItem value="last_chance">Last Chance</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadListings}><RefreshCw className="mr-1 h-4 w-4" /> Refresh</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {loading && <div className="rounded-lg border border-dashed p-6 text-center text-neutral-500 md:col-span-2"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
            {!loading && listings.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-neutral-500 md:col-span-2">No listings.</div>}
            {listings.map((l) => (
              <Card key={l.id} className="border-neutral-200">
                <CardContent className="space-y-2 p-3">
                  <div className="flex gap-3">
                    <div className="h-20 w-24 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                      {l.photos?.[0] ? <img src={l.photos[0]} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold">{l.title}</div>
                        {l.featured && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                        <Badge variant="outline" className={l.status === 'flagged' ? 'border-red-300 bg-red-50 text-red-800' : l.status === 'removed' ? 'border-neutral-300 bg-neutral-50 text-neutral-600' : 'border-brand-300 bg-brand-50 text-brand-800'}>{l.status || 'active'}</Badge>
                        {l.itemStatus && l.itemStatus !== 'available' && <Badge variant="outline" className="text-[10px]">{l.itemStatus.replace('_', ' ')}</Badge>}
                      </div>
                      <div className="text-xs text-neutral-500">{l.segment} · {l.category} · ${l.price ?? '—'} · seller {l.sellerId?.slice(0, 8)}</div>
                      {l.description && <div className="mt-1 line-clamp-2 text-xs text-neutral-600">{l.description}</div>}
                      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-neutral-500">
                        <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {l.viewCount || 0} views</span>
                        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {l.messageCount || 0} msgs</span>
                        {l.reportCount > 0 && <span className="inline-flex items-center gap-1 font-semibold text-red-700"><Flag className="h-3 w-3" /> {l.reportCount} flags</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button asChild size="sm" variant="outline"><a href={`/marketplace/${l.id}`} target="_blank" rel="noreferrer"><Eye className="mr-1 h-4 w-4" /> View</a></Button>
                    {l.status !== 'active' && <Button size="sm" onClick={() => act(l.id, 'approve')} className="bg-brand-600 hover:bg-brand-700"><CheckCircle2 className="mr-1 h-4 w-4" /> Approve</Button>}
                    <Button size="sm" variant="outline" onClick={() => act(l.id, l.featured ? 'unfeature' : 'feature')}><Star className="mr-1 h-4 w-4" /> {l.featured ? 'Unfeature' : 'Feature'}</Button>
                    <Button size="sm" variant="outline" className="border-amber-300 text-amber-700" onClick={() => act(l.id, 'flag_spam')}><Flag className="mr-1 h-4 w-4" /> Flag spam</Button>
                    <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => act(l.id, 'remove')}><Trash2 className="mr-1 h-4 w-4" /> Remove</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setSellerId(l.sellerId); setTab('sellers'); setTimeout(lookupSeller, 0) }}>↗ Inspect seller</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === 'reports' && (
        <>
          <div className="flex items-center gap-2">
            <Select value={reportFilter} onValueChange={setReportFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadReports}><RefreshCw className="mr-1 h-4 w-4" /> Refresh</Button>
            {reports.length > 0 && <span className="text-xs text-neutral-500">{reports.length} report{reports.length === 1 ? '' : 's'}</span>}
          </div>

          {reportsLoading && <div className="rounded-lg border border-dashed p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {!reportsLoading && reports.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-neutral-500">No reports.</div>}
          <div className="space-y-3">
            {reports.map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={r.status === 'pending' ? 'bg-amber-500 text-white' : r.status === 'resolved' ? 'bg-emerald-600 text-white' : r.status === 'dismissed' ? 'bg-neutral-500 text-white' : 'bg-rose-600 text-white'}>{r.status}</Badge>
                    <span className="text-xs text-neutral-500">{new Date(r.createdAt).toLocaleString()}</span>
                    <span className="text-sm font-bold">Reason: {r.reason}</span>
                  </div>
                  {r.notes && <div className="rounded bg-neutral-50 p-2 text-xs text-neutral-700">"{r.notes}"</div>}
                  {r.listing ? (
                    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 p-2">
                      <div className="h-14 w-16 shrink-0 overflow-hidden rounded bg-neutral-100">
                        {r.listing.photos?.[0] ? <img src={r.listing.photos[0]} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-sm font-semibold">{r.listing.title}</div>
                        <div className="text-xs text-neutral-500">{r.listing.itemStatus} · status {r.listing.status}</div>
                      </div>
                      <Button asChild size="sm" variant="outline"><a href={`/marketplace/${r.listing.id}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                    </div>
                  ) : <div className="text-xs text-neutral-500">(Listing has been deleted)</div>}
                  {r.reporter && <div className="text-[11px] text-neutral-500">Reported by {r.reporter.name || r.reporter.email}</div>}
                  {r.status === 'pending' && (
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" onClick={() => resolveReport(r.id, 'resolved')} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="mr-1 h-4 w-4" /> Resolve</Button>
                      <Button size="sm" variant="outline" onClick={() => resolveReport(r.id, 'dismissed')}><AlertTriangle className="mr-1 h-4 w-4" /> Dismiss</Button>
                      <Button size="sm" variant="outline" className="border-amber-300 text-amber-700" onClick={() => resolveReport(r.id, 'escalated')}><ShieldAlert className="mr-1 h-4 w-4" /> Escalate</Button>
                      {r.listing?.id && <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => { act(r.listing.id, 'remove'); resolveReport(r.id, 'resolved', 'auto-removed listing') }}><Trash2 className="mr-1 h-4 w-4" /> Remove listing</Button>}
                      {r.listing?.sellerId && <Button size="sm" variant="ghost" onClick={() => { setSellerId(r.listing.sellerId); setTab('sellers'); setTimeout(lookupSeller, 0) }}>↗ Investigate seller</Button>}
                    </div>
                  )}
                  {r.moderatorNote && <div className="text-[11px] text-neutral-500">Mod note: {r.moderatorNote}</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === 'sellers' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={sellerId} onChange={(e) => setSellerId(e.target.value)} placeholder="Seller user ID (uuid)" className="w-96" onKeyDown={(e) => e.key === 'Enter' && lookupSeller()} />
            <Button onClick={lookupSeller} className="bg-brand-600 hover:bg-brand-700"><Search className="mr-1 h-4 w-4" /> Look up</Button>
          </div>
          {sellerLoading && <div className="rounded-lg border border-dashed p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {!sellerLoading && sellerData?.user && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-bold">{sellerData.user.name || 'Unnamed'}</div>
                  <div className="text-sm text-neutral-500">{sellerData.user.email}</div>
                  {sellerData.user.isVerified && <Badge className="bg-brand-600 text-white"><BadgeCheck className="mr-1 h-3 w-3" /> Verified</Badge>}
                  {sellerData.user.isSuspended && <Badge className="bg-amber-500 text-white">Suspended</Badge>}
                  {sellerData.user.isBanned && <Badge className="bg-rose-600 text-white">Banned</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-neutral-50 p-3 text-sm sm:grid-cols-5">
                  <Stat label="Total listings" value={sellerData.stats?.total} />
                  <Stat label="Active" value={sellerData.stats?.active} />
                  <Stat label="Sold" value={sellerData.stats?.sold} />
                  <Stat label="Flagged" value={sellerData.stats?.flagged} accent="rose" />
                  <Stat label="Reports total" value={sellerData.stats?.totalReports} accent="rose" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {!sellerData.user.isSuspended && <Button size="sm" variant="outline" className="border-amber-300 text-amber-700" onClick={() => banSeller('suspend')}><UserX className="mr-1 h-4 w-4" /> Suspend</Button>}
                  {!sellerData.user.isBanned && <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => banSeller('ban')}><UserX className="mr-1 h-4 w-4" /> Ban</Button>}
                  {(sellerData.user.isSuspended || sellerData.user.isBanned) && <Button size="sm" onClick={() => banSeller('reinstate')} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="mr-1 h-4 w-4" /> Reinstate</Button>}
                </div>
                <div className="mt-2">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-500">Recent listings ({sellerData.listings?.length || 0})</div>
                  <div className="space-y-1 text-sm">
                    {sellerData.listings?.slice(0, 20).map((l) => (
                      <div key={l.id} className="flex items-center justify-between rounded-md border border-neutral-200 p-2">
                        <a href={`/marketplace/${l.id}`} target="_blank" rel="noreferrer" className="line-clamp-1 flex-1 text-brand-700 hover:underline">{l.title}</a>
                        <span className="text-xs text-neutral-500">{l.itemStatus || l.status}</span>
                        <span className="ml-2 text-xs text-neutral-500">{new Date(l.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {sellerData.reports?.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-500">Reports on seller's listings</div>
                    <div className="space-y-1 text-xs">
                      {sellerData.reports.slice(0, 10).map((r) => (
                        <div key={r.id} className="rounded-md bg-rose-50 p-2 text-rose-900">
                          <span className="font-semibold">{r.reason}</span> · {r.status} · {new Date(r.createdAt).toLocaleDateString()} · {r.notes || ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {!sellerLoading && sellerData?.user === null && <div className="rounded-lg border border-dashed p-4 text-center text-neutral-500">User not found.</div>}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }) {
  const color = accent === 'rose' ? 'text-rose-700' : 'text-brand-700'
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`text-lg font-extrabold ${color}`}>{value ?? 0}</div>
    </div>
  )
}
