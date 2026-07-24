'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Users, MessageSquare, Calendar, Send, ThumbsUp, MessageCircle, Plus, ArrowLeft, Hash, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { timeAgo } from '@/components/AlertSystem'

export const COMMUNITY_CATEGORIES = [
  { k: 'contractor', l: 'Contractor Updates', icon: '🚚' },
  { k: 'recycling', l: 'Recycling Tips', icon: '♻️' },
  { k: 'donation', l: 'Donation Needs', icon: '❤️' },
  { k: 'closures', l: 'Facility Closures', icon: '🚫' },
  { k: 'events', l: 'Events', icon: '🎉' },
  { k: 'free_drop', l: 'Free Drop-Off Days', icon: '🆓' },
  { k: 'route', l: 'Route Help', icon: '🗺️' },
  { k: 'materials', l: 'Material Questions', icon: '❓' },
]

const EVENT_TYPES = [
  'E-waste Drive',
  'Donation Drive',
  'Free Dump Day',
  'Recycling Event',
  'Community Cleanup',
  'Contractor Meetup',
]

const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// ---------- New Post Dialog ----------
export function NewPostDialog({ open, onOpenChange, scope, facilityId, onPosted, defaultCategory = '' }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState(defaultCategory)
  const [eventDate, setEventDate] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) { setTitle(''); setBody(''); setCategory(defaultCategory); setEventDate(''); setEventLocation('') }
  }, [open, defaultCategory])

  const submit = async () => {
    if (!title) return toast.error('Title required')
    if (scope === 'community' && !category) return toast.error('Pick a category')
    if (scope === 'event' && !eventDate) return toast.error('Pick a date')
    setBusy(true)
    try {
      const r = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ scope, facilityId, title, body, category, eventDate, eventLocation }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      toast.success(scope === 'event' ? 'Event posted' : 'Post created')
      onPosted?.(j.post)
      onOpenChange(false)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const titleText = scope === 'event' ? 'Post an event' : scope === 'facility' ? 'Post to facility board' : 'Post to community board'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{titleText}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          {scope === 'community' && (
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pick category" /></SelectTrigger>
                <SelectContent>
                  {COMMUNITY_CATEGORIES.map((c) => (
                    <SelectItem key={c.k} value={c.k}>{c.icon} {c.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {scope === 'event' && (
            <>
              <div>
                <Label className="text-xs">Event type</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pick event type" /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Location</Label>
                  <Input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Address or facility" className="mt-1" />
                </div>
              </div>
            </>
          )}
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={scope === 'event' ? 'Free E-Waste Drop-Off Saturday' : 'What\'s up?'} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Details</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share details, links, prices…" rows={4} className="mt-1" />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full bg-brand-600 hover:bg-brand-700">{busy ? '…' : 'Post'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Post Card ----------
function PostCard({ post, onUpvote, onOpen, onMessage, currentUserId }) {
  const cat = COMMUNITY_CATEGORIES.find((c) => c.k === post.category)
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm hover:shadow-md">
      <div className="flex items-center gap-2 text-[11px] text-neutral-500">
        {post.scope === 'event' && post.eventDate && (
          <Badge className="bg-brand-600 text-white">📅 {new Date(post.eventDate).toLocaleDateString()}</Badge>
        )}
        {post.scope === 'community' && cat && (
          <Badge variant="outline">{cat.icon} {cat.l}</Badge>
        )}
        {post.isOfficial && <Badge className="bg-purple-600 text-white">Official</Badge>}
        {post.isAdminPost && <Badge className="bg-amber-500 text-white">Admin</Badge>}
        <span>· {timeAgo(post.createdAt)}</span>
      </div>
      <button onClick={() => onOpen?.(post)} className="mt-1 block w-full text-left">
        <div className="font-semibold text-neutral-900">{post.title}</div>
        {post.body && <div className="mt-1 line-clamp-2 text-sm text-neutral-600">{post.body}</div>}
        {post.eventLocation && <div className="mt-1 text-xs text-neutral-500">📍 {post.eventLocation}</div>}
        {post.facilityName && <div className="mt-1 text-xs text-neutral-500">@ {post.facilityName}</div>}
      </button>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-[11px] text-neutral-500">
          by <b>{post.userName}</b>{post.userPrimaryProfile ? ` · ${post.userPrimaryProfile}` : ''}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onUpvote?.(post.id)} className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50">
            <ThumbsUp className="h-3 w-3" /> {post.upvotes || 0}
          </button>
          <button onClick={() => onOpen?.(post)} className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50">
            <MessageCircle className="h-3 w-3" /> {post.commentCount || 0}
          </button>
          {currentUserId && post.userId !== currentUserId && (
            <button onClick={() => onMessage?.(post)} className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50" title="Message user">
              <Send className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Post Detail Dialog (with comments) ----------
function PostDetailDialog({ open, onOpenChange, postId, currentUser }) {
  const [data, setData] = useState(null)
  const [text, setText] = useState('')

  const load = () => {
    if (!postId) return
    fetch(`/api/posts/${postId}`).then((r) => r.json()).then(setData)
  }

  useEffect(() => { if (open && postId) load() }, [open, postId])

  const addComment = async () => {
    if (!text || !currentUser) return
    const r = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ body: text }),
    })
    if (r.ok) { setText(''); load() }
  }

  const p = data?.post
  if (!p) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>Loading…</DialogContent>
      </Dialog>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{p.title}</DialogTitle></DialogHeader>
        <div className="space-y-2 pt-2 text-sm">
          <div className="text-xs text-neutral-500">by <b>{p.userName}</b> · {timeAgo(p.createdAt)}</div>
          {p.body && <div className="whitespace-pre-wrap rounded-md bg-neutral-50 p-3">{p.body}</div>}
          {p.eventDate && (
            <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-sm">
              📅 <b>{new Date(p.eventDate).toLocaleDateString()}</b>{p.eventLocation && <> · 📍 {p.eventLocation}</>}
            </div>
          )}
          <div className="pt-3 font-semibold">{(data.comments || []).length} comments</div>
          <div className="space-y-2">
            {(data.comments || []).map((c) => (
              <div key={c.id} className="rounded-md border border-neutral-200 p-2 text-sm">
                <div className="text-xs text-neutral-500"><b>{c.userName}</b> · {timeAgo(c.createdAt)}</div>
                <div className="mt-0.5">{c.body}</div>
              </div>
            ))}
            {!(data.comments || []).length && <div className="text-xs text-neutral-500">No comments yet.</div>}
          </div>
          {currentUser && (
            <div className="flex gap-2 pt-2">
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" onKeyDown={(e) => e.key === 'Enter' && addComment()} />
              <Button onClick={addComment} className="bg-brand-600 hover:bg-brand-700">Post</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Inline Facility Board (used inside FacilityDetail) ----------
export function FacilityBoard({ facilityId, currentUser }) {
  const [posts, setPosts] = useState([])
  const [newPostOpen, setNewPostOpen] = useState(false)
  const [openPostId, setOpenPostId] = useState(null)

  const load = () => fetch(`/api/posts?scope=facility&facilityId=${facilityId}`).then((r) => r.json()).then((j) => setPosts(j.posts || []))
  useEffect(() => { if (facilityId) load() }, [facilityId])

  const upvote = async (id) => {
    if (!currentUser) return toast('Log in to upvote')
    await fetch(`/api/posts/${id}/upvote`, { method: 'POST', headers: authHeader() })
    load()
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold">Facility Board ({posts.length})</div>
        {currentUser && (
          <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={() => setNewPostOpen(true)}>
            <Plus className="mr-1 h-3 w-3" /> Post
          </Button>
        )}
      </div>
      {!posts.length ? (
        <div className="rounded-lg border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-500">
          No posts yet. Start a thread — wait times, closures, prices…
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => <PostCard key={p.id} post={p} onUpvote={upvote} onOpen={() => setOpenPostId(p.id)} currentUserId={currentUser?.id} />)}
        </div>
      )}
      <NewPostDialog open={newPostOpen} onOpenChange={setNewPostOpen} scope="facility" facilityId={facilityId} onPosted={load} />
      <PostDetailDialog open={!!openPostId} onOpenChange={(v) => !v && setOpenPostId(null)} postId={openPostId} currentUser={currentUser} />
    </div>
  )
}

// ---------- Messages Pane ----------
function MessagesPane({ currentUser, openTarget }) {
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [newTo, setNewTo] = useState(null)

  const loadThreads = () => fetch('/api/messages/threads', { headers: authHeader() }).then((r) => r.json()).then((j) => setThreads(j.threads || []))

  useEffect(() => { if (currentUser) loadThreads() }, [currentUser])
  useEffect(() => {
    const t = setInterval(() => { if (currentUser) loadThreads() }, 15000)
    return () => clearInterval(t)
  }, [currentUser])

  // when openTarget is set (incoming "message this user")
  useEffect(() => {
    if (openTarget) {
      setNewTo(openTarget)
      setActiveThread(null)
    }
  }, [openTarget])

  const openThread = async (t) => {
    setActiveThread(t)
    setNewTo(null)
    const r = await fetch(`/api/messages/thread/${t.threadId}`, { headers: authHeader() })
    const j = await r.json()
    setMessages(j.messages || [])
    loadThreads()
  }

  const sendMsg = async (toUserId) => {
    if (!text) return
    const r = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ toUserId, body: text }),
    })
    if (r.ok) {
      setText('')
      // refresh thread list and open the (possibly new) thread
      const j = await fetch('/api/messages/threads', { headers: authHeader() }).then((x) => x.json())
      setThreads(j.threads || [])
      const pair = [currentUser.id, toUserId].sort().join('_')
      const found = (j.threads || []).find((t) => t.threadId === pair)
      if (found) openThread(found)
      setNewTo(null)
    }
  }

  const search = async (q) => {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { headers: authHeader() })
    const j = await r.json()
    setSearchResults(j.users || [])
  }

  if (!currentUser) {
    return <div className="p-6 text-center text-sm text-neutral-500">Log in to use direct messaging.</div>
  }

  // Composing new message
  if (newTo) {
    return (
      <div className="flex h-[60vh] flex-col">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
          <button onClick={() => setNewTo(null)} className="text-neutral-500 hover:text-neutral-900"><ArrowLeft className="h-4 w-4" /></button>
          <div className="text-sm font-semibold">To: {newTo.name}</div>
        </div>
        <div className="flex-1 p-3" />
        <div className="flex gap-2 border-t border-neutral-200 p-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${newTo.name}…`} onKeyDown={(e) => e.key === 'Enter' && sendMsg(newTo.id)} />
          <Button onClick={() => sendMsg(newTo.id)} className="bg-brand-600 hover:bg-brand-700"><Send className="h-3 w-3" /></Button>
        </div>
      </div>
    )
  }

  // Active thread view
  if (activeThread) {
    return (
      <div className="flex h-[60vh] flex-col">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
          <button onClick={() => setActiveThread(null)} className="text-neutral-500 hover:text-neutral-900"><ArrowLeft className="h-4 w-4" /></button>
          <div className="text-sm font-semibold">{activeThread.otherName}</div>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2">
            {messages.map((m) => {
              const mine = m.fromUserId === currentUser.id
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm ${mine ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                    <div>{m.body}</div>
                    <div className={`text-[9px] ${mine ? 'text-brand-100' : 'text-neutral-500'}`}>{timeAgo(m.createdAt)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
        <div className="flex gap-2 border-t border-neutral-200 p-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" onKeyDown={(e) => e.key === 'Enter' && sendMsg(activeThread.otherId)} />
          <Button onClick={() => sendMsg(activeThread.otherId)} className="bg-brand-600 hover:bg-brand-700"><Send className="h-3 w-3" /></Button>
        </div>
      </div>
    )
  }

  // Inbox list
  return (
    <div className="flex h-[60vh] flex-col">
      <div className="space-y-2 border-b border-neutral-200 p-3">
        <Input value={searchQuery} onChange={(e) => search(e.target.value)} placeholder="🔎 Find a user to message…" />
        {searchResults.length > 0 && (
          <div className="space-y-1 rounded-md border border-neutral-200 bg-white p-1">
            {searchResults.map((u) => (
              <button key={u.id} onClick={() => { setNewTo(u); setSearchQuery(''); setSearchResults([]) }} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-50">
                <div>
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-[10px] text-neutral-500">{u.primaryProfile || 'user'} · ⚡ {u.karma || 0}</div>
                </div>
                <Send className="h-3 w-3 text-neutral-400" />
              </button>
            ))}
          </div>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="divide-y divide-neutral-100">
          {threads.map((t) => (
            <button key={t.threadId} onClick={() => openThread(t)} className="flex w-full items-start gap-3 p-3 text-left hover:bg-neutral-50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {t.otherName?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="truncate font-semibold">{t.otherName}</div>
                  <div className="text-[10px] text-neutral-500">{timeAgo(t.lastMessage?.createdAt)}</div>
                </div>
                <div className="truncate text-xs text-neutral-600">{t.lastMessage?.body}</div>
              </div>
              {t.unread > 0 && (
                <Badge className="bg-orange-600 text-white">{t.unread}</Badge>
              )}
            </button>
          ))}
          {!threads.length && (
            <div className="p-6 text-center text-sm text-neutral-500">No conversations yet. Find a user above to start one.</div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ---------- Community Center Dialog (3 tabs) ----------
export function CommunityCenter({ open, onOpenChange, currentUser, initialTab = 'community', messageTarget = null }) {
  const [tab, setTab] = useState(initialTab)
  const [communityPosts, setCommunityPosts] = useState([])
  const [events, setEvents] = useState([])
  const [category, setCategory] = useState('')
  const [newPostOpen, setNewPostOpen] = useState(false)
  const [newEventOpen, setNewEventOpen] = useState(false)
  const [openPostId, setOpenPostId] = useState(null)

  useEffect(() => { if (open) setTab(initialTab) }, [open, initialTab])

  const loadCommunity = () => {
    const p = new URLSearchParams({ scope: 'community' })
    if (category) p.set('category', category)
    fetch(`/api/posts?${p.toString()}`).then((r) => r.json()).then((j) => setCommunityPosts(j.posts || []))
  }
  const loadEvents = () => fetch('/api/posts?scope=event&upcoming=true').then((r) => r.json()).then((j) => setEvents(j.posts || []))

  useEffect(() => { if (open && tab === 'community') loadCommunity() }, [open, tab, category])
  useEffect(() => { if (open && tab === 'events') loadEvents() }, [open, tab])

  const upvote = async (id) => {
    if (!currentUser) return toast('Log in to upvote')
    await fetch(`/api/posts/${id}/upvote`, { method: 'POST', headers: authHeader() })
    if (tab === 'community') loadCommunity(); else loadEvents()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-600" /> Community Center
          </DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="px-6 pb-6">
          <TabsList>
            <TabsTrigger value="community"><MessageSquare className="mr-1 h-3 w-3" /> Board</TabsTrigger>
            <TabsTrigger value="events"><Calendar className="mr-1 h-3 w-3" /> Events</TabsTrigger>
            <TabsTrigger value="messages"><Send className="mr-1 h-3 w-3" /> Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="community" className="pt-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button onClick={() => setCategory('')} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${!category ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-700'}`}>All</button>
              {COMMUNITY_CATEGORIES.map((c) => (
                <button key={c.k} onClick={() => setCategory(c.k)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${category === c.k ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-700'}`}>
                  {c.icon} {c.l}
                </button>
              ))}
              <div className="ml-auto">
                {currentUser && (
                  <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={() => setNewPostOpen(true)}>
                    <Plus className="mr-1 h-3 w-3" /> New post
                  </Button>
                )}
              </div>
            </div>
            <ScrollArea className="h-[55vh]">
              <div className="space-y-2 pr-2">
                {communityPosts.length === 0 && (
                  <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
                    No posts yet. Start the conversation.
                  </div>
                )}
                {communityPosts.map((p) => <PostCard key={p.id} post={p} onUpvote={upvote} onOpen={() => setOpenPostId(p.id)} currentUserId={currentUser?.id} />)}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="events" className="pt-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm text-neutral-600">Upcoming events posted by facilities and admins.</div>
              {currentUser && (
                <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={() => setNewEventOpen(true)}>
                  <Plus className="mr-1 h-3 w-3" /> New event
                </Button>
              )}
            </div>
            <ScrollArea className="h-[55vh]">
              <div className="space-y-2 pr-2">
                {events.length === 0 && (
                  <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
                    No upcoming events. Be the first to post one.
                  </div>
                )}
                {events.map((p) => <PostCard key={p.id} post={p} onUpvote={upvote} onOpen={() => setOpenPostId(p.id)} currentUserId={currentUser?.id} />)}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="messages" className="pt-3">
            <MessagesPane currentUser={currentUser} openTarget={messageTarget} />
          </TabsContent>
        </Tabs>
        <NewPostDialog open={newPostOpen} onOpenChange={setNewPostOpen} scope="community" onPosted={loadCommunity} />
        <NewPostDialog open={newEventOpen} onOpenChange={setNewEventOpen} scope="event" onPosted={loadEvents} />
        <PostDetailDialog open={!!openPostId} onOpenChange={(v) => !v && setOpenPostId(null)} postId={openPostId} currentUser={currentUser} />
      </DialogContent>
    </Dialog>
  )
}

// ---------- Community button + unread badge (used in headers) ----------
export function CommunityButton({ onOpen, user }) {
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    if (!user) return
    const load = () => fetch('/api/messages/threads', { headers: authHeader() }).then((r) => r.json()).then((j) => setUnread(j.unreadCount || 0))
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [user])
  return (
    <button onClick={onOpen} className="relative flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium hover:bg-neutral-50">
      <Users className="h-4 w-4 text-brand-600" />
      <span className="hidden md:inline">Community</span>
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-600 px-1 text-[9px] font-bold text-white">
          {unread}
        </span>
      )}
    </button>
  )
}
