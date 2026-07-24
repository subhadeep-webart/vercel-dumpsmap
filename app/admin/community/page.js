'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Users, MessageSquare, Heart, Trash2, Pin, BadgeCheck, Pause, Play, AlertTriangle,
  TrendingUp, MapPin, Star, Eye,
} from 'lucide-react'
import Link from 'next/link'

export default function AdminCommunity() {
  const { authFetch } = useAdmin()
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [posts, setPosts] = useState([])
  const [groups, setGroups] = useState([])
  const [postStatus, setPostStatus] = useState('')
  const [groupStatus, setGroupStatus] = useState('')
  const [search, setSearch] = useState('')

  const loadStats = async () => {
    const r = await authFetch('/api/admin/community/stats')
    if (r.ok) setStats(await r.json())
  }
  const loadPosts = async () => {
    const p = new URLSearchParams()
    if (postStatus) p.set('status', postStatus)
    const r = await authFetch(`/api/admin/community/posts?${p}`)
    if (r.ok) setPosts((await r.json()).posts || [])
  }
  const loadGroups = async () => {
    const p = new URLSearchParams()
    if (groupStatus) p.set('status', groupStatus)
    const r = await authFetch(`/api/admin/community/groups?${p}`)
    if (r.ok) setGroups((await r.json()).groups || [])
  }

  useEffect(() => { loadStats() }, [])
  useEffect(() => { if (tab === 'posts') loadPosts() }, [tab, postStatus])
  useEffect(() => { if (tab === 'groups') loadGroups() }, [tab, groupStatus])

  const actOnPost = async (id, action) => {
    const r = await authFetch(`/api/admin/community/posts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    if (r.ok) { toast.success(action); loadPosts(); loadStats() } else toast.error('Failed')
  }
  const actOnGroup = async (id, action) => {
    const r = await authFetch(`/api/admin/community/groups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    if (r.ok) { toast.success(action); loadGroups(); loadStats() } else toast.error('Failed')
  }

  const filteredPosts = posts.filter((p) => !search || (p.title || '').toLowerCase().includes(search.toLowerCase()) || (p.city || '').toLowerCase().includes(search.toLowerCase()))
  const filteredGroups = groups.filter((g) => !search || (g.name || '').toLowerCase().includes(search.toLowerCase()) || (g.city || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight"><Users className="h-6 w-6 text-brand-600" /> Community Moderation</h1>
        <p className="text-sm text-neutral-500">Umbrella moderation for posts, groups, and overall health metrics.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* OVERVIEW */}
      {tab === 'overview' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatBox icon={MessageSquare} label="Active posts" value={stats.posts.total} hint={`${stats.posts.last7} this week`} />
            <StatBox icon={MessageSquare} label="Comments" value={stats.comments.total} />
            <StatBox icon={Heart} label="Reactions" value={stats.reactions.total} />
            <StatBox icon={Users} label="Groups" value={stats.groups.total} hint={`${stats.groups.members} memberships`} />
            <StatBox icon={Trash2} label="Removed posts" value={stats.posts.removed} tone="red" />
            <StatBox icon={TrendingUp} label="Posts last 30d" value={stats.posts.last30} tone="green" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-bold">Posts by category</div>
                <div className="mt-2 space-y-1">
                  {(stats.categories || []).slice(0, 10).map((c) => (
                    <div key={c.key} className="flex items-center justify-between text-xs">
                      <span className="text-neutral-700">{c.key.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100"><div className="h-full bg-brand-500" style={{ width: `${Math.min(100, (c.count / Math.max(stats.posts.total, 1)) * 100)}%` }} /></div>
                        <span className="w-6 text-right font-semibold">{c.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">Top groups</div>
                  <Link href="/community/groups" className="text-[11px] text-brand-700 hover:underline">View all →</Link>
                </div>
                <div className="mt-2 space-y-1">
                  {(stats.topGroups || []).slice(0, 8).map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-xs">
                      <span className="truncate font-semibold">{g.name}</span>
                      <span className="text-neutral-500">{g.city || '—'} · {g.memberCount} mbrs</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* POSTS */}
      {tab === 'posts' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search title / city" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <div className="flex gap-1">
              {['', 'active', 'removed'].map((s) => (
                <Button key={s || 'any'} variant={postStatus === s ? 'default' : 'outline'} size="sm" onClick={() => setPostStatus(s)} className={postStatus === s ? 'bg-brand-600 hover:bg-brand-700' : ''}>{s || 'All'}</Button>
              ))}
            </div>
          </div>
          {filteredPosts.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-neutral-500">No posts.</div>}
          <div className="space-y-1.5">
            {filteredPosts.map((p) => (
              <Card key={p.id} className={p.status === 'removed' ? 'border-red-200 bg-red-50/30' : ''}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                      <Badge variant="outline" className="text-[10px]">{p.category?.replace(/_/g, ' ')}</Badge>
                      {p.urgency === 'high' && <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700 text-[10px]">urgent</Badge>}
                      {p.pinned && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px]"><Pin className="mr-0.5 h-2.5 w-2.5" />pinned</Badge>}
                      {p.isOfficial && <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-[10px]"><BadgeCheck className="mr-0.5 h-2.5 w-2.5" />official</Badge>}
                      {p.status === 'removed' && <Badge variant="outline" className="border-red-300 bg-red-100 text-red-800 text-[10px]">REMOVED</Badge>}
                      <span>· {p.city || '—'}</span>
                      <span>· {p.reactionCount || 0} rx · {p.commentCount || 0} cm · {p.viewCount || 0} vw</span>
                    </div>
                    <div className="truncate text-sm font-bold">{p.title}</div>
                    {p.body && <div className="truncate text-xs text-neutral-600">{p.body}</div>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {p.status === 'removed'
                      ? <Button size="sm" variant="outline" onClick={() => actOnPost(p.id, 'restore')}><Play className="h-3.5 w-3.5" /> Restore</Button>
                      : <Button size="sm" variant="outline" onClick={() => actOnPost(p.id, 'remove')} className="text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Remove</Button>}
                    {!p.pinned
                      ? <Button size="sm" variant="outline" onClick={() => actOnPost(p.id, 'pin')}><Pin className="h-3.5 w-3.5" /></Button>
                      : <Button size="sm" variant="outline" onClick={() => actOnPost(p.id, 'unpin')}><Pin className="h-3.5 w-3.5 opacity-50" /></Button>}
                    <Button size="sm" variant="outline" onClick={() => actOnPost(p.id, 'verify')} title="Mark official"><BadgeCheck className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* GROUPS */}
      {tab === 'groups' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search name / city" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <div className="flex gap-1">
              {['', 'active', 'suspended', 'removed'].map((s) => (
                <Button key={s || 'any'} variant={groupStatus === s ? 'default' : 'outline'} size="sm" onClick={() => setGroupStatus(s)} className={groupStatus === s ? 'bg-brand-600 hover:bg-brand-700' : ''}>{s || 'All'}</Button>
              ))}
            </div>
          </div>
          {filteredGroups.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-neutral-500">No groups.</div>}
          <div className="space-y-1.5">
            {filteredGroups.map((g) => (
              <Card key={g.id} className={g.status === 'suspended' ? 'border-amber-200 bg-amber-50/30' : g.status === 'removed' ? 'border-red-200 bg-red-50/30' : ''}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                      <Badge variant="outline" className="text-[10px]">{g.category}</Badge>
                      {g.adminVerified && <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-[10px]"><BadgeCheck className="mr-0.5 h-2.5 w-2.5" />verified</Badge>}
                      {g.featured && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px]"><Star className="mr-0.5 h-2.5 w-2.5" />featured</Badge>}
                      {g.status === 'suspended' && <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800 text-[10px]">SUSPENDED</Badge>}
                      {g.status === 'removed' && <Badge variant="outline" className="border-red-300 bg-red-100 text-red-800 text-[10px]">REMOVED</Badge>}
                      {g.city && <span><MapPin className="inline h-3 w-3" /> {g.city}</span>}
                      <span>· {g.memberCount || 0} members</span>
                    </div>
                    <div className="text-sm font-bold">{g.name}</div>
                    {g.description && <div className="line-clamp-1 text-xs text-neutral-600">{g.description}</div>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Link href={`/community/groups/${g.slug || g.id}`} className="inline-flex"><Button size="sm" variant="outline"><Eye className="h-3.5 w-3.5" /></Button></Link>
                    {g.status === 'active' && <Button size="sm" variant="outline" onClick={() => actOnGroup(g.id, 'suspend')} className="text-amber-700 hover:bg-amber-50"><Pause className="h-3.5 w-3.5" /></Button>}
                    {g.status !== 'active' && <Button size="sm" variant="outline" onClick={() => actOnGroup(g.id, 'restore')}><Play className="h-3.5 w-3.5" /></Button>}
                    {!g.featured
                      ? <Button size="sm" variant="outline" onClick={() => actOnGroup(g.id, 'feature')}><Star className="h-3.5 w-3.5" /></Button>
                      : <Button size="sm" variant="outline" onClick={() => actOnGroup(g.id, 'unfeature')}><Star className="h-3.5 w-3.5 opacity-50" /></Button>}
                    {!g.adminVerified && <Button size="sm" variant="outline" onClick={() => actOnGroup(g.id, 'verify')}><BadgeCheck className="h-3.5 w-3.5" /></Button>}
                    <Button size="sm" variant="outline" onClick={() => actOnGroup(g.id, 'remove')} className="text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ icon: Icon, label, value, hint, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-neutral-200 bg-white',
    green:   'border-brand-200 bg-brand-50/40',
    red:     'border-red-200 bg-red-50/40',
  }
  return (
    <Card className={tones[tone]}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500"><Icon className="h-3.5 w-3.5" /> {label}</div>
        <div className="mt-1 text-2xl font-extrabold">{value}</div>
        {hint && <div className="text-[10px] text-neutral-500">{hint}</div>}
      </CardContent>
    </Card>
  )
}
