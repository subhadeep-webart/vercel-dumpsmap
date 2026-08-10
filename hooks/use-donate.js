'use client'

// useDonate — read side of the Donate page (app/(app)/donate/page.js).
//
// The page mounted with a fire-and-forget `fetch('/api/platform-settings/public')`
// to "peek" at integration status before delivery finalizes. That raw fetch is
// the only read the page does, so it moves here and goes through the central
// api client (auth/CSRF/timeout handled in one place). We keep it best-effort:
// errors are swallowed via shouldRetryOnError:false and the page never blocks
// on it — the actual Stripe-readiness signal comes back from the donation
// intent response at submit time.

import useSWR from 'swr'
import { api } from '@/lib/api-client'

const fetcher = (path) => api.get(path)

// Best-effort: don't refetch on focus, don't retry on error (the page renders
// fine without this data).
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useDonate() {
  const { data } = useSWR('/platform-settings/public', fetcher, SWR_OPTS)

  return {
    publicSettings: data || null,
  }
}
