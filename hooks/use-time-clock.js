'use client'

// useTimeClock — all data reads for the Time Clock page.
//
// The page component used to inline a five-way Promise.all against the
// time-clock endpoints (current, entries, summary, settings) plus /auth/me, its
// own loading flag, and a 1s interval that re-rendered the running clock. This
// hook owns that: each endpoint is a cached, deduped SWR key, so tab switches
// and re-mounts don't re-fetch, and a single `reload()` revalidates everything
// after a mutation.
//
// All requests go through the central api client (lib/api-client), so the auth
// token, headers, JSON parsing, and timeout are handled in one place. The
// signed-in user comes from the shared useCurrentUser hook rather than a bespoke
// /auth/me fetch.

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api-client'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { ENTRIES_LIMIT } from '@/constants/time_clock_constants'
import {
  isManagerUser, openBreakOf, elapsedSecondsOf,
} from '@/lib/time-clock-helpers'

const fetcher = (path) => api.get(path)

// SWR options shared by every read here: don't hammer the API on window focus,
// and don't retry a failed request in a loop (the page shows an empty state).
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useTimeClock() {
  const { user } = useCurrentUser()

  const current = useSWR('/time-clock/current', fetcher, SWR_OPTS)
  const entries = useSWR(`/time-clock/entries?limit=${ENTRIES_LIMIT}`, fetcher, SWR_OPTS)
  const summary = useSWR('/time-clock/summary', fetcher, SWR_OPTS)
  const settings = useSWR('/time-clock/settings', fetcher, SWR_OPTS)

  // Live tick — drives the running clock on the active-timer card. One interval
  // for the whole page; the elapsed value is derived, not stored.
  const [now, setNow] = useState(() => 0)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const active = current.data?.entry || null
  const loading =
    current.isLoading || entries.isLoading || summary.isLoading || settings.isLoading

  // Revalidate every read at once — call after any mutation.
  const reload = () => {
    current.mutate()
    entries.mutate()
    summary.mutate()
    settings.mutate()
  }

  return {
    user,
    isManager: isManagerUser(user),
    active,
    entries: entries.data?.entries || [],
    summary: summary.data || null,
    settings: settings.data?.settings || null,
    loading,
    // Derived live state for the active-timer card.
    openBreak: openBreakOf(active),
    elapsedSeconds: elapsedSecondsOf(active, now || Date.now()),
    reload,
    // Expose settings.mutate so SettingsView can patch the cache after a save
    // without a full reload.
    setSettings: (s) => settings.mutate({ settings: s }, { revalidate: false }),
  }
}
