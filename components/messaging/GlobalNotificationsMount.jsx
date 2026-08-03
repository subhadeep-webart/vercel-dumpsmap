'use client'

import React, { useEffect, useState } from 'react'
import DmNotificationListener from '@/components/messaging/DmNotificationListener'
import { api, isLikelyLoggedIn } from '@/lib/api-client'

/**
 * Mounts the DM notification listener globally so users get toast/push
 * notifications no matter which page they are on (provided they are signed in).
 */
export default function GlobalNotificationsMount() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let alive = true
    const probe = async () => {
      try {
        if (!isLikelyLoggedIn()) { if (alive) setUser(null); return }
        const j = await api.get('/api/auth/me')
        if (alive) setUser(j.user || null)
      } catch {
        if (alive) setUser(null)
      }
    }
    probe()
    // re-probe whenever localStorage changes (login/logout in another tab)
    const onStorage = (e) => { if (e.key === 'dm_token') probe() }
    window.addEventListener('storage', onStorage)
    return () => { alive = false; window.removeEventListener('storage', onStorage) }
  }, [])

  if (!user) return null
  return <DmNotificationListener user={user} />
}
