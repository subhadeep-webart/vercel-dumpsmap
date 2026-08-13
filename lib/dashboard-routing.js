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
 * Is this account a facility owner — i.e. may it manage facility backend data
 * (pricing, hours, accepted materials, operational status)?
 *
 * Per the client's answers (docs/FACILITY_PORTAL_DEV.md §6 Q1/Q6), the facility
 * backend is role-based and NOT available to all users. Ownership is granted
 * only by admin approval of a facility claim, which writes both fields below
 * (see route.js — the claim-approve handler `$addToSet`s `ownedFacilities` and
 * `profileTypes: 'facility_owner'`). We accept either as the source of truth so
 * a user whose claim predates the profileTypes stamp still resolves correctly.
 *
 * @param {{ ownedFacilities?: string[], profileTypes?: string[], role?: string } | null | undefined} user
 * @returns {boolean}
 */
export function isFacilityOwner(user) {
  if (!user) return false
  if (Array.isArray(user.ownedFacilities) && user.ownedFacilities.length > 0) return true
  if (Array.isArray(user.profileTypes) && user.profileTypes.includes('facility_owner')) return true
  return false
}

/**
 * Staff (admin / super_admin) — they may manage any facility.
 *
 * @param {{ role?: string } | null | undefined} user
 * @returns {boolean}
 */
export function isStaffUser(user) {
  const role = String(user?.role || '').toLowerCase()
  return role === 'admin' || role === 'super_admin'
}

/**
 * May this user edit the given facility's authoritative data? Mirrors the
 * server-side check in route.js so the UI hides exactly what the API rejects.
 *
 * @param {object | null | undefined} user
 * @param {string | null | undefined} facilityId
 * @returns {boolean}
 */
export function canManageFacility(user, facilityId) {
  if (!user || !facilityId) return false
  if (isStaffUser(user)) return true
  return Array.isArray(user.ownedFacilities) && user.ownedFacilities.includes(facilityId)
}

/**
 * Resolve the dashboard route for a user payload (as returned by /api/auth/me).
 * Returns the public fallback when the user is missing, so callers can treat a
 * null user the same as logged-out.
 *
 * Admins get their control panel. Everyone else lands on /profile, which renders
 * the Portal — but the Portal itself is role-aware: facility owners see the
 * facility management console, residents see the resident view (activity, jobs,
 * reporting) plus a "Claim Your Facility" prompt.
 *
 * @param {{ role?: string } | null | undefined} user
 * @returns {string} the path to navigate to
 */
export function resolveDashboardRoute(user) {
  if (!user) return PUBLIC_FALLBACK_ROUTE

  if (isStaffUser(user)) return '/dashboard/admin'
  return '/profile'
}
