'use client'

// InlineComments — lightweight collapsible comments block rendered inside a
// feed card. Fetches the full post (via /community/posts/:id, which already
// returns author-enriched comments) the first time it's expanded, caches the
// list, and provides a composer for logged-in users. Logged-out taps route
// through requireAuth → SoftLoginModal.

import { useEffect, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { timeAgoShort } from '@/components/activity-hub/primitives'

export default function InlineComments({ postId, user, requireAuth, onCommented }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const j = await api.get(`/community/posts/${postId}`)
        if (!cancelled) setList(Array.isArray(j.comments) ? j.comments : [])
      } catch {
        // Non-fatal: leave the list empty; the composer still works.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [postId])

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!requireAuth('comment')) return
    const value = text.trim()
    if (!value || submitting) return
    setSubmitting(true)
    try {
      const j = await api.post(`/community/posts/${postId}/comments`, { body: value })
      setList((arr) => [...arr, j.comment])
      setText('')
      onCommented?.()
    } catch (err) {
      toast.error(err?.message || 'Could not post comment')
    } finally {
      setSubmitting(false)
    }
  }

  const visible = showAll ? list : list.slice(-3)

  return (
    <div className="mt-4 border-t border-neutral-100 px-1 pt-4">
      {loading ? (
        <div className="flex items-center gap-1 text-xs text-neutral-400"><Loader2 className="h-3 w-3 animate-spin" /> Loading comments…</div>
      ) : list.length === 0 ? (
        <div className="text-xs text-neutral-500">No comments yet — be the first.</div>
      ) : (
        <>
          {!showAll && list.length > 3 && (
            <button onClick={() => setShowAll(true)} className="mb-2 text-[11px] font-bold text-brand-700 hover:underline">
              View all {list.length} comments
            </button>
          )}
          <ul className="space-y-2">
            {visible.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                  {(c.author?.name?.[0] || 'U').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 rounded-lg bg-white px-2.5 py-1.5 text-xs shadow-sm">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate font-bold text-neutral-900">{c.author?.name || 'User'}</span>
                    <span className="text-[10px] text-neutral-400">{timeAgoShort(c.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-neutral-700">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Composer */}
      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => { if (!user) requireAuth('comment') }}
          placeholder={user ? 'Add a comment…' : 'Sign in to comment…'}
          className="flex-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm placeholder:text-neutral-400 focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300"
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
          title="Post comment"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </form>
    </div>
  )
}
