'use client'

// usePaymentMethodsActions — write/mutation service for the Payment Methods page.
//
// The page + card form inlined the /api mutations (start SetupIntent, persist a
// confirmed card, set default, remove) each with its own fetch, toast, busy
// flag, and post-success reload. That's reusable service logic, not view logic,
// so it lives here; the page just calls the handlers and renders.
//
// Every action routes through the central api client. To keep the page's exact
// behaviour, the original per-action busy flags are preserved (intentBusy for
// "Add a card", rowBusy for set-default / remove) rather than collapsed into one.
// startAdd + saveCard return result objects so the caller can drive the Stripe
// confirm flow and inline error display; makeDefault + remove toast and trigger
// the caller's onMutated() reload themselves.
//
// Usage:
//   const actions = usePaymentMethodsActions({ onMutated: reload })

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { brandLabel } from '@/lib/payment-methods-helpers'

// Pull a human message off an ApiError (the client puts the server's `error`
// field on err.data.error and also on err.message).
function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return fallback
}

export function usePaymentMethodsActions({ onMutated } = {}) {
  const [intentBusy, setIntentBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState(false)

  // Start a SetupIntent on the server. Returns { ok, intent } — the page opens
  // the card form with the returned clientSecret / setupIntentId.
  const startAdd = useCallback(async () => {
    setIntentBusy(true)
    try {
      const j = await api.post('/users/me/payment-methods/setup', {})
      return { ok: true, intent: { clientSecret: j.clientSecret, setupIntentId: j.setupIntentId } }
    } catch (e) {
      toast.error(errMsg(e, 'Failed to start card setup'))
      return { ok: false }
    } finally {
      setIntentBusy(false)
    }
  }, [])

  // Persist a Stripe-confirmed card on our backend. Returns { ok, paymentMethod }
  // or { ok:false, error } so the card form can show the message inline (it does
  // NOT toast the error — the form renders it). Success toast lives here to match
  // the original flow.
  const saveCard = useCallback(async ({ paymentMethodId, setupIntentId }) => {
    try {
      const j = await api.post('/users/me/payment-methods', { paymentMethodId, setupIntentId })
      toast.success('Card saved')
      return { ok: true, paymentMethod: j.paymentMethod }
    } catch (e) {
      return { ok: false, error: errMsg(e, 'Failed to save card') }
    }
  }, [])

  const makeDefault = useCallback(async (pm) => {
    setRowBusy(true)
    try {
      await api.patch(`/users/me/payment-methods/${pm.id}/default`)
      onMutated?.()
      toast.success('Default card updated')
    } catch (e) {
      toast.error(errMsg(e, 'Failed to set default'))
    } finally {
      setRowBusy(false)
    }
  }, [onMutated])

  const remove = useCallback(async (pm) => {
    if (!confirm(`Remove ${brandLabel(pm.brand)} ending •••• ${pm.last4}?`)) return
    setRowBusy(true)
    try {
      await api.del(`/users/me/payment-methods/${pm.id}`)
      onMutated?.()
      toast.success('Card removed')
    } catch (e) {
      toast.error(errMsg(e, 'Failed to remove'))
    } finally {
      setRowBusy(false)
    }
  }, [onMutated])

  return { intentBusy, rowBusy, startAdd, saveCard, makeDefault, remove }
}
