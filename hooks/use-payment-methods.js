'use client'

// usePaymentMethods — all data reads for the Payment Methods page.
//
// The page used to bootstrap with a hand-rolled async chain in a useEffect:
// /auth/me → /stripe/config → /users/me/payment-methods, threading a six-state
// status machine (loading | ready | unauth | locked | stripeMissing | error)
// and its own error string. This hook owns that: the current user comes from the
// shared useCurrentUser hook, and the Stripe config + card list are cached,
// deduped SWR keys that only fire once we know there's a session. A single
// `reload()` revalidates the card list after a mutation.
//
// The six-state status is derived here (not stored) from the SWR loading/error
// state so the page stays presentational. HTTP-status branches (403 → locked,
// 503 → stripeMissing) ride in on the typed ApiError the api client throws.

import { useMemo } from 'react'
import useSWR from 'swr'
import { loadStripe } from '@stripe/stripe-js'
import { api } from '@/lib/api-client'
import { useCurrentUser } from '@/lib/useCurrentUser'

const fetcher = (path) => api.get(path)

// Don't refetch on window focus, and don't retry a failed request in a loop
// (the page renders a terminal error/locked/missing state instead).
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

// loadStripe caches the returned promise per publishable key so we only ever pull
// the Stripe.js bundle once for a given key across re-renders.
const stripeCache = new Map()
function stripeFor(publishableKey) {
  if (!publishableKey) return null
  if (!stripeCache.has(publishableKey)) stripeCache.set(publishableKey, loadStripe(publishableKey))
  return stripeCache.get(publishableKey)
}

export function usePaymentMethods() {
  const { user, isLoggedOut, isLoading: userLoading } = useCurrentUser()

  // Only fetch once we have a confirmed session. Null key = SWR no-ops.
  const authed = !!user
  const cfg = useSWR(authed ? '/stripe/config' : null, fetcher, SWR_OPTS)
  const configured = !!(cfg.data?.configured && cfg.data?.publishableKey)

  // Only fetch the card list once Stripe is known-configured; otherwise the page
  // is already headed for the stripeMissing state.
  const list = useSWR(authed && configured ? '/users/me/payment-methods' : null, fetcher, SWR_OPTS)

  const stripePromise = useMemo(
    () => stripeFor(cfg.data?.publishableKey),
    [cfg.data?.publishableKey],
  )

  // Derive the page's six-state status machine + error message.
  let status = 'loading'
  let errorMsg = ''

  if (isLoggedOut) {
    status = 'unauth'
  } else if (userLoading || cfg.isLoading || (authed && !cfg.data && !cfg.error)) {
    status = 'loading'
  } else if (cfg.error) {
    status = 'error'
    errorMsg = cfg.error?.data?.error || cfg.error?.message || `HTTP ${cfg.error?.status || ''}`
  } else if (!configured) {
    status = 'stripeMissing'
  } else if (list.error) {
    const s = list.error?.status
    if (s === 403) { status = 'locked'; errorMsg = list.error?.data?.error || 'Not allowed' }
    else if (s === 503) { status = 'stripeMissing' }
    else { status = 'error'; errorMsg = list.error?.data?.error || `HTTP ${s || ''}` }
  } else if (list.isLoading || !list.data) {
    status = 'loading'
  } else {
    status = 'ready'
  }

  return {
    user,
    status,
    errorMsg,
    stripeMode: cfg.data?.mode || null,
    stripePromise,
    methods: Array.isArray(list.data?.paymentMethods) ? list.data.paymentMethods : [],
    // Revalidate the card list after a mutation (defaults/removals/adds).
    reload: () => list.mutate(),
    // Let the caller patch the cached list directly (e.g. optimistic append).
    setMethods: (methods) => list.mutate({ paymentMethods: methods }, { revalidate: false }),
  }
}
