'use client'

// useJobActions — write/mutation service for the Job detail page.
//
// The page inlined two /api mutations (accept, save), each with its own fetch,
// toast, and post-success reload. Those are reusable service logic, not view
// logic, so they live here; the page just calls the handlers and renders.
//
// Every action routes through the central api client and triggers the caller's
// onMutated() refresh (the page passes useJob's reload). A `busy` flag guards
// the Accept button against double-submits. Behaviour mirrors the original page
// exactly — including `save` staying silent on failure.
//
// Usage:
//   const actions = useJobActions(id, { onMutated: reload })
//   await actions.accept()

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'

// Pull a human message off an ApiError (the client puts the server's `error`
// field on err.data.error and also on err.message).
function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return fallback
}

export function useJobActions(id, { onMutated } = {}) {
  const [busy, setBusy] = useState(false)

  const accept = useCallback(async () => {
    setBusy(true)
    try {
      await api.post(`/jobs/${id}/accept`)
      toast.success('Job accepted')
      await onMutated?.()
    } catch (e) {
      toast.error(errMsg(e, 'Could not accept'))
    } finally {
      setBusy(false)
    }
  }, [id, onMutated])

  const save = useCallback(async () => {
    try {
      const j = await api.post(`/jobs/${id}/save`)
      toast.success(j?.saved ? 'Saved' : 'Unsaved')
      onMutated?.()
    } catch {
      // Matches original: save failures are silently ignored.
    }
  }, [id, onMutated])

  return { busy, accept, save }
}
