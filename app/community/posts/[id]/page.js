'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Heart, MessageCircle, Share2, MapPin, BadgeCheck, AlertTriangle, Send, Loader2,
  MoreHorizontal, Flag, Bookmark,
} from 'lucide-react'
import FieldFrame from '@/components/field/FieldFrame'
import ReportButton from '@/components/ReportButton'
import { CATEGORY_BY_KEY, REACTION_TYPES, categoryColor, timeAgo } from '@/lib/community-categories'

function authHeaders() {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function CommunityPostDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [reacting, setReacting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedByMe, setSavedByMe] = useState(false)
  const composerRef = useRef(null)

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!t) return
    fetch('/api/auth/me', { headers: authHeaders() }).then((r) => r.ok ? r.json() : null).then((j) => setUser(j?.user || null)).catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/community/posts/${id}`, { headers: authHeaders() })
      if (!r.ok) { setErr((await r.json()).error || 'Not found'); return }
      const j = await r.json()
      setPost(j.post)
      setComments(j.comments || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { if (id) load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [id])

  const submitComment = async () => {
    if (!draft.trim()) return
    if (!user) { toast.error('Sign in to comment'); return }
    setPosting(true)
    try {
      const r = await fetch(`/api/community/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ body: draft.trim() }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Could not comment')
      setDraft('')
      await load()
    } catch (e) { toast.error(e.message || 'Could not comment') } finally { setPosting(false) }
  }

  const react = async (type) => {
    if (!user) { toast.error('Sign in to react'); return }
    if (reacting) return
    setReacting(true)
    try {
      await fetch(`/api/community/posts/${id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ type }),
      })
      await load()
    } catch {} finally { setReacting(false) }
  }

  const startDm = () => {
    if (!user) { toast.error('Sign in to message'); return }
    if (!post?.author?.id) return
    router.push(`/inbox?dm=${post.author.id}`)
  }

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (navigator.share) await navigator.share({ title: post?.title || 'DumpMaps post', url })
      else { await navigator.clipboard.writeText(url); toast.success('Link copied') }
    } catch {}
  }

  const toggleSave = async () => {
    if (!user) { toast.error('Sign in to save'); return }
    if (saving) return
    setSaving(true)
    const wasSaved = savedByMe
    setSavedByMe(!wasSaved)
    try {
      const r = await fetch(`/api/community/posts/${id}/save`, { method: 'POST', headers: authHeaders() })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setSavedByMe(wasSaved)
        toast.error(j.error || 'Could not save')
      } else {
        toast.success(j.saved ? 'Saved' : 'Removed from saved')
      }
    } catch { setSavedByMe(wasSaved); toast.error('Could not save') } finally { setSaving(false) }
  }

  const focusComment = () => composerRef.current?.focus()

  // Back button → Activity Hub (the new feed source-of-truth)
  if (loading) return <FieldFrame title="Post" back="/activity-hub"><div className="py-10 text-center text-sm text-neutral-400">Loading…</div></FieldFrame>
  if (err || !post) return <FieldFrame title="Post" back="/activity-hub"><div className="px-4 py-10 text-center text-sm text-neutral-500">{err || 'Post not found.'}</div></FieldFrame>

  const cat = CATEGORY_BY_KEY?.[post.category]
  const reactionTotal = post.reactionCount || Object.values(post.reactions || {}).reduce((a, b) => a + (b || 0), 0)

  return (
    <FieldFrame
      title={cat?.label || 'Post'}
      back="/activity-hub"
      right={<ReportButton kind="community_post" targetId={post.id} variant="inline" label="" />}
      bodyClassName="!pb-32"
    >
      <article className="space-y-3 p-3">
        <Card>
          <CardContent className="space-y-3 p-3">
            <header className="flex items-start gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                {(post.author?.name || '?')[0].toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-sm font-bold">
                  <span className="truncate">{post.author?.name || 'Someone'}</span>
                  {post.author?.verificationLevel?.startsWith('verified') && <BadgeCheck className="h-3.5 w-3.5 text-brand-600" />}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                  {cat && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{cat.label}</Badge>}
                  {post.urgency === 'high' && <Badge className="bg-red-100 px-1.5 py-0 text-[10px] text-red-800"><AlertTriangle className="mr-0.5 inline h-2.5 w-2.5" />Urgent</Badge>}
                  <span>{timeAgo(post.createdAt)}</span>
                </div>
              </div>
              <button onClick={share} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Share"><Share2 className="h-4 w-4" /></button>
            </header>

            {post.title && <h1 className="text-base font-extrabold leading-snug text-neutral-900">{post.title}</h1>}
            {post.body && <p className="whitespace-pre-wrap text-sm text-neutral-800">{post.body}</p>}

            {(post.location || post.city) && (
              <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                <MapPin className="h-3 w-3" />
                <span>{post.location || [post.city, post.state].filter(Boolean).join(', ')}</span>
              </div>
            )}

            {post.photos?.length > 0 && (
              <div className="-mx-3 grid grid-cols-1 gap-1">
                {post.photos.map((p, i) => (
                  <div key={i} className="aspect-[4/3] w-full bg-neutral-100">
                    <img src={p} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reactions row */}
        <Card>
          <CardContent className="flex items-center justify-around p-1">
            {(REACTION_TYPES || ['like', 'agree', 'helpful']).slice(0, 5).map((r) => {
              const isMine = post.myReaction === (r.key || r)
              return (
                <button key={r.key || r} onClick={() => react(r.key || r)} className={`flex flex-1 flex-col items-center gap-0.5 rounded-md py-2 text-xs ${isMine ? 'bg-brand-50 text-brand-700' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                  <span className="text-base leading-none">{r.emoji || '👍'}</span>
                  <span className="text-[10px] font-semibold">{r.label || (r.key || r)}</span>
                </button>
              )
            })}
          </CardContent>
        </Card>

        {/* Action bar */}
        <div className="flex items-center gap-2">
          {user && post.author?.id && post.author.id !== user.id && (
            <Button onClick={startDm} className="flex-1 bg-brand-600 hover:bg-brand-700"><MessageCircle className="mr-1 h-4 w-4" /> Message author</Button>
          )}
          <Button variant="outline" onClick={focusComment} className="flex-1"><MessageCircle className="mr-1 h-4 w-4" /> Comment</Button>
          <Button
            variant="outline"
            onClick={toggleSave}
            disabled={saving}
            className={savedByMe ? 'border-brand-300 text-brand-700' : ''}
            title={savedByMe ? 'Saved' : 'Save for later'}
          >
            <Bookmark className={`h-4 w-4 ${savedByMe ? 'fill-brand-600 text-brand-600' : ''}`} />
          </Button>
          <Button variant="outline" onClick={share} title="Share"><Share2 className="h-4 w-4" /></Button>
        </div>

        {/* Comments */}
        <div className="space-y-2">
          <div className="px-1 text-xs font-bold uppercase tracking-wide text-neutral-500">Comments ({comments.length})</div>
          {comments.length === 0 && (
            <div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-4 text-center text-xs text-neutral-500">Be the first to comment.</div>
          )}
          {comments.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-start gap-2 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-bold text-white">{(c.author?.name || '?')[0].toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-xs font-bold">
                    <span className="truncate">{c.author?.name || 'Someone'}</span>
                    {c.author?.verificationLevel?.startsWith('verified') && <BadgeCheck className="h-3 w-3 text-brand-600" />}
                    <span className="font-normal text-neutral-400">· {timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-800">{c.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </article>

      {/* Sticky comment composer */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-neutral-200 bg-white/95 p-2 backdrop-blur" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}>
        <div className="flex items-end gap-2">
          <Textarea ref={composerRef} value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} placeholder={user ? 'Add a comment…' : 'Sign in to comment'} disabled={!user} className="min-h-[40px] flex-1 resize-none text-sm" />
          <Button onClick={submitComment} disabled={!user || posting || !draft.trim()} className="h-10 bg-brand-600 hover:bg-brand-700 disabled:opacity-50">
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </FieldFrame>
  )
}
