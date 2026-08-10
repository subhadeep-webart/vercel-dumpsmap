'use client'

// useBountiesActions — write/mutation service for the Bounties page.
//
// The page inlined four /api mutations (claim, contribute, create bounty, and
// the follow-up state transition to 'funding') each with its own fetch, toast,
// and post-success reload. That's reusable service logic, not view logic, so it
// lives here; the page just calls the handlers and renders.
//
// Every action routes through the central api client, shows a success/error
// toast, and triggers the caller's onMutated() refresh (the page passes
// useBounties' reload). A `busy` flag disables buttons + prevents double-submit
// while a request is in flight.
//
// Usage:
//   const actions = useBountiesActions({ onMutated: reload })
//   await actions.claim(bounty)

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { fmtMoney } from '@/lib/bounties-helpers'

// Pull a human message off an ApiError (the client puts the server's `error`
// field on err.data.error and also on err.message).
function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return fallback
}

export function useBountiesActions({ onMutated } = {}) {
  const [busy, setBusy] = useState(false)

  // Claim a bounty → creates a Work Order assigned to the current user.
  // Confirms first (unchanged copy); the caller is expected to gate on auth
  // before calling. Returns true on success.
  const claim = useCallback(async (bounty) => {
    if (!confirm(`Claim "${bounty.title}"? This creates a Work Order assigned to you.`)) return false
    try {
      await api.post(`/bounties/${bounty.id}/claim`)
      toast.success('Bounty claimed! Work order created.')
      onMutated?.()
      return true
    } catch (e) {
      toast.error(errMsg(e, 'Claim failed'))
      return false
    }
  }, [onMutated])

  // Pledge an amount to a bounty. Numeric validation stays in the dialog;
  // returns true on success so the dialog can close.
  const contribute = useCallback((bountyId, { amountUsd, note }) => {
    setBusy(true)
    return (async () => {
      try {
        await api.post(`/bounties/${bountyId}/contribute`, { amountUsd, note })
        toast.success(`Thanks for contributing ${fmtMoney(amountUsd)}!`)
        return true
      } catch (e) {
        toast.error(errMsg(e, 'Contribution failed'))
        return false
      } finally {
        setBusy(false)
      }
    })()
  }, [])

  // Create a bounty as a draft, then transition it to 'funding' so it shows up
  // publicly. The state PATCH mirrors the original best-effort call (failures
  // are swallowed). Returns true on success.
  const createBounty = useCallback((payload) => {
    setBusy(true)
    return (async () => {
      try {
        const j = await api.post('/bounties', payload)
        // Transition to funding so it shows up publicly (best-effort).
        try {
          await api.patch(`/bounties/${j.bounty.id}/state`, { state: 'funding' })
        } catch { /* non-fatal — bounty is still created as a draft */ }
        toast.success('Bounty posted!')
        return true
      } catch (e) {
        toast.error(errMsg(e, 'Create failed'))
        return false
      } finally {
        setBusy(false)
      }
    })()
  }, [])

  return { busy, claim, contribute, createBounty }
}
