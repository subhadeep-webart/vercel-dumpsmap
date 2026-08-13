'use client'

import React, { Suspense, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, MessageCircle, ShoppingBag, Briefcase, Users, Mail } from 'lucide-react'
import DmThreadPanel from '@/components/messaging/DmThreadPanel'
import { api, isLikelyLoggedIn } from '@/lib/api-client'
import { timeAgo } from '@/lib/community-categories'
import { Volume2, VolumeX } from 'lucide-react'

const SOUND_KEY = 'dm_notify_sound_on'

function SoundToggle() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setOn(localStorage.getItem(SOUND_KEY) === '1')
  }, [])
  const toggle = () => {
    const next = !on
    setOn(next)
    if (typeof window !== 'undefined') localStorage.setItem(SOUND_KEY, next ? '1' : '0')
  }
  return (
    <button
      onClick={toggle}
      title={on ? 'DM sound on — click to mute' : 'DM sound off — click to enable'}
      className="rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-600 hover:bg-neutral-50"
    >
      {on ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
    </button>
  )
}


const POLL_MS = 5000

export default function InboxPage() {
  // Suspense boundary required by Next 15 for the useSearchParams() inside
  // InboxInner (reads the ?dm=<userId> deep link).
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50" />}>
      <InboxInner />
    </Suspense>
  )
}

function InboxInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('dm')
  const [dmThreads, setDmThreads] = useState([])
  const [mpThreads, setMpThreads] = useState([])
  const [jobThreads, setJobThreads] = useState([])
  const [groupUnread, setGroupUnread] = useState([])
  const [unreadCounts, setUnreadCounts] = useState({ count: 0, dm: 0, marketplace: 0, jobs: 0, groups: 0 })
  const [selected, setSelected] = useState(null) // DM thread object
  const [loading, setLoading] = useState(true)

  // Hydration-safe: defer the login check to client mount
  useEffect(() => {
    setMounted(true)
    setToken(isLikelyLoggedIn())
  }, [])

  useEffect(() => {
    if (!token) { setLoading(false); return }
    api.get('/api/auth/me').then((j) => setUser(j.user || null))
  }, [token])

  const load = useCallback(async () => {
    if (!token) return
    try {
      const [dm, mp, unread] = await Promise.all([
        api.get('/api/dm/threads'),
        api.get('/api/marketplace/inbox/threads'),
        api.get('/api/inbox/unread-count'),
      ])
      setDmThreads(dm?.threads || [])
      setMpThreads(mp?.marketplaceThreads || [])
      setJobThreads(mp?.jobThreads || [])
      setUnreadCounts(unread || {})
      setGroupUnread(unread?.groupBreakdown || [])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  // Deep link: /inbox?dm=<userId> opens that conversation directly. Used by the
  // Activity Hub card message button (mobile), job + marketplace detail pages,
  // and FieldShell — all of which previously landed here with nothing selected
  // because the param was never read.
  //
  // POST /dm/threads resolves the deterministic thread id (it writes nothing),
  // then we select it and strip the param so a refresh or back-nav doesn't
  // re-trigger this.
  useEffect(() => {
    const dmUserId = searchParams.get('dm')
    if (!dmUserId || !token) return
    let cancelled = false
    ;(async () => {
      try {
        const j = await api.post('/api/dm/threads', { userId: dmUserId })
        if (!cancelled && j?.thread) {
          setTab('dm')
          setSelected(j.thread)
        }
      } catch {
        // Unknown user / self-DM — fall through to the normal inbox.
      } finally {
        if (!cancelled) {
          const sp = new URLSearchParams(searchParams.toString())
          sp.delete('dm')
          const qs = sp.toString()
          router.replace(qs ? `/inbox?${qs}` : '/inbox', { scroll: false })
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, token])

  if (!mounted) return <div className="min-h-screen bg-neutral-50" />
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6 text-center">
        <div>
          <Mail className="mx-auto h-9 w-9 text-neutral-500" />
          <h1 className="mt-2 text-lg font-bold">Sign in to view your inbox</h1>
          <p className="mt-1 text-sm text-neutral-500">Direct messages, marketplace, jobs, and group chats all in one place.</p>
          <Link href="/" className="mt-3 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Go home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Inbox</h1>
          <p className="text-xs text-neutral-500">All your messages across Marketplace, Jobs, and Groups.</p>
        </div>
        <div className="flex items-center gap-2">
          <SoundToggle />
          {unreadCounts.count > 0 && <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">{unreadCounts.count} new</Badge>}
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">
        <div className="mb-3 flex overflow-x-auto border-b border-neutral-200">
          {[
            { key: 'dm', label: 'Direct', icon: MessageCircle, unread: unreadCounts.dm },
            { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag, unread: unreadCounts.marketplace },
            { key: 'jobs', label: 'Jobs', icon: Briefcase, unread: unreadCounts.jobs },
            { key: 'groups', label: 'Group chats', icon: Users, unread: unreadCounts.groups },
          ].map((t) => {
            const Icon = t.icon
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setSelected(null) }} className={`relative inline-flex items-center gap-1 whitespace-nowrap px-3 py-2 text-sm font-medium ${tab === t.key ? 'text-neutral-900' : 'text-neutral-500'}`}>
                <Icon className="h-3.5 w-3.5" /> {t.label}
                {t.unread > 0 && <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{t.unread > 99 ? '99+' : t.unread}</span>}
                {tab === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-brand-500" />}
              </button>
            )
          })}
        </div>

        {tab === 'dm' && (
          <div className="grid gap-3 md:grid-cols-[320px_1fr]">
            <div className="space-y-1">
              {loading && <div className="py-6 text-center text-sm text-neutral-500">Loading…</div>}
              {!loading && dmThreads.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-neutral-500">
                  No direct messages yet. Find a user on a facility or job and tap “Message”.
                </div>
              )}
              {dmThreads.map((t) => (
                <button key={t.threadId} onClick={() => setSelected(t)} className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left transition ${selected?.threadId === t.threadId ? 'border-brand-300 bg-brand-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">{(t.otherUserName || '?')[0].toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="truncate text-sm font-semibold">{t.otherUserName}</div>
                      <div className="shrink-0 text-[10px] text-neutral-400">{timeAgo(t.lastMessageAt)}</div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                      <span className="truncate">{t.lastMessage || '(no message)'}</span>
                      {t.unread > 0 && <span className="ml-auto inline-flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{t.unread}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div>
              {selected ? (
                <DmThreadPanel threadId={selected.threadId} token={token} currentUser={user} otherUser={selected} autoFocus />
              ) : (
                <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white text-center text-sm text-neutral-500">
                  Select a conversation to start chatting.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'marketplace' && (
          <div className="space-y-2">
            {mpThreads.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-neutral-500">No marketplace messages yet.</div>}
            {mpThreads.map((t) => (
              <Link key={`${t.listingId}-${t.otherUserId}`} href={`/?listing=${t.listingId}`} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2 hover:bg-neutral-50">
                {t.listingPhoto ? <img src={t.listingPhoto} alt="" className="h-12 w-12 shrink-0 rounded object-cover" /> : <div className="h-12 w-12 shrink-0 rounded bg-neutral-100" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="truncate text-sm font-semibold">{t.listingTitle}</div>
                    <div className="shrink-0 text-[10px] text-neutral-400">{timeAgo(t.lastMessageAt)}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                    <span className="truncate">{t.otherUserName} · {t.lastMessage || '(photo)'}</span>
                    {t.unread > 0 && <span className="ml-auto inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{t.unread}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {tab === 'jobs' && (
          <div className="space-y-2">
            {jobThreads.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-neutral-500">No job conversations yet.</div>}
            {jobThreads.map((t) => (
              <Link key={`${t.jobId}-${t.otherUserId}`} href={`/?job=${t.jobId}`} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2 hover:bg-neutral-50">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-amber-100 text-amber-800"><Briefcase className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="truncate text-sm font-semibold">{t.listingTitle}</div>
                    <div className="shrink-0 text-[10px] text-neutral-400">{timeAgo(t.lastMessageAt)}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                    <span className="truncate">{t.otherUserName} · {t.lastMessage || '(photo)'}</span>
                    {t.unread > 0 && <span className="ml-auto inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{t.unread}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {tab === 'groups' && (
          <div className="space-y-2">
            {groupUnread.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-neutral-500">No new group chat messages.<br /><Link href="/community/groups" className="mt-2 inline-block text-brand-700 hover:underline">Explore local groups →</Link></div>}
            {groupUnread.map((g) => (
              <GroupChatRow key={g.groupId} groupId={g.groupId} unread={g.unread} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GroupChatRow({ groupId, unread }) {
  const [group, setGroup] = useState(null)
  useEffect(() => {
    api.get(`/api/community/groups/${groupId}`).then((j) => setGroup(j.group))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])
  if (!group) return null
  return (
    <Link href={`/community/groups/${group.slug || group.id}?tab=chat`} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2 hover:bg-neutral-50">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-brand-100 text-brand-800"><Users className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <div className="truncate text-sm font-semibold">{group.name}</div>
          <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">{unread} new</Badge>
        </div>
        <div className="text-[11px] text-neutral-500">Group chat · {group.memberCount || 0} members</div>
      </div>
    </Link>
  )
}
