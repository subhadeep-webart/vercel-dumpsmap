'use client'

// useFeatureControlsActions — write/mutation service for the Feature Controls
// admin page.
//
// The page inlined the PATCH /admin/feature-flags/:key mutation with its own
// fetch, toast, and post-success reload. That's reusable service logic, not view
// logic, so it lives here; the page just calls saveFlag() and renders.
//
// The action routes through the central api client, shows a success/error
// toast, and triggers the caller's onMutated() refresh (the page passes
// useFeatureControls's reload). A `busy` flag guards against double-submits.
//
// Usage:
//   const { saveFlag, busy } = useFeatureControlsActions({ onMutated: reload })
//   const ok = await saveFlag(key, patch)

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'

// Pull a human message off an ApiError (the client puts the server's `error`
// field on err.data.error and also on err.message).
function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return fallback
}

export function useFeatureControlsActions({ onMutated } = {}) {
  const [busy, setBusy] = useState(false)

  // Save a flag's config. Returns true on success (so the dialog can close),
  // false otherwise. Reloads the page data on success via onMutated().
  const saveFlag = useCallback(async (key, patch) => {
    setBusy(true)
    try {
      const j = await api.patch(`/admin/feature-flags/${key}`, patch)
      toast.success(`${j.flag.name} updated`)
      onMutated?.()
      return true
    } catch (e) {
      toast.error(errMsg(e, 'Update failed'))
      return false
    } finally {
      setBusy(false)
    }
  }, [onMutated])

  return { busy, saveFlag }
}
