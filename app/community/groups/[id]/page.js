'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Users, MapPin, Settings, Shield, Plus, LogOut, BadgeCheck, Pin, MessageCircle, AlertTriangle, Star } from 'lucide-react'
import { toast } from 'sonner'
import RoleBadge from '@/components/RoleBadge'
import { CATEGORY_BY_KEY, categoryColor, timeAgo, REACTION_TYPES } from '@/lib/community-categories'
import { GroupCategoryIcon, CategoryIcon } from '@/lib/community-icons'
import GroupChatPanel from '@/components/messaging/GroupChatPanel'
import PageShell from '@/components/PageShell'

const GROUP_CATS = {
  haulers: { label: 'Haulers' }, cleanup: { label: 'Cleanup Crew' },
  reuse: { label: 'Reuse / Free' }, contractors: { label: 'Contractors' },
  recycling: { label: 'Recycling' }, property: { label: 'Property Mgmt' },
  scrap: { label: 'Scrap Metal' }, donation: { label: 'Donation Network' },
  agency: { label: 'Agency' }, general: { label: 'General' },
}

export default function GroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id
  const [user, setUser] = useState(null)
  const [group, setGroup] = useState(null)
  const [posts, setPosts] = useState([])
  const [members, setMembers] = useState([])
  const [busy, setBusy] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [tab, setTab] = useState('feed')

  // Sync ?tab=chat / ?tab=members on first load
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    const t = sp.get('tab')
    if (t && ['feed', 'chat', 'members'].includes(t)) setTab(t)
  }, [])

  const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  useEffect(() => { if (token) fetch('/api/auth/me', { headers }).then((r) => r.json()).then((j) => setUser(j.user || null)).catch(() => {}) }, [token])

  const loadGroup = async () => {
    const r = await fetch(`/api/community/groups/${id}`, { headers })
    if (!r.ok) { setGroup('not_found'); return }
    const j = await r.json()
    setGroup(j.group)
  }
  const loadPosts = async () => {
    const r = await fetch(`/api/community/groups/${id}/posts?limit=60`, { headers })
    const j = await r.json()
    setPosts(j.posts || [])
  }
  const loadMembers = async () => {
    const r = await fetch(`/api/community/groups/${id}/members?limit=100`)
    const j = await r.json()
    setMembers(j.members || [])
  }
  useEffect(() => { if (id) { loadGroup(); loadPosts() } }, [id])
  useEffect(() => { if (tab === 'members' && id) loadMembers() }, [tab, id])

  const join = async () => {
    if (!token) { toast.error('Log in'); return }
    setBusy(true)
    const r = await fetch(`/api/community/groups/${group.id}/join`, { method: 'POST', headers })
    setBusy(false)
    if (r.ok) { toast.success('Joined group'); loadGroup() } else { const j = await r.json(); toast.error(j.error || 'Failed') }
  }
  const leave = async () => {
    if (!confirm('Leave this group?')) return
    setBusy(true)
    const r = await fetch(`/api/community/groups/${group.id}/leave`, { method: 'POST', headers })
    setBusy(false)
    if (r.ok) { toast.success('Left group'); loadGroup() } else { const j = await r.json(); toast.error(j.error || 'Failed') }
  }
  const kick = async (memberId) => {
    if (!confirm('Remove this member from the group?')) return
    const r = await fetch(`/api/community/groups/${group.id}/members/${memberId}`, { method: 'DELETE', headers })
    if (r.ok) { toast.success('Removed'); loadMembers(); loadGroup() } else { const j = await r.json(); toast.error(j.error || 'Failed') }
  }

  if (group === 'not_found') {
    return (
      <div className="min-h-screen bg-neutral-50 p-8 text-center">
        <p className="text-neutral-500">Group not found.</p>
        <Link href="/community/groups" className="text-brand-700 hover:underline">← Back to groups</Link>
      </div>
    )
  }
  if (!group) return <div className="p-8 text-center text-sm text-neutral-500">Loading group…</div>

  const cat = GROUP_CATS[group.category] || GROUP_CATS.general
  const isOrganizer = group.myRole === 'group_admin' || group.ownerId === user?.id
  const isStaff = user && ['super_admin', 'admin', 'moderator'].includes(user.role)

  return (
    <PageShell active="community" breadcrumbs={[{ label: 'Community', href: '/community' }, { label: 'Groups', href: '/community/groups' }, { label: group.name }]} maxWidth="max-w-4xl">

      <div className="container mx-auto px-4 py-4">
        {/* Group header card */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="inline-flex items-center gap-1"><GroupCategoryIcon categoryKey={group.category} className="h-3.5 w-3.5" /> {cat.label}</Badge>
              {group.adminVerified && <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700"><BadgeCheck className="mr-0.5 h-3 w-3" /> Verified</Badge>}
              {group.featured && <Badge variant="outline" className="inline-flex items-center gap-1 border-amber-300 bg-amber-50 text-amber-700"><Star className="h-3 w-3" /> Featured</Badge>}
              {group.city && <Badge variant="outline"><MapPin className="mr-0.5 h-3 w-3" /> {group.city}{group.state ? `, ${group.state}` : ''}</Badge>}
            </div>
            <h1 className="mt-2 text-xl font-extrabold leading-tight md:text-2xl">{group.name}</h1>
            {group.description && <p className="mt-1 text-sm text-neutral-700">{group.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <Users className="h-3.5 w-3.5" /> {group.memberCount || 0} members
              {group.owner && <span>· Organizer {group.owner.name}</span>}
              <span>· Created {timeAgo(group.createdAt)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!group.myRole && <Button onClick={join} disabled={busy} className="bg-brand-600 hover:bg-brand-700"><Plus className="mr-1 h-4 w-4" /> Join group</Button>}
              {group.myRole === 'member' && <Button variant="outline" onClick={leave} disabled={busy}><LogOut className="mr-1 h-4 w-4" /> Leave</Button>}
              {group.myRole && <Button onClick={() => { if (!token) { toast.error('Log in'); return } setComposeOpen(true) }} className="bg-brand-600 hover:bg-brand-700"><Plus className="mr-1 h-4 w-4" /> Post to group</Button>}
              {(isOrganizer || isStaff) && <Button variant="outline" onClick={() => router.push(`/community/groups/${group.slug || group.id}/settings`)}><Settings className="mr-1 h-4 w-4" /> Settings</Button>}
              {isOrganizer && <Badge variant="outline" className="inline-flex items-center gap-1 border-amber-300 bg-amber-50 text-amber-800">{group.myRole === 'group_admin' ? <><Star className="h-3 w-3" /> Organizer</> : 'Owner'}</Badge>}
            </div>
            {Array.isArray(group.rules) && group.rules.length > 0 && (
              <details className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-neutral-600">Group rules</summary>
                <ul className="mt-1 ml-5 list-disc space-y-0.5 text-xs text-neutral-700">{group.rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </details>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="mt-4 flex overflow-x-auto border-b border-neutral-200">
          {['feed', 'chat', 'members'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`relative whitespace-nowrap px-4 py-2 text-sm font-medium ${tab === t ? 'text-neutral-900' : 'text-neutral-500'}`}>
              {t === 'feed' && `Feed (${posts.length})`}
              {t === 'chat' && <span className="inline-flex items-center gap-1">Chat <MessageCircle className="h-4 w-4" /></span>}
              {t === 'members' && `Members (${group.memberCount || 0})`}
              {tab === t && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded bg-brand-500" />}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {tab === 'feed' && (
            <div className="space-y-2">
              {posts.length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-neutral-600">No posts in this group yet.</p>
                  {group.myRole && <Button onClick={() => setComposeOpen(true)} className="mt-2 bg-brand-600 hover:bg-brand-700"><Plus className="mr-1 h-4 w-4" /> First post</Button>}
                </div>
              )}
              {posts.map((p) => <GroupPostCard key={p.id} post={p} />)}
            </div>
          )}
          {tab === 'chat' && (
            group.myRole ? (
              <GroupChatPanel groupId={group.id} token={token} currentUser={user} canPost={true} emptyHint={`Welcome to ${group.name}! Say hi.`} />
            ) : (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
                <MessageCircle className="mx-auto h-8 w-8 text-neutral-400" />
                <p className="mt-2 text-sm font-semibold text-neutral-800">Members-only chat</p>
                <p className="mt-1 text-xs text-neutral-500">Join this group to read and post messages.</p>
                <Button onClick={join} disabled={busy} className="mt-3 bg-brand-600 hover:bg-brand-700"><Plus className="mr-1 h-4 w-4" /> Join group</Button>
              </div>
            )
          )}
          {tab === 'members' && (
            <div className="space-y-2">
              {members.length === 0 && <div className="text-center text-sm text-neutral-500">Loading members…</div>}
              {members.map((m) => (
                <Card key={m.id}>
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">{(m.name || '?')[0].toUpperCase()}</span>
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold">{m.name} <RoleBadge user={m} /></div>
                        <div className="flex items-center gap-1 text-[11px] text-neutral-500">{m.role === 'group_admin' ? <><Star className="h-3 w-3" /> Organizer</> : 'Member'} · Joined {timeAgo(m.joinedAt)}</div>
                      </div>
                    </div>
                    {(isOrganizer || isStaff) && m.id !== group.ownerId && (
                      <Button variant="outline" size="sm" onClick={() => kick(m.id)} className="text-red-600 hover:bg-red-50">Remove</Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <GroupComposeDialog open={composeOpen} onOpenChange={setComposeOpen} groupId={group.id} token={token} onPosted={loadPosts} />
    </PageShell>
  )
}

function GroupPostCard({ post }) {
  const cat = CATEGORY_BY_KEY[post.category] || CATEGORY_BY_KEY?.general
  const colors = categoryColor(post.category)
  return (
    <Card className={post.pinned ? 'border-amber-300 bg-amber-50/30' : ''}>
      <CardContent className="p-3.5">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={`inline-flex items-center gap-1 ${colors.chip}`}><CategoryIcon categoryKey={post.category} className="h-3 w-3" /> {cat?.label}</Badge>
          {post.urgency === 'high' && <Badge variant="outline" className="inline-flex items-center gap-1 border-red-300 bg-red-50 text-red-700"><AlertTriangle className="h-3 w-3" /> Urgent</Badge>}
          {post.pinned && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800"><Pin className="mr-0.5 h-3 w-3" /> Pinned</Badge>}
          <span className="ml-auto text-[11px] text-neutral-500">{timeAgo(post.createdAt)}</span>
        </div>
        <h3 className="text-sm font-bold md:text-base">{post.title}</h3>
        {post.body && <p className="mt-1 line-clamp-2 text-xs text-neutral-700 md:text-sm">{post.body}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-neutral-500">
          {post.author && <span className="inline-flex items-center gap-1">{post.author.name} <RoleBadge profileType={post.author.profileType} /></span>}
          {post.city && <span>· {post.city}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function GroupComposeDialog({ open, onOpenChange, groupId, token, onPosted }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (!title.trim()) { toast.error('Add a title'); return }
    setSubmitting(true)
    const r = await fetch('/api/community/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category: 'general', title, body, groupId }),
    })
    const j = await r.json()
    setSubmitting(false)
    if (!r.ok) { toast.error(j.error || 'Failed'); return }
    toast.success('Posted to group'); setTitle(''); setBody(''); onOpenChange(false); onPosted?.()
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Post to group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="text-xs font-bold uppercase">Title</label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} /></div>
          <div><label className="text-xs font-bold uppercase">Body</label><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} /></div>
          <Button onClick={submit} disabled={submitting} className="w-full bg-brand-600 hover:bg-brand-700">{submitting ? 'Posting…' : 'Post'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
