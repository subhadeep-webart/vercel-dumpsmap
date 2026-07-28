'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import FieldHeader from './FieldHeader'
import FieldBottomNav from './FieldBottomNav'
import FieldFeedCard from './FieldFeedCard'
import FieldQuickPostForms from './FieldQuickPostForms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Camera, Image as ImageIcon, AlertCircle, Hand } from 'lucide-react'
import { useViewMode } from '@/lib/view-mode'
import { useLogout } from '@/hooks/use-logout'

function authHeaders() {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function loadUnifiedFeed({ lat, lng } = {}) {
  // Aggregate posts from existing endpoints into a single feed.
  // Hot spots are surfaced via community_posts with category='illegal_dumping' and jobs?hotSpot=true.
  const urls = [
    `/api/jobs?limit=20`,
    `/api/jobs?hotSpot=true&limit=10`,
    `/api/marketplace?limit=20`,
    `/api/community/posts?limit=30`,
  ]
  const settled = await Promise.allSettled(urls.map((u) => fetch(u, { headers: authHeaders() }).then((r) => r.ok ? r.json() : null)))
  const [jobsRes, hotJobsRes, mpRes, postsRes] = settled.map((s) => s.status === 'fulfilled' ? s.value : null)

  const items = []
  for (const j of (jobsRes?.jobs || jobsRes?.items || [])) {
    items.push({
      id: `job_${j.id}`,
      kind: 'job', _raw: j,
      category: 'job',
      author: j.poster ? { id: j.poster.id, name: j.poster.name, verificationLevel: j.poster.isVerified ? 'verified_contractor' : 'normal_user' } : null,
      title: j.title,
      body: j.description,
      photo: j.photos?.[0] || null,
      photos: j.photos || [],
      location: j.city ? `${j.city}${j.state ? `, ${j.state}` : ''}` : j.zip || j.address || '',
      createdAt: j.createdAt,
      likes: 0, comments: j.messagesCount || 0, liked: false,
      payAmount: j.payAmount,
      urgency: j.urgency,
      claimCta: j.status === 'open' ? 'Accept' : null,
      openHref: `/jobs/${j.id}`,
    })
  }
  for (const m of (mpRes?.listings || mpRes?.items || [])) {
    items.push({
      id: `mp_${m.id}`, kind: 'marketplace', _raw: m,
      category: m.priceLabel === 'free' || m.price === 0 ? 'free' : 'marketplace',
      author: m.seller ? { id: m.seller.id, name: m.seller.name, verificationLevel: m.seller.verificationLevel || 'normal_user' } : null,
      title: m.title, body: m.description,
      photo: m.photos?.[0] || null, photos: m.photos || [],
      location: m.city || m.zip || '',
      createdAt: m.createdAt,
      likes: 0, comments: m.messagesCount || 0, liked: false,
      priceLabel: m.price === 0 ? 'FREE' : m.price ? `$${m.price}` : null,
      claimCta: m.sold ? null : 'Message',
      openHref: `/marketplace/${m.id}`,
    })
  }
  for (const p of (postsRes?.posts || postsRes?.items || [])) {
    items.push({
      id: `post_${p.id}`, kind: 'post', _raw: p,
      category: p.groupId ? 'group' : 'community',
      author: p.author || null,
      title: p.title, body: p.body,
      photo: p.photos?.[0] || null, photos: p.photos || [],
      location: p.areaLabel || p.zip || '',
      createdAt: p.createdAt,
      likes: p.reactionsCount || 0, comments: p.commentsCount || 0, liked: !!p.likedByMe,
      openHref: `/community/posts/${p.id}`,
    })
  }
  for (const h of (hotJobsRes?.jobs || hotJobsRes?.items || [])) {
    // Treat hot-spot jobs as separate "hotspot" category for visual differentiation
    if (items.find((it) => it._raw?.id === h.id)) continue
    items.push({
      id: `hs_${h.id}`, kind: 'hotspot', _raw: h,
      category: 'hotspot',
      author: h.poster ? { id: h.poster.id, name: h.poster.name } : { id: 'guest', name: 'Anonymous' },
      title: h.title || 'Hot Spot',
      body: h.description,
      photo: h.photos?.[0] || null, photos: h.photos || [],
      location: h.city || h.zip || '',
      createdAt: h.createdAt,
      likes: 0, comments: h.messagesCount || 0, liked: false,
      urgency: h.urgency || 'urgent',
      claimCta: 'View',
      openHref: `/jobs/${h.id}`,
    })
  }
  // Sort by createdAt desc
  items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  return items
}

export default function FieldShell({ user, onOpenStandard, onOpenJob, onOpenListing, onOpenSubmitFacility, onOpenLogin, onJumpHotspot }) {
  const { setViewMode } = useViewMode()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState('home')
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadDm, setUnreadDm] = useState(0)
  const [groupsUnread, setGroupsUnread] = useState(0)
  const [postOpen, setPostOpen] = useState(false)
  const [postInitial, setPostInitial] = useState(null)
  const [composerText, setComposerText] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Open quick-post sheet when navigated with ?compose=quick or ?compose=<key>
  useEffect(() => {
    const c = searchParams?.get('compose')
    if (!c) return
    if (c === 'quick' || c === '1') { setPostInitial(null); setPostOpen(true) }
    else { setPostInitial(c); setPostOpen(true) }
    // Strip param so a future visit doesn't re-open
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const u = new URL(window.location.href)
      u.searchParams.delete('compose')
      window.history.replaceState({}, '', u.toString())
    }
  }, [searchParams])

  // Allow ?tab=jobs/alerts/search/profile to land on a specific tab
  useEffect(() => {
    const t = searchParams?.get('tab')
    if (t && ['home', 'search', 'jobs', 'alerts', 'profile'].includes(t)) {
      setTab(t)
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        const u = new URL(window.location.href)
        u.searchParams.delete('tab')
        window.history.replaceState({}, '', u.toString())
      }
    }
  }, [searchParams])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const items = await loadUnifiedFeed()
      setFeed(items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (tab === 'home') reload() }, [tab, reload])

  // unread counts
  useEffect(() => {
    if (!user) return
    let alive = true
    const ping = async () => {
      try {
        const r = await fetch('/api/inbox/unread-count', { headers: authHeaders() })
        if (!r.ok) return
        const j = await r.json()
        if (!alive) return
        setUnreadDm((j.dm || 0) + (j.marketplace || 0) + (j.jobs || 0))
        setGroupsUnread(j.groups || 0)
      } catch {}
    }
    ping()
    const id = setInterval(ping, 8000)
    return () => { alive = false; clearInterval(id) }
  }, [user])

  // Search debounce
  useEffect(() => {
    if (tab !== 'search') return
    if (!searchQ.trim()) { setSearchResults([]); return }
    let alive = true
    setSearchLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/facilities?q=${encodeURIComponent(searchQ)}&limit=20`, { headers: authHeaders() })
        const j = r.ok ? await r.json() : { facilities: [] }
        if (alive) setSearchResults(j.facilities || [])
      } finally {
        if (alive) setSearchLoading(false)
      }
    }, 280)
    return () => { alive = false; clearTimeout(t) }
  }, [searchQ, tab])

  const handleQuickComposerSubmit = () => {
    if (!user) { onOpenLogin?.(); return }
    if (!composerText.trim()) { setPostInitial(null); setPostOpen(true); return }
    // Default to community post
    fetch('/api/community/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ title: composerText.trim().slice(0, 80), body: composerText.trim(), category: 'general' }),
    }).then((r) => r.ok ? r.json() : Promise.reject())
      .then(() => { setComposerText(''); toast.success('Posted to your community feed'); reload() })
      .catch(() => toast.error('Could not post — try again'))
  }

  const openItem = (post) => {
    if (post.openHref) {
      if (post.openHref.startsWith('/?')) {
        // Stay in field mode but trigger the existing detail dialog via URL param
        router.push(post.openHref)
      } else {
        router.push(post.openHref)
      }
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-neutral-50">
      <FieldHeader
        unreadCount={unreadDm}
        user={user}
        onOpenInbox={() => router.push('/inbox')}
        onOpenAlerts={() => setTab('alerts')}
        onLocationClick={() => toast.info('Location selector coming soon — currently using your last detected area.')}
      />

      <main className="flex-1 overflow-y-auto pb-4">
        {tab === 'home' && (
          <div className="space-y-3 px-3 py-3">
            {/* Composer card */}
            <Card className="border-neutral-200">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
                    {user ? (user.name || user.email || '?')[0].toUpperCase() : '?'}
                  </span>
                  <button
                    onClick={() => { setPostInitial(null); setPostOpen(true) }}
                    className="flex-1 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-100"
                  >
                    What’s happening nearby?
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setPostInitial('hotspot'); setPostOpen(true) }} className="h-8 flex-1 justify-start gap-1">
                    <Camera className="h-3.5 w-3.5 text-brand-600" /> Hot spot
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setPostInitial('job'); setPostOpen(true) }} className="h-8 flex-1 justify-start gap-1">
                    <ImageIcon className="h-3.5 w-3.5 text-brand-600" /> Job
                  </Button>
                  <Button onClick={() => { setPostInitial(null); setPostOpen(true) }} size="sm" className="h-8 bg-brand-600 hover:bg-brand-700">Post</Button>
                </div>
              </CardContent>
            </Card>

            {/* Feed */}
            {loading && <div className="py-10 text-center text-sm text-neutral-400">Loading nearby activity…</div>}
            {!loading && feed.length === 0 && (
              <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-neutral-500">
                Nothing nearby yet. Tap <span className="font-semibold text-brand-700">Post</span> to be the first.
              </CardContent></Card>
            )}
            {feed.map((p) => (
              <FieldFeedCard
                key={p.id}
                post={p}
                onOpen={openItem}
                onLike={(post) => { /* TODO wire to reactions */ toast.message('Reactions coming soon') }}
                onComment={openItem}
                onShare={(post) => { navigator.share?.({ title: post.title, url: window.location.origin + (post.openHref || '/') }).catch(() => toast.info('Share canceled')) }}
                onMessage={p.author?.id && user && p.author.id !== user.id ? (post) => router.push(`/inbox?dm=${post.author.id}`) : null}
                onClaim={p.claimCta ? openItem : null}
              />
            ))}
          </div>
        )}

        {tab === 'search' && (
          <div className="space-y-3 px-3 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Find facilities, materials, or services" className="h-11 rounded-full pl-9" />
            </div>
            {searchLoading && <div className="py-6 text-center text-sm text-neutral-400">Searching…</div>}
            {!searchLoading && searchQ && searchResults.length === 0 && (
              <div className="py-6 text-center text-sm text-neutral-500">No facilities match “{searchQ}”.</div>
            )}
            <div className="space-y-2">
              {searchResults.map((f) => (
                <button key={f.id} onClick={() => router.push(`/facilities/${f.id}`)} className="block w-full text-left">
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-sm font-bold">{f.name}</div>
                      <div className="text-[11px] text-neutral-500">{[f.type, f.city, f.state].filter(Boolean).join(' · ')}</div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'jobs' && (
          <FieldJobs onOpenJob={openItem} />
        )}

        {tab === 'alerts' && (
          <FieldAlerts user={user} />
        )}

        {tab === 'profile' && (
          <FieldProfile user={user} onSwitchStandard={onOpenStandard} onOpenLogin={onOpenLogin} />
        )}
      </main>

      <FieldBottomNav
        active={tab}
        onChange={setTab}
        unread={{ alerts: groupsUnread, profile: 0 }}
        onPost={() => { setPostInitial(null); setPostOpen(true) }}
      />

      <FieldQuickPostForms
        open={postOpen}
        onOpenChange={(v) => { setPostOpen(v); if (!v) setPostInitial(null) }}
        initialKey={postInitial}
        user={user}
        onRequireLogin={() => onOpenLogin?.()}
        onPosted={() => { setPostInitial(null); reload() }}
      />
    </div>
  )
}

function FieldJobs({ onOpenJob }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/jobs?limit=40', { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setJobs(j.jobs || j.items || []))
      .finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="py-10 text-center text-sm text-neutral-400">Loading jobs…</div>
  if (jobs.length === 0) return <div className="py-10 text-center text-sm text-neutral-500">No open jobs nearby.</div>
  return (
    <div className="space-y-2 px-3 py-3">
      {jobs.map((j) => (
        <FieldFeedCard key={j.id} post={{
          id: `job_${j.id}`, category: 'job', author: j.poster, title: j.title, body: j.description,
          photo: j.photos?.[0], location: j.city, createdAt: j.createdAt,
          payAmount: j.payAmount, urgency: j.urgency, comments: j.messagesCount,
          openHref: `/jobs/${j.id}`, claimCta: j.status === 'open' ? 'Accept' : null,
        }} onOpen={(p) => onOpenJob(p)} />
      ))}
    </div>
  )
}

function FieldAlerts({ user }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetch('/api/alerts?recent=1', { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : { alerts: [] })
      .then((j) => setAlerts(j.alerts || j.items || []))
      .finally(() => setLoading(false))
  }, [user])
  if (!user) return (
    <div className="p-6 text-center text-sm text-neutral-500">
      <AlertCircle className="mx-auto h-6 w-6 text-amber-500" />
      <p className="mt-2">Sign in to see alerts for hot spots, jobs and facilities you follow.</p>
    </div>
  )
  if (loading) return <div className="py-10 text-center text-sm text-neutral-400">Loading alerts…</div>
  if (alerts.length === 0) return <div className="py-10 text-center text-sm text-neutral-500">No alerts yet — we’ll ping you when something nearby changes.</div>
  return (
    <div className="space-y-2 px-3 py-3">
      {alerts.map((a) => (
        <Card key={a.id}><CardContent className="p-3 text-sm">
          <div className="font-semibold">{a.title || a.kind || 'Alert'}</div>
          {a.body && <p className="mt-0.5 text-xs text-neutral-600">{a.body}</p>}
        </CardContent></Card>
      ))}
    </div>
  )
}

function FieldProfile({ user, onSwitchStandard, onOpenLogin }) {
  const { setViewMode } = useViewMode()
  const logout = useLogout()
  if (!user) return (
    <div className="p-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-600"><Hand className="h-7 w-7" /></div>
      <p className="mt-2 text-sm font-semibold">Welcome to DumpMaps</p>
      <p className="mt-1 text-xs text-neutral-500">Sign in to post, message, and track activity.</p>
      <Button onClick={onOpenLogin} className="mt-3 bg-brand-600 hover:bg-brand-700">Sign in</Button>
      <button onClick={() => setViewMode('standard')} className="mt-3 block w-full text-[11px] text-neutral-500 underline">Switch to Standard Mode</button>
    </div>
  )
  return (
    <div className="space-y-3 p-3">
      <Card><CardContent className="flex items-center gap-3 p-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white">{(user.name || user.email || '?')[0].toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{user.name || user.email}</div>
          <div className="text-[11px] text-neutral-500">Karma {user.karma || 0} · {(user.completedJobs || 0)} jobs</div>
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-0">
        <button onClick={() => (window.location.href = '/inbox')} className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-3 text-sm hover:bg-neutral-50"><span>Messages</span><span className="text-neutral-400">›</span></button>
        <button onClick={() => (window.location.href = '/recommendations')} className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-3 text-sm hover:bg-neutral-50"><span>Recommendations</span><span className="text-neutral-400">›</span></button>
        <button onClick={() => (window.location.href = '/community')} className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-3 text-sm hover:bg-neutral-50"><span>Community</span><span className="text-neutral-400">›</span></button>
        <button onClick={() => (window.location.href = '/settings/integrations')} className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-3 text-sm hover:bg-neutral-50"><span>Integrations</span><span className="text-neutral-400">›</span></button>
        <button onClick={() => setViewMode('standard')} className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50"><span className="font-semibold text-brand-700">Switch to Standard Mode</span><span className="text-neutral-400">∂</span></button>
      </CardContent></Card>
      <button onClick={() => logout({ reload: true })} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50">Sign out</button>
    </div>
  )
}
