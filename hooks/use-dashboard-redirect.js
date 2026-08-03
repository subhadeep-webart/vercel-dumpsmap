'use client'

// useDashboardRedirect — the /dashboard entrypoint's only job.
//
// The entrypoint page has no UI of its own; it looks up who the caller is and
// forwards them to the right role dashboard. That work — read token, fetch
// /api/auth/me through the central api client, decide the destination, and
// navigate — used to live inline in the page's useEffect. Pulling it into a
// hook keeps the page a thin shell (just render the loading skeleton) and puts
// the async lifecycle (cancel-on-unmount guard, error fallback) in one place.
//
// The role → route decision itself is a pure function (lib/dashboard-routing)
// so this hook only owns the side effects: fetching and navigating.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api, isLikelyLoggedIn } from '@/lib/api-client'
import { resolveDashboardRoute, PUBLIC_FALLBACK_ROUTE } from '@/lib/dashboard-routing'

export function useDashboardRedirect() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      // No session → straight to the public hub, no need to hit the API.
      if (!isLikelyLoggedIn()) {
        router.replace(PUBLIC_FALLBACK_ROUTE)
        return
      }
      try {
        const { user } = await api.get('/api/auth/me')
        if (cancelled) return
        router.replace(resolveDashboardRoute(user))
      } catch {
        // Bad/expired token or a network error — fall back to the public hub
        // rather than stranding the user on a blank entrypoint.
        if (!cancelled) router.replace(PUBLIC_FALLBACK_ROUTE)
      }
    }

    run()
    return () => { cancelled = true }
  }, [router])
}
