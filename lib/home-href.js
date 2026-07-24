// Tiny helper used by anywhere that needs to know "where does Home go?".
// Reads dm_token from localStorage (client only) and returns the correct
// destination for a logged-in vs logged-out user.
//
// This is safe to call from event handlers (onClick) where we run only after
// hydration. Do NOT use it for href attributes during SSR — you'll get a
// hydration mismatch. Prefer onClick + router.push instead.

export function getHomeHref() {
  if (typeof window === 'undefined') return '/'
  try {
    const t = localStorage.getItem('dm_token')
    return t ? '/dashboard' : '/'
  } catch {
    return '/'
  }
}
