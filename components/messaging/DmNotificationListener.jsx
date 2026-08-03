'use client'

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { MessageCircle, Bell, BellOff } from 'lucide-react'
import { api, isLikelyLoggedIn } from '@/lib/api-client'

const POLL_MS = 5000
const STORAGE_KEY = 'dm_notify_perm_asked'
const SOUND_KEY = 'dm_notify_sound_on'

/**
 * Polls /api/dm/threads + /api/inbox/unread-count every 5s.
 * - On new DM/marketplace/job/group-chat unread (count rises), fires:
 *   • a sonner toast with the sender + preview (clickable → /inbox or thread)
 *   • a browser Notification (with user permission, soft-asked once)
 *   • a small "ping" sound (off by default; user-togglable from inbox header)
 * Renders nothing visible.
 */
export default function DmNotificationListener({ user }) {
  const [enabled, setEnabled] = useState(true)
  const seenRef = useRef(null) // Map<threadId, lastMessageAt>
  const inboxRef = useRef({ dm: 0, marketplace: 0, jobs: 0, groups: 0 })
  const initialRef = useRef(true)
  const soundRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    soundRef.current =
      typeof Audio !== 'undefined' ? null : null
  }, [])

  // Soft-ask permission once per device
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'default') return
    const asked = localStorage.getItem(STORAGE_KEY)
    if (asked) return
    // Defer slightly so it doesn't block initial render
    const id = setTimeout(() => {
      try {
        Notification.requestPermission().finally(() => {
          localStorage.setItem(STORAGE_KEY, '1')
        })
      } catch {}
    }, 4000)
    return () => clearTimeout(id)
  }, [user])

  const fire = (titleArg, body, href) => {
    const title = titleArg || 'New message'
    // Toast
    toast(
      <div className="flex items-start gap-2">
        <MessageCircle className="mt-0.5 h-4 w-4 text-blue-500" />
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          {body && <div className="line-clamp-2 text-xs text-neutral-600">{body}</div>}
        </div>
      </div>,
      {
        duration: 6000,
        action: { label: 'Open', onClick: () => (window.location.href = href || '/inbox') },
      },
    )
    // Browser Notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, { body: body || '', tag: href || 'dm', icon: '/favicon.ico', silent: false })
        n.onclick = () => { window.focus(); window.location.href = href || '/inbox' }
        setTimeout(() => n.close(), 7000)
      } catch {}
    }
    // Sound (off by default)
    if (typeof window !== 'undefined') {
      try {
        const soundOn = localStorage.getItem(SOUND_KEY) === '1'
        if (soundOn) {
          const ctx = new (window.AudioContext || window.webkitAudioContext)()
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.connect(g); g.connect(ctx.destination)
          o.frequency.setValueAtTime(720, ctx.currentTime)
          o.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.18)
          g.gain.setValueAtTime(0.0001, ctx.currentTime)
          g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02)
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
          o.start(); o.stop(ctx.currentTime + 0.26)
        }
      } catch {}
    }
  }

  useEffect(() => {
    if (!user) return
    let alive = true
    const tick = async () => {
      if (!enabled || typeof document === 'undefined') return
      // skip notifications when the inbox tab is currently open — they'd be noisy
      const onInbox = window.location.pathname === '/inbox'
      try {
        if (!isLikelyLoggedIn()) return
        // 1) DM threads — granular per-sender notifications
        let j
        try {
          j = await api.get('/dm/threads')
        } catch {
          return
        }
        const map = new Map((j.threads || []).map((t) => [t.threadId, t]))
        if (initialRef.current) {
          // baseline — don't fire on first load
          seenRef.current = new Map(Array.from(map.entries()).map(([k, v]) => [k, v.lastMessageAt]))
        } else if (seenRef.current && !onInbox) {
          for (const [tid, t] of map.entries()) {
            const prevTs = seenRef.current.get(tid)
            const newer = !prevTs || new Date(t.lastMessageAt) > new Date(prevTs)
            const incoming = t.lastSenderId && t.lastSenderId !== user.id
            if (newer && incoming) {
              fire(`${t.otherUserName}`, t.lastMessage, '/inbox')
            }
          }
          seenRef.current = new Map(Array.from(map.entries()).map(([k, v]) => [k, v.lastMessageAt]))
        }

        // 2) Aggregate counts — catches marketplace/jobs/group chats
        const j2 = await api.get('/inbox/unread-count').catch(() => null)
        if (j2) {
          if (!initialRef.current && !onInbox) {
            const prev = inboxRef.current
            if (j2.marketplace > prev.marketplace) fire('New marketplace message', null, '/inbox')
            if (j2.jobs > prev.jobs) fire('New job message', null, '/inbox')
            if (j2.groups > prev.groups) fire('New group chat activity', null, '/inbox')
          }
          inboxRef.current = { dm: j2.dm || 0, marketplace: j2.marketplace || 0, jobs: j2.jobs || 0, groups: j2.groups || 0 }
        }
      } catch {}
      finally {
        if (initialRef.current && alive) initialRef.current = false
      }
    }
    tick()
    const id = setInterval(tick, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [user, enabled])

  // also expose a tiny dev-only API to toggle quickly
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.__dmToggleSound = () => {
      const v = localStorage.getItem(SOUND_KEY) === '1' ? '0' : '1'
      localStorage.setItem(SOUND_KEY, v)
      toast.success(v === '1' ? 'DM sound on' : 'DM sound off', { icon: v === '1' ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" /> })
    }
    window.__dmToggleEnable = () => {
      setEnabled((e) => {
        toast.success(!e ? 'DM notifications on' : 'DM notifications muted', { icon: !e ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" /> })
        return !e
      })
    }
  }, [])

  return null
}
