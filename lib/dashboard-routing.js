// Dashboard routing — pure role → route resolution.
//
// The /dashboard entrypoint used to inline this branching inside a useEffect,
// which mixed navigation policy with fetch/lifecycle plumbing and made the
// component hard to read. Keeping it here as a pure function means the
// "which dashboard does this user belong to?" decision is testable in
// isolation and reusable anywhere (guards, redirects, tests) without pulling
// in React or the router.

// Where a logged-out / unknown user goes.
export const PUBLIC_FALLBACK_ROUTE = '/activity-hub'

/**
 * Resolve the dashboard route for a user payload (as returned by /api/auth/me).
 * Returns the public fallback when the user is missing, so callers can treat a
 * null user the same as logged-out.
 *
 * Per the client mockup, the Facility Portal at /profile IS the dashboard for
 * every non-admin account (resident, contractor, facility owner) — a single
 * unified console. Admins keep their control panel.
 *
 * @param {{ role?: string } | null | undefined} user
 * @returns {string} the path to navigate to
 */
export function resolveDashboardRoute(user) {
  if (!user) return PUBLIC_FALLBACK_ROUTE

  const role = String(user.role || '').toLowerCase()
  if (role === 'super_admin' || role === 'admin') return '/dashboard/admin'
  return '/profile'
}
