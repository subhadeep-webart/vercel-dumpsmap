'use client'

// useBetaActions — the single mutation behind the Beta signup page.
//
// The page inlined a raw fetch('/api/beta-signup', …) with hand-built headers,
// its own JSON parse, and toast handling. That's write/service logic, not view
// logic, so it lives here; the page just calls join() and renders. The request
// routes through the central api client (auth + CSRF + JSON handled there), a
// `busy` flag prevents double-submits, and success/error toasts match the
// original copy exactly.
//
// Usage:
//   const { busy, join } = useBetaActions()
//   const ok = await join(form)   // true on success, false otherwise

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'

// Pull a human message off an ApiError (the client puts the server's `error`
// field on err.data.error and also on err.message).
function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return fallback
}

export function useBetaActions() {
  const [busy, setBusy] = useState(false)

  const join = useCallback(async (form) => {
    setBusy(true)
    try {
      await api.post('/beta-signup', form)
      toast.success("You&apos;re on the list! We'll be in touch.")
      return true
    } catch (e) {
      // Preserve the original "Network error" wording for transport failures
      // and surface the server's message otherwise.
      const msg = e instanceof ApiError && e.code === 'network'
        ? 'Network error. Please try again.'
        : errMsg(e, 'Something went wrong')
      toast.error(msg)
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, join }
}
