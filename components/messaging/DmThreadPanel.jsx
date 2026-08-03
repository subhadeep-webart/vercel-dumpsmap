'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { timeAgo } from '@/lib/community-categories'
import { api } from '@/lib/api-client'

const POLL_MS = 5000

// `token` is accepted for backward compat but unused — the session rides in the
// httpOnly cookie. `loggedIn` (default true) is the login gate; callers that
// know the auth state pass it, others fall back to "assume logged in" since the
// server re-validates every /api call anyway.
export default function DmThreadPanel({ threadId, token, loggedIn = true, currentUser, otherUser, autoFocus = false }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef(null)
  const scrollRef = useRef(null)

  const load = async () => {
    if (!threadId || !loggedIn) return
    try {
      const j = await api.get(`/api/dm/threads/${threadId}/messages`)
      setMessages(j.messages || [])
    } catch {
      return
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!threadId) return
    setLoading(true)
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages.length])

  useEffect(() => { if (autoFocus && inputRef.current) inputRef.current.focus() }, [autoFocus])

  const send = async () => {
    const text = body.trim()
    if (!text || !loggedIn || !threadId) return
    setSending(true)
    try {
      const j = await api.post(`/api/dm/threads/${threadId}/messages`, { body: text })
      setBody('')
      setMessages((prev) => [...prev, j.message])
    } catch (err) {
      toast.error(err.data?.error || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-lg border border-neutral-200 bg-white">
      {otherUser && (
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
            {(otherUser.otherUserName || otherUser.name || '?')[0].toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{otherUser.otherUserName || otherUser.name}</div>
            <div className="text-[10px] text-neutral-500">Direct message</div>
          </div>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {loading && <div className="py-8 text-center text-sm text-neutral-500">Loading messages…</div>}
        {!loading && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-neutral-500">
            <Mail className="h-7 w-7 text-neutral-400" />
            <p className="mt-1">Say hi to {otherUser?.otherUserName || otherUser?.name || 'this user'}.</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.fromUserId === currentUser?.id
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${mine ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`mt-0.5 text-[10px] ${mine ? 'text-blue-100' : 'text-neutral-500'}`}>{timeAgo(m.createdAt)}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="border-t border-neutral-200 p-2">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            rows={2}
            maxLength={2000}
            placeholder={`Message ${otherUser?.otherUserName || otherUser?.name || ''}…`}
            className="min-h-[44px] resize-none"
          />
          <Button onClick={send} disabled={sending || !body.trim()} className="bg-blue-600 hover:bg-blue-700">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-neutral-400">Polls every 5s · Be respectful · Spam will be moderated</p>
      </div>
    </div>
  )
}
