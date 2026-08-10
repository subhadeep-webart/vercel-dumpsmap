'use client'

// useDonateActions — the Donate page's single mutation: create a donation
// intent / Stripe checkout session.
//
// The page inlined a raw `fetch('/api/donations/intent', { method: 'POST' })`
// with hand-rolled JSON parsing, error handling, and post-response branching
// (redirect to Stripe, warn-and-queue, or fall back to the success page). That
// is service logic, not view logic, so it lives here and routes through the
// central api client. The hook owns the `submitting` flag and the toasts; the
// caller supplies validated form values and an `onQueued(amount)` callback used
// only for the non-Stripe fallback navigation, so routing stays in the page.
//
// Usage:
//   const { submitting, stripeReady, createIntent } = useDonateActions({ onQueued })
//   await createIntent({ email, name, amount, tier, message, recurring })

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'

// Pull a human message off an ApiError (the client puts the server's `error`
// field on err.data.error and also on err.message).
function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return fallback
}

export function useDonateActions({ onQueued } = {}) {
  const [submitting, setSubmitting] = useState(false)
  // Surfaces in the form footer ("Test mode active." vs "finalizing…").
  const [stripeReady, setStripeReady] = useState(false)

  const createIntent = useCallback(async (payload) => {
    setSubmitting(true)
    try {
      const j = await api.post('/donations/intent', payload)
      setStripeReady(!!j.stripeReady)
      const checkoutUrl = j.checkoutUrl || j.intent?.stripeCheckoutUrl
      if (j.stripeReady && checkoutUrl) {
        window.location.href = checkoutUrl
        return
      }
      if (j.stripeError) {
        toast.warning('Secure checkout temporarily unavailable — your support was logged. We will reach out.')
      }
      onQueued?.(payload.amount)
    } catch (err) {
      toast.error(errMsg(err, 'Failed to record donation interest'))
    } finally {
      setSubmitting(false)
    }
  }, [onQueued])

  return { submitting, stripeReady, createIntent }
}
