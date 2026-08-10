'use client'

// useRewardsActions — write/mutation service for the Rewards page's redeem
// dialog.
//
// The RedeemDialog inlined four /api calls: on open it loaded the user's
// cashout methods and a redemption preview; it could POST a new cashout method;
// and it POSTed the redemption itself. That's reusable service logic, not view
// logic, so it lives here — the dialog just calls these and renders.
//
// Every call routes through the central api client (auth + CSRF + JSON handled
// there). Mutations show a success/error toast and, on redeem success, trigger
// the caller's onMutated() refresh (the page passes useRewards' reload). A
// single `busy` flag guards the confirm button against double-submits.

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'

// Pull a human message off an ApiError (the client puts the server's `error`
// field on err.data.error and also on err.message).
function errMsg(e, fallback) {
  return e instanceof ApiError ? (e.data?.error || e.message || fallback) : fallback
}

export function useRewardsActions({ onMutated } = {}) {
  const [busy, setBusy] = useState(false)

  // Load the dialog's initial data for a tier: the user's saved cashout methods
  // and the redemption preview for the tier's point cost. Returns
  // { methods, preview } — matching the original inline effect, which tolerated
  // failures by falling back to empty/null.
  const loadDialogData = useCallback(async (tier) => {
    let methods = []
    let preview = null
    try {
      const j = await api.get('/users/me/cashout-methods')
      methods = j?.methods || []
    } catch {
      methods = []
    }
    try {
      const pj = await api.post('/users/me/rewards/redeem/preview', { points: tier.points })
      preview = pj?.preview || null
    } catch {
      preview = null
    }
    return { methods, preview }
  }, [])

  // Add a new cashout method. Returns the created method on success, or null on
  // failure (after toasting). Label validation stays in the dialog.
  const addMethod = useCallback(async (newMethod) => {
    try {
      const j = await api.post('/users/me/cashout-methods', newMethod)
      return j?.method || null
    } catch (e) {
      toast.error(errMsg(e, 'Failed'))
      return null
    }
  }, [])

  // Submit a redemption for the given tier + cashout method. Returns true on
  // success (after toasting the payout amount and firing onMutated), false
  // otherwise.
  const redeem = useCallback(async (tier, methodId) => {
    setBusy(true)
    try {
      const j = await api.post('/users/me/rewards/redeem', {
        points: tier.points,
        cashoutMethodId: methodId,
      })
      toast.success(`Redemption submitted! $${(j.redemption.netCashCents / 100).toFixed(2)} will be paid out.`)
      onMutated?.()
      return true
    } catch (e) {
      toast.error(errMsg(e, 'Redemption failed'))
      return false
    } finally {
      setBusy(false)
    }
  }, [onMutated])

  return { busy, loadDialogData, addMethod, redeem }
}
