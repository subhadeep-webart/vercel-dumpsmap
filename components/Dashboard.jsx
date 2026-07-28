'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  LayoutDashboard, Activity, Heart, Navigation, Star, MapPin, BadgeCheck,
  Recycle, Truck, Building2, Users, AlertTriangle, BarChart3, ShieldCheck,
  Calendar, ThumbsUp, Edit, Plus, Flag,
  Flame, MessageCircle, User, DollarSign, Zap, Shield,
} from 'lucide-react'
import { AlertCard, ALERT_TYPES, timeAgo } from '@/components/AlertSystem'
import { COMMUNITY_CATEGORIES } from '@/components/Community'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

// Compact facility row
function FacilityRow({ f, onJump, right }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 hover:border-brand-400">
      <button onClick={onJump} className="flex flex-1 items-center gap-2 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-700">
          <Recycle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 truncate font-semibold">
            {f.name}
            {f.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
          </div>
          <div className="truncate text-[11px] text-neutral-500">{f.type} · {f.address}</div>
          {f.activeAlertCount > 0 && (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-800">
              <Flame className="h-3 w-3" /> {f.activeAlertCount} live · {f.activeAlerts?.[0]?.label}
            </span>
          )}
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1.5">
        {right}
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-brand-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-700"
        >
          <Navigation className="inline h-3 w-3" />
        </a>
      </div>
    </div>
  )
}

function SectionCard({ title, icon: Icon, action, children }) {
  return (
    <Card className="border-neutral-200">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-neutral-900">
            {Icon && <Icon className="h-4 w-4 text-brand-600" />} {title}
          </div>
          {action}
        </div>
        <div className="space-y-2">{children}</div>
      </CardContent>
    </Card>
  )
}

// =================== Contractor Dashboard ===================
function ContractorDashboard({ user, onJump, onReport, onCommunity }) {
  const [favorites, setFavorites] = useState([])
  const [recent, setRecent] = useState([])
  const [follows, setFollows] = useState([])
  const [contractorPosts, setContractorPosts] = useState([])

  useEffect(() => {
    api.get('/api/favorites').then((j) => setFavorites(j.favorites || []))
    api.get('/api/alerts?recent=true', { auth: false }).then((j) => setRecent((j.alerts || []).slice(0, 10)))
    api.get('/api/follows').then((j) => setFollows(j.alerts || []))
    api.get('/api/posts?scope=community&category=contractor', { auth: false }).then((j) => setContractorPosts((j.posts || []).slice(0, 5)))
  }, [])

  const waitReports = useMemo(() => recent.filter((a) => a.type === 'WAIT_TIME' || a.type === 'LONG_LINE'), [recent])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title={`Favorite facilities (${favorites.length})`}
        icon={Heart}
        action={favorites[0] && <Button size="sm" variant="outline" onClick={() => onReport(favorites[0])}><Activity className="mr-1 h-3 w-3" /> Quick alert</Button>}
      >
        {favorites.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">Tap <Heart className="inline h-3.5 w-3.5 align-text-bottom" /> on facilities to save them here.</div>}
        {favorites.slice(0, 5).map((f) => <FacilityRow key={f.id} f={f} onJump={() => onJump(f.id)} />)}
      </SectionCard>

      <SectionCard title={`Recent alerts nearby (${recent.length})`} icon={Activity}>
        {recent.slice(0, 5).map((a) => <AlertCard key={a.id} alert={a} showFacilityName onVote={() => {}} onJump={onJump} />)}
        {recent.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">No alerts yet.</div>}
      </SectionCard>

      <SectionCard title={`Followed updates (${follows.length})`} icon={Users}>
        {follows.slice(0, 5).map((a) => <AlertCard key={a.id} alert={a} showFacilityName onVote={() => {}} onJump={onJump} />)}
        {follows.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">Tap <Heart className="inline h-3.5 w-3.5 align-text-bottom" /> to follow facilities & see their updates here.</div>}
      </SectionCard>

      <SectionCard title={`Recent wait time reports (${waitReports.length})`} icon={Truck}>
        {waitReports.slice(0, 5).map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-2 text-sm">
            <div>
              <div className="font-semibold">{a.facilityName}</div>
              <div className="text-[11px] text-neutral-500">{a.label} · {timeAgo(a.createdAt)}</div>
            </div>
            {(a.waitMinutes || a.truckCount) && (
              <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                {a.waitMinutes ? `~${a.waitMinutes} min` : `~${a.truckCount} trucks`}
              </Badge>
            )}
          </div>
        ))}
        {waitReports.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">No wait reports right now.</div>}
      </SectionCard>

      <SectionCard
        title={`Contractor community (${contractorPosts.length})`}
        icon={Users}
        action={<Button size="sm" variant="outline" onClick={() => onCommunity('community')}>See all</Button>}
      >
        {contractorPosts.map((p) => (
          <div key={p.id} className="rounded-lg border border-neutral-200 bg-white p-2 text-sm">
            <div className="font-semibold">{p.title}</div>
            <div className="text-[11px] text-neutral-500">by {p.userName} · {timeAgo(p.createdAt)} · <ThumbsUp className="inline h-3 w-3" /> {p.upvotes || 0} · <MessageCircle className="inline h-3 w-3" /> {p.commentCount || 0}</div>
          </div>
        ))}
        {contractorPosts.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">No contractor posts yet.</div>}
      </SectionCard>

      <SectionCard title="Saved routes" icon={MapPin}>
        <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">
          Save common dump-route stops directly from each facility&apos;s page (coming next).
        </div>
      </SectionCard>
    </div>
  )
}

// =================== Recycler Dashboard ===================
function RecyclerDashboard({ user, onJump }) {
  const [favorites, setFavorites] = useState([])
  const [matSearch, setMatSearch] = useState('')
  const [results, setResults] = useState([])
  const [priceAlerts, setPriceAlerts] = useState([])
  const [recent, setRecent] = useState([])

  useEffect(() => {
    api.get('/api/favorites').then((j) => {
      const recyclables = (j.favorites || []).filter((f) =>
        ['Recycling Center', 'Scrap Yard', 'CRV Center', 'E-Waste Center'].includes(f.type)
      )
      setFavorites(recyclables)
    })
    api.get('/api/alerts?recent=true', { auth: false }).then((j) => {
      setPriceAlerts((j.alerts || []).filter((a) => a.type === 'PRICE_UPDATE'))
      setRecent((j.alerts || []).slice(0, 10))
    })
  }, [])

  const doSearch = async () => {
    if (!matSearch) return
    const j = await api.get(`/api/facilities?materials=${encodeURIComponent(matSearch)}`, { auth: false })
    setResults((j.facilities || []).filter((f) => ['Recycling Center', 'Scrap Yard', 'CRV Center', 'E-Waste Center'].includes(f.type)))
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title={`Favorite recycling/scrap/CRV (${favorites.length})`} icon={Recycle}>
        {favorites.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">Tap <Heart className="inline h-3.5 w-3.5 align-text-bottom" /> on recycling facilities to save them here.</div>}
        {favorites.slice(0, 6).map((f) => <FacilityRow key={f.id} f={f} onJump={() => onJump(f.id)} />)}
      </SectionCard>

      <SectionCard title="Material-specific search" icon={Recycle}>
        <div className="flex gap-2">
          <Select value={matSearch} onValueChange={setMatSearch}>
            <SelectTrigger><SelectValue placeholder="Pick a material" /></SelectTrigger>
            <SelectContent>
              {['Metal', 'Aluminum', 'Copper', 'Appliances', 'E-waste', 'Cardboard', 'Plastic', 'Wood'].map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={doSearch} className="bg-brand-600 hover:bg-brand-700">Find</Button>
        </div>
        <div className="mt-2 space-y-1.5">
          {results.slice(0, 5).map((f) => <FacilityRow key={f.id} f={f} onJump={() => onJump(f.id)} />)}
        </div>
      </SectionCard>

      <SectionCard title={`Price updates (${priceAlerts.length})`} icon={BarChart3}>
        {priceAlerts.slice(0, 5).map((a) => <AlertCard key={a.id} alert={a} showFacilityName onVote={() => {}} onJump={onJump} />)}
        {priceAlerts.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">No price updates yet.</div>}
      </SectionCard>

      <SectionCard title={`Recent reports nearby (${recent.length})`} icon={Activity}>
        {recent.slice(0, 5).map((a) => <AlertCard key={a.id} alert={a} showFacilityName onVote={() => {}} onJump={onJump} />)}
      </SectionCard>
    </div>
  )
}

// =================== Donation Dashboard ===================
function DonationDashboard({ user, onJump, onCommunity }) {
  const [favorites, setFavorites] = useState([])
  const [needs, setNeeds] = useState([])
  const [notAccepting, setNotAccepting] = useState([])
  const [events, setEvents] = useState([])

  useEffect(() => {
    api.get('/api/favorites').then((j) => {
      setFavorites((j.favorites || []).filter((f) => ['Donation Center', 'Reuse Center'].includes(f.type)))
    })
    api.get('/api/alerts?recent=true', { auth: false }).then((j) => {
      setNeeds((j.alerts || []).filter((a) => a.type === 'DONATION_NEED'))
      setNotAccepting((j.alerts || []).filter((a) => a.type === 'NOT_ACCEPTING'))
    })
    api.get('/api/posts?scope=event&upcoming=true', { auth: false }).then((j) => setEvents((j.posts || []).slice(0, 5)))
  }, [])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title={`Favorite donation centers (${favorites.length})`} icon={Heart}>
        {favorites.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">Tap <Heart className="inline h-3.5 w-3.5 align-text-bottom" /> on donation centers to save them here.</div>}
        {favorites.slice(0, 6).map((f) => <FacilityRow key={f.id} f={f} onJump={() => onJump(f.id)} />)}
      </SectionCard>

      <SectionCard title={`Items they need now (${needs.length})`} icon={Activity}>
        {needs.slice(0, 5).map((a) => <AlertCard key={a.id} alert={a} showFacilityName onVote={() => {}} onJump={onJump} />)}
        {needs.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">No active &ldquo;needs&rdquo; reports.</div>}
      </SectionCard>

      <SectionCard title={`Not accepted right now (${notAccepting.length})`} icon={AlertTriangle}>
        {notAccepting.slice(0, 5).map((a) => <AlertCard key={a.id} alert={a} showFacilityName onVote={() => {}} onJump={onJump} />)}
        {notAccepting.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">Everything is being accepted.</div>}
      </SectionCard>

      <SectionCard
        title={`Donation events (${events.length})`}
        icon={Calendar}
        action={<Button size="sm" variant="outline" onClick={() => onCommunity('events')}>All events</Button>}
      >
        {events.map((p) => (
          <div key={p.id} className="rounded-lg border border-neutral-200 bg-white p-2 text-sm">
            <div className="font-semibold">{p.title}</div>
            <div className="text-[11px] text-neutral-500"><Calendar className="inline h-3 w-3" /> {new Date(p.eventDate).toLocaleDateString()} {p.eventLocation ? <><span>· </span><MapPin className="inline h-3 w-3" /> {p.eventLocation}</> : ''}</div>
          </div>
        ))}
        {events.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">No upcoming events.</div>}
      </SectionCard>
    </div>
  )
}

// =================== Facility Owner Dashboard ===================
function FacilityOwnerDashboard({ user, onJump, onReport }) {
  const [owned, setOwned] = useState([])
  const [perFacility, setPerFacility] = useState({}) // id -> {alerts, followers, posts}

  useEffect(() => {
    if (!user?.ownedFacilities?.length) return
    Promise.all(
      user.ownedFacilities.map((id) =>
        Promise.all([
          api.get(`/api/facilities/${id}`, { auth: false }),
          api.get(`/api/facilities/${id}/followers`, { auth: false }),
        ]).then(([d, f]) => ({ id, facility: d.facility, alerts: d.alerts || [], reviews: d.reviews || [], followers: f }))
      )
    ).then((arr) => {
      const map = {}
      const list = []
      for (const x of arr) { map[x.id] = x; list.push(x.facility) }
      setOwned(list)
      setPerFacility(map)
    })
  }, [user?.ownedFacilities?.join(',')])

  if (!user?.ownedFacilities?.length) {
    return (
      <div className="rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/50 p-8 text-center">
        <Building2 className="mx-auto h-10 w-10 text-purple-600" />
        <div className="mt-2 font-semibold text-purple-900">No claimed facilities yet</div>
        <p className="mt-1 text-sm text-purple-800">Open any facility on the map and tap <b>Claim this facility</b>. An admin will review and approve.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {owned.map((f) => {
        const data = perFacility[f.id]
        if (!data) return null
        return (
          <Card key={f.id} className="border-purple-200">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-lg font-bold">
                    {f.name}
                    {f.verified && <BadgeCheck className="h-4 w-4 text-brand-600" />}
                    <Badge className="bg-purple-600 text-white hover:bg-purple-600">Owner</Badge>
                  </div>
                  <div className="text-xs text-neutral-500">{f.type} · {f.address}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => onReport(f)}>
                    <Activity className="mr-1 h-3 w-3" /> Post status
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onJump(f.id)}>
                    <Edit className="mr-1 h-3 w-3" /> Manage
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-2xl font-bold text-purple-700">{data.followers?.total || 0}</div>
                  <div className="text-[11px] text-neutral-500">Watchers (favs + follows)</div>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-2xl font-bold text-orange-600">{data.alerts.length}</div>
                  <div className="text-[11px] text-neutral-500">Live alerts</div>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-2xl font-bold text-amber-600">{data.reviews.length}</div>
                  <div className="text-[11px] text-neutral-500">Reviews</div>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-2xl font-bold text-neutral-700">{f.rating?.toFixed?.(1) || '—'}</div>
                  <div className="text-[11px] text-neutral-500">Avg rating</div>
                </div>
              </div>

              <div>
                <div className="mb-1 text-sm font-semibold text-neutral-900">Recent user reports</div>
                {data.alerts.slice(0, 4).map((a) => <AlertCard key={a.id} alert={a} onVote={() => {}} />)}
                {data.alerts.length === 0 && <div className="rounded-lg border border-dashed p-3 text-center text-xs text-neutral-500">No user reports yet.</div>}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// =================== Admin Dashboard ===================
function AdminDashboard({ onJump }) {
  const [tab, setTab] = useState('analytics')
  const [analytics, setAnalytics] = useState(null)
  const [users, setUsers] = useState([])
  const [pending, setPending] = useState([])
  const [claims, setClaims] = useState([])
  const [flagged, setFlagged] = useState([])
  const [leads, setLeads] = useState([])

  const load = () => {
    api.get('/api/admin/analytics').then(setAnalytics)
    api.get('/api/admin/users').then((j) => setUsers(j.users || []))
    api.get('/api/admin/pending').then((j) => setPending(j.facilities || []))
    api.get('/api/admin/claims').then((j) => setClaims(j.claims || []))
    api.get('/api/admin/flagged-alerts').then((j) => setFlagged(j.alerts || []))
    api.get('/api/admin/payment-interest').then((j) => setLeads(j.leads || []))
  }
  useEffect(() => { load() }, [])

  const moderate = async (id, payload) => {
    await api.patch(`/api/admin/facilities/${id}`, payload)
    toast.success('Updated')
    load()
  }

  const decideClaim = async (id, status) => {
    await api.patch(`/api/admin/claims/${id}`, { status })
    toast.success(`Claim ${status}`)
    load()
  }

  const t = analytics?.totals || {}

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="flex-wrap">
        <TabsTrigger value="analytics"><span className="inline-flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" /> Analytics</span></TabsTrigger>
        <TabsTrigger value="pending"><span className="inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Submissions ({pending.length})</span></TabsTrigger>
        <TabsTrigger value="claims"><span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Claims ({claims.length})</span></TabsTrigger>
        <TabsTrigger value="flagged"><span className="inline-flex items-center gap-1"><Flag className="h-3.5 w-3.5" /> Flagged ({flagged.length})</span></TabsTrigger>
        <TabsTrigger value="users"><span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> Users ({users.length})</span></TabsTrigger>
        <TabsTrigger value="leads"><span className="inline-flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Payment Leads ({leads.length})</span></TabsTrigger>
      </TabsList>

      <TabsContent value="analytics" className="pt-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: 'Users', v: t.users, c: 'text-brand-700' },
            { l: 'Facilities', v: t.facilities, c: 'text-purple-700' },
            { l: 'Live alerts', v: t.alerts, c: 'text-orange-600' },
            { l: 'Posts', v: t.posts, c: 'text-sky-700' },
            { l: 'Reviews', v: t.reviews, c: 'text-amber-700' },
            { l: 'Pending facilities', v: t.pending, c: 'text-rose-600' },
            { l: 'Pending claims', v: t.claims, c: 'text-rose-600' },
            { l: 'Flags', v: t.flags, c: 'text-red-700' },
          ].map((s) => (
            <Card key={s.l} className="border-neutral-200">
              <CardContent className="p-3">
                <div className={`text-2xl font-bold ${s.c}`}>{s.v ?? '–'}</div>
                <div className="text-[11px] text-neutral-500">{s.l}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SectionCard title="Top materials searched/reviewed" icon={BarChart3}>
            {(analytics?.topMaterials || []).map((m) => (
              <div key={m.material} className="flex items-center justify-between rounded-md border border-neutral-200 px-2 py-1.5 text-sm">
                <span>{m.material}</span><Badge variant="outline">{m.count}</Badge>
              </div>
            ))}
            {!analytics?.topMaterials?.length && <div className="text-xs text-neutral-500">No data yet.</div>}
          </SectionCard>
          <SectionCard title="Most active facilities (by alerts)" icon={Activity}>
            {(analytics?.topFacilities || []).map((x) => (
              <button key={x.facility.id} onClick={() => onJump(x.facility.id)} className="flex w-full items-center justify-between rounded-md border border-neutral-200 px-2 py-1.5 text-sm hover:bg-neutral-50">
                <span className="truncate text-left">{x.facility.name}</span>
                <Badge variant="outline">{x.alertCount} alerts</Badge>
              </button>
            ))}
            {!analytics?.topFacilities?.length && <div className="text-xs text-neutral-500">No data yet.</div>}
          </SectionCard>
        </div>
      </TabsContent>

      <TabsContent value="pending" className="pt-4 space-y-2">
        {pending.map((f) => (
          <div key={f.id} className="rounded-lg border border-neutral-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{f.name}</div>
                <div className="text-xs text-neutral-500">{f.type} · {f.address}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={() => moderate(f.id, { status: 'approved', verified: true })}>Approve + Verify</Button>
                <Button size="sm" variant="outline" onClick={() => moderate(f.id, { status: 'approved' })}>Approve</Button>
                <Button size="sm" variant="ghost" onClick={() => moderate(f.id, { status: 'rejected' })}>Reject</Button>
              </div>
            </div>
          </div>
        ))}
        {!pending.length && <div className="rounded-lg border border-dashed p-6 text-center text-xs text-neutral-500">No pending submissions.</div>}
      </TabsContent>

      <TabsContent value="claims" className="pt-4 space-y-2">
        {claims.map((c) => (
          <div key={c.id} className="rounded-lg border border-neutral-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{c.userEmail}</div>
                <div className="text-xs text-neutral-500">Relationship: {c.relationship || '—'} · Facility: {c.facilityId.slice(0, 8)}…</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={() => decideClaim(c.id, 'approved')}>Approve</Button>
                <Button size="sm" variant="ghost" onClick={() => decideClaim(c.id, 'rejected')}>Reject</Button>
              </div>
            </div>
          </div>
        ))}
        {!claims.length && <div className="rounded-lg border border-dashed p-6 text-center text-xs text-neutral-500">No pending claims.</div>}
      </TabsContent>

      <TabsContent value="flagged" className="pt-4 space-y-2">
        {flagged.map((a) => (
          <div key={a.id} className="rounded-lg border-2 border-red-200 bg-red-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{a.label} @ {a.facilityName}</div>
                <div className="text-xs italic text-neutral-700">&ldquo;{a.text || '—'}&rdquo;</div>
                <div className="text-[11px] text-neutral-500">by {a.userName} · {timeAgo(a.createdAt)} · <Flag className="inline h-3 w-3" /> {a.flagCount} flag(s)</div>
              </div>
              <Button size="sm" variant="destructive" onClick={async () => {
                await api.del(`/api/alerts/${a.id}`)
                toast.success('Removed')
                load()
              }}>Remove</Button>
            </div>
          </div>
        ))}
        {!flagged.length && <div className="rounded-lg border border-dashed p-6 text-center text-xs text-neutral-500">No flagged alerts.</div>}
      </TabsContent>

      <TabsContent value="users" className="pt-4">
        <ScrollArea className="h-[55vh]">
          <div className="divide-y divide-neutral-100">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-2 py-2 text-sm">
                <div>
                  <div className="font-semibold">{u.name} <span className="text-xs font-normal text-neutral-500">· {u.email}</span></div>
                  <div className="text-[11px] text-neutral-500">
                    {(u.profileTypes || []).join(', ') || u.userRole || 'user'} · <Zap className="inline h-3 w-3" /> {u.karma || 0} {u.role === 'admin' && <span className="inline-flex items-center gap-0.5">· <Shield className="h-3 w-3" /> admin</span>}
                  </div>
                </div>
                <div className="text-[10px] text-neutral-400">{new Date(u.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="leads" className="pt-4 space-y-2">
        <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-xs text-brand-900">
          <b>Future payment integration leads.</b> These are haulers + facilities who signed up for the Scale-In/Pay-From-Vehicle pilot.
          No card details are stored. Use this list to invite participants when payments go live.
        </div>
        {!leads.length && <div className="rounded-lg border border-dashed p-6 text-center text-xs text-neutral-500">No payment-pilot signups yet.</div>}
        <ScrollArea className="h-[50vh]">
          <div className="divide-y divide-neutral-100">
            {leads.map((l) => (
              <div key={l.id} className="px-2 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{l.email}</div>
                  <Badge variant="outline" className="text-[10px]">{l.role || 'lead'}</Badge>
                </div>
                <div className="text-[11px] text-neutral-500">
                  {l.facilityName ? `@ ${l.facilityName} · ` : ''}{new Date(l.createdAt).toLocaleDateString()}
                </div>
                {l.notes && <div className="mt-1 text-[11px] italic text-neutral-700">{l.notes}</div>}
              </div>
            ))}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}

// =================== Default / General ===================
function GeneralDashboard({ user, onJump }) {
  const [favorites, setFavorites] = useState([])
  const [recent, setRecent] = useState([])
  useEffect(() => {
    api.get('/api/favorites').then((j) => setFavorites(j.favorites || []))
    api.get('/api/alerts?recent=true', { auth: false }).then((j) => setRecent((j.alerts || []).slice(0, 10)))
  }, [])
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title={`Favorites (${favorites.length})`} icon={Heart}>
        {favorites.slice(0, 6).map((f) => <FacilityRow key={f.id} f={f} onJump={() => onJump(f.id)} />)}
        {!favorites.length && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-neutral-500">Save facilities with <Heart className="inline h-3.5 w-3.5 align-text-bottom" /> to see them here.</div>}
      </SectionCard>
      <SectionCard title={`Live activity (${recent.length})`} icon={Activity}>
        {recent.slice(0, 5).map((a) => <AlertCard key={a.id} alert={a} showFacilityName onVote={() => {}} onJump={onJump} />)}
      </SectionCard>
    </div>
  )
}

// =================== Main Dashboard Dialog ===================
const PROFILE_TITLES = {
  hauler: { title: 'Contractor / Hauler dashboard', Icon: Truck, color: 'text-orange-700' },
  recycler: { title: 'Recycler dashboard', Icon: Recycle, color: 'text-brand-700' },
  donor: { title: 'Donation dashboard', Icon: Heart, color: 'text-sky-700' },
  facility_owner: { title: 'Facility Owner dashboard', Icon: Building2, color: 'text-purple-700' },
  general: { title: 'Your dashboard', Icon: User, color: 'text-neutral-700' },
}

export function DashboardDialog({ open, onOpenChange, user, onJumpFacility, onReport, onCommunity }) {
  const [view, setView] = useState(null) // override profile for switching
  const isAdmin = user?.role === 'admin'
  const profile = view || (isAdmin ? 'admin' : (user?.primaryProfile || 'general'))
  const meta = PROFILE_TITLES[profile] || PROFILE_TITLES.general
  const profileTypes = useMemo(() => {
    if (!user) return []
    const arr = [...(user.profileTypes || [])]
    if (isAdmin) arr.push('admin')
    return [...new Set(arr)]
  }, [user, isAdmin])

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-brand-600" />
            {profile === 'admin' ? (
              <span className="inline-flex items-center gap-1.5"><Shield className="h-5 w-5" /> Admin dashboard</span>
            ) : (
              <span className="inline-flex items-center gap-1.5">{meta.Icon && <meta.Icon className="h-5 w-5" />} {meta.title}</span>
            )}
          </DialogTitle>
        </DialogHeader>
        {profileTypes.length > 1 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {profileTypes.map((p) => {
              const m = p === 'admin' ? { title: 'Admin', Icon: Shield } : PROFILE_TITLES[p] || { title: p, Icon: null }
              return (
                <button
                  key={p}
                  onClick={() => setView(p)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${profile === p ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
                >
                  <span className="inline-flex items-center gap-1">{m.Icon && <m.Icon className="h-4 w-4" />} {m.title}</span>
                </button>
              )
            })}
          </div>
        )}
        <div className="pt-3">
          {profile === 'admin' && <AdminDashboard onJump={onJumpFacility} />}
          {profile === 'hauler' && <ContractorDashboard user={user} onJump={onJumpFacility} onReport={onReport} onCommunity={onCommunity} />}
          {profile === 'recycler' && <RecyclerDashboard user={user} onJump={onJumpFacility} />}
          {profile === 'donor' && <DonationDashboard user={user} onJump={onJumpFacility} onCommunity={onCommunity} />}
          {profile === 'facility_owner' && <FacilityOwnerDashboard user={user} onJump={onJumpFacility} onReport={onReport} />}
          {profile === 'general' && <GeneralDashboard user={user} onJump={onJumpFacility} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DashboardButton({ onOpen, user }) {
  if (!user) return null
  return (
    <button onClick={onOpen} className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium hover:bg-neutral-50">
      <LayoutDashboard className="h-4 w-4 text-brand-600" />
      <span className="hidden md:inline">Dashboard</span>
    </button>
  )
}
