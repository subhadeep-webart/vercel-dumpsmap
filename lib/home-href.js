// Tiny helper used by anywhere that needs to know "where does Home go?".
// Uses the readable login cookie (client only) and returns the correct
// destination for a logged-in vs logged-out user.
//
// This is safe to call from event handlers (onClick) where we run only after
// hydration. Do NOT use it for href attributes during SSR — you'll get a
// hydration mismatch. Prefer onClick + router.push instead.

import { isLikelyLoggedIn } from '@/lib/api-client'

export function getHomeHref() {
  return isLikelyLoggedIn() ? '/dashboard' : '/'
}
