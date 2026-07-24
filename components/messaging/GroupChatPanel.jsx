'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { timeAgo } from '@/lib/community-categories'
import RoleBadge from '@/components/RoleBadge'
import { api } from '@/lib/api-client'

const POLL_MS = 5000

export default function GroupChatPanel({ groupId, token, currentUser, canPost = true, emptyHint = 'Be the first to say hello.' }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  const load = async () => {
    try {
      const j = await api.get(`/community/groups/${groupId}/chat?limit=120`)
      setMessages(j.messages || [])
      setError(null)
    } catch (err) {
      if (err.status === 403) { setError('Join the group to access chat.'); setMessages([]); return }
      if (err.status) { setError('Could not load chat.'); return }
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!groupId) return
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  // auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages.length])

  const send = async () => {
    const text = body.trim()
    if (!text) return
    if (!token) { toast.error('Log in to chat'); return }
    setSending(true)
    try {
      const j = await api.post(`/community/groups/${groupId}/chat`, { body: text })
      setBody('')
      setMessages((prev) => [...prev, j.message])
    } catch (err) {
      toast.error(err.data?.error || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this message?')) return
    try {
      await api.del(`/community/groups/chat/${id}`)
      setMessages((prev) => prev.filter((m) => m.id !== id))
    } catch {
      toast.error('Could not delete')
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-neutral-500">Loading chat…</div>
  if (error) return <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">{error}</div>

  return (
    <div className="flex h-[60vh] min-h-[400px] flex-col rounded-lg border border-neutral-200 bg-white">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-neutral-500">
            <p className="text-2xl">💬</p>
            <p className="mt-1">{emptyHint}</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.userId === currentUser?.id
          const prev = messages[i - 1]
          const dense = prev && prev.userId === m.userId && (new Date(m.createdAt) - new Date(prev.createdAt) < 60_000)
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
              {!mine && !dense && (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
                  {(m.author?.name || '?')[0].toUpperCase()}
                </span>
              )}
              {!mine && dense && <div className="w-7 shrink-0" />}
              <div className={`max-w-[78%] rounded-2xl px-3 py-1.5 text-sm ${mine ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                {!mine && !dense && (
                  <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold opacity-80">
                    {m.author?.name || 'User'} <RoleBadge user={m.author} />
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`mt-0.5 text-[10px] ${mine ? 'text-brand-100' : 'text-neutral-500'}`}>{timeAgo(m.createdAt)}</div>
                {(mine || ['super_admin', 'admin', 'moderator'].includes(currentUser?.role)) && (
                  <button onClick={() => remove(m.id)} className={`mt-0.5 inline-flex items-center gap-0.5 text-[10px] ${mine ? 'text-brand-100/80 hover:text-white' : 'text-neutral-400 hover:text-red-600'}`}>
                    <Trash2 className="h-2.5 w-2.5" /> delete
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {canPost ? (
        <div className="border-t border-neutral-200 p-2">
          <div className="flex items-end gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              rows={2}
              maxLength={2000}
              placeholder="Type a message… (Enter to send · Shift+Enter for new line)"
              className="min-h-[44px] resize-none"
            />
            <Button onClick={send} disabled={sending || !body.trim()} className="bg-brand-600 hover:bg-brand-700">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-neutral-400">Polls every 5s · Keep it friendly · Group admins can remove messages</p>
        </div>
      ) : (
        <div className="border-t border-neutral-200 p-3 text-center text-xs text-neutral-500">Join the group to participate in chat.</div>
      )}
    </div>
  )
}
