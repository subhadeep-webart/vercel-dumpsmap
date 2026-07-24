// nav-helpers.js
// ---------------------------------------------------------------------------
// Pure, reusable helpers for header/nav components (AppHeader, SiteHeader,
// MobileBottomNav, …). Kept free of React so they can be unit-tested and shared
// without pulling in component state.

/**
 * First name to greet a user by. Falls back to the local-part of the email,
 * then to an empty string. e.g. { name: 'Ada Lovelace' } -> 'Ada'
 */
export function getFirstName(user) {
  return (user?.name || user?.email?.split('@')[0] || '').split(' ')[0]
}

/**
 * Single-letter avatar initial for a user, upper-cased. Falls back to 'U'.
 * e.g. { email: 'ada@x.io' } -> 'A'
 */
export function getInitial(user) {
  return (user?.name || user?.email || '?')[0]?.toUpperCase() || 'U'
}

/**
 * Resolve whether a nav key is the active one for a given pathname.
 *
 * If `active` is a known nav key (explicit override from a page), it wins.
 * Otherwise — including when a page passes an `active` for a section that isn't
 * in the top nav, e.g. "donate"/"rewards"/"jobs" — we fall back to inferring the
 * section from the pathname. Keeping this table in one place means every nav
 * surface highlights consistently.
 *
 * @param {string} key       the nav item's key (e.g. 'facilities')
 * @param {string} pathname  current pathname
 * @param {string} [active]  explicit active key override
 */
const NAV_KEYS = ['feed', 'community', 'facilities', 'marketplace', 'business', 'about']

export function isNavActive(key, pathname, active) {
  if (active && NAV_KEYS.includes(active)) return active === key
  const p = pathname || ''
  switch (key) {
    case 'feed':        return p === '/' || p === '/dashboard' || p.startsWith('/activity-hub')
    case 'community':   return p.startsWith('/community')
    case 'facilities':  return p.startsWith('/facilities')
    case 'marketplace': return p.startsWith('/marketplace')
    case 'business':    return p.startsWith('/business')
    case 'about':       return p.startsWith('/about')
    default:            return false
  }
}
