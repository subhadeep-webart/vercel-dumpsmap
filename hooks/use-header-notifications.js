// use-header-notifications
// ---------------------------------------------------------------------------
// Feeds the header's bell icon: the unread-activity summary shown in the
// notification panel, plus the total badge count.
//
// There is no dedicated notifications collection yet — the unified
// /api/inbox/unread-count endpoint is the single source of truth for "what's
// new" (DMs, marketplace, jobs, group chats). This hook turns those raw counts
// into display-ready rows so the panel component stays presentational. When a
// real notifications feed lands, only this hook has to change.

import { useCallback, useEffect, useState } from 'react'
import { api, isLikelyLoggedIn } from '@/lib/api-client'
import { NOTIFICATION_SOURCES } from '@/constants/layout_constants'

// Matches the poll cadence used by the inbox page and DmNotificationListener.
const POLL_MS = 30000

const EMPTY_COUNTS = { count: 0, dm: 0, marketplace: 0, jobs: 0, groups: 0 }

export function useHeaderNotifications(enabled = true) {
  const [counts, setCounts] = useState(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!enabled || !isLikelyLoggedIn()) { setLoading(false); return }
    try {
      const j = await api.get('/inbox/unread-count')
      setCounts({ ...EMPTY_COUNTS, ...(j || {}) })
    } catch {
      // Offline or signed out mid-poll — keep the last good counts.
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [enabled, load])

  // Only surface sources that actually have something unread, so the panel
  // reads as a list of events rather than a table of zeroes.
  const items = NOTIFICATION_SOURCES
    .map((s) => ({ ...s, count: counts[s.key] || 0 }))
    .filter((s) => s.count > 0)

  return { counts, items, total: counts.count || 0, loading, refresh: load }
}
