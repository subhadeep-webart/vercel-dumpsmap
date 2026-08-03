// Dashboard routing — pure role → route resolution.
//
// The /dashboard entrypoint used to inline this branching inside a useEffect,
// which mixed navigation policy with fetch/lifecycle plumbing and made the
// component hard to read. Keeping it here as a pure function means the
// "which dashboard does this user belong to?" decision is testable in
// isolation and reusable anywhere (guards, redirects, tests) without pulling
// in React or the router.

// profileType values that map to the Facility Owner dashboard.
const FACILITY_PROFILE_TYPES = [
  'facility_owner',
  'facility',
  'transfer_station',
  'recycler',
  'donation_center',
]

// profileType values that map to the Contractor dashboard.
const CONTRACTOR_PROFILE_TYPES = ['contractor', 'verified_contractor']

// Where a logged-out / unknown user goes.
export const PUBLIC_FALLBACK_ROUTE = '/activity-hub'

/**
 * Resolve the role-specific dashboard route for a user payload
 * (as returned by /api/auth/me). Returns the public fallback when the
 * user is missing, so callers can treat a null user the same as logged-out.
 *
 * @param {{ role?: string, profileType?: string, verifiedContractor?: boolean } | null | undefined} user
 * @returns {string} the path to navigate to
 */
export function resolveDashboardRoute(user) {
  if (!user) return PUBLIC_FALLBACK_ROUTE

  const role = String(user.role || '').toLowerCase()
  const profileType = String(user.profileType || '').toLowerCase()

  if (role === 'super_admin' || role === 'admin') return '/dashboard/admin'
  if (CONTRACTOR_PROFILE_TYPES.includes(profileType) || user.verifiedContractor) return '/dashboard/contractor'
  if (FACILITY_PROFILE_TYPES.includes(profileType)) return '/dashboard/facility'
  return '/dashboard/resident'
}
