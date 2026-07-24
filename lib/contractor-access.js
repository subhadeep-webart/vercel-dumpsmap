// Shared contractor-tools access policy.
//
// USED BY:
//   • frontend gates  -> /app/components/ContractorToolsGate.jsx
//   • dashboard tiles -> conditionally shown in /dashboard
//   • backend RBAC   -> /api/disposal-intelligence/*, /api/receipts/*
//
// AUTHORIZATION POLICY (a user gets contractor tools if ANY of the below):
//   1. They are staff (admin / moderator / superadmin).
//   2. Their primaryProfile is one of the contractor-leaning profiles
//      (hauler, recycler).
//   3. They have at least one entry in user.contractorRoles[] that intersects
//      the allow-list (contractor, hauler, recycler, junk_removal,
//      dumpster_op, cleanup_crew).
//   4. They are an approved verified contractor
//      (verificationLevel === 'verified_contractor').
//
// PHASE-B SCOPE: this lib is the single source of truth for who sees the
// Disposal Intelligence + Receipt Center. Phase C will build the actual
// receipt-entry forms; until then, /disposal-intelligence and /receipts
// render a 'Coming soon' placeholder for authorized users and an 'Apply
// for Contractor Tools' card for everyone else.

const CONTRACTOR_PROFILE_KEYS = ['hauler', 'recycler']
const CONTRACTOR_ROLE_ALLOW = [
  'contractor',
  'hauler',
  'recycler',
  'junk_removal',
  'dumpster_op',
  'cleanup_crew',
]
const STAFF_ROLES = ['admin', 'moderator', 'superadmin', 'super_admin', 'superAdmin']

function isStaffRole(role) {
  return STAFF_ROLES.includes(String(role || '').toLowerCase())
}

function hasContractorAccess(user) {
  if (!user) return false
  if (isStaffRole(user.role)) return true
  if (user.verificationLevel === 'verified_contractor') return true
  if (user.isVerified && (user.payoutEligible || user.verificationLevel)) return true
  const profile = String(user.primaryProfile || '').toLowerCase()
  if (CONTRACTOR_PROFILE_KEYS.includes(profile)) return true
  const roles = Array.isArray(user.contractorRoles) ? user.contractorRoles.map((r) => String(r).toLowerCase()) : []
  if (roles.some((r) => CONTRACTOR_ROLE_ALLOW.includes(r))) return true
  return false
}

function contractorAccessReason(user) {
  if (!user) return 'not_signed_in'
  if (isStaffRole(user.role)) return 'staff'
  if (user.verificationLevel === 'verified_contractor') return 'verified_contractor'
  const profile = String(user.primaryProfile || '').toLowerCase()
  if (CONTRACTOR_PROFILE_KEYS.includes(profile)) return `profile:${profile}`
  const roles = Array.isArray(user.contractorRoles) ? user.contractorRoles.map((r) => String(r).toLowerCase()) : []
  const match = roles.find((r) => CONTRACTOR_ROLE_ALLOW.includes(r))
  if (match) return `contractor_role:${match}`
  return 'unauthorized'
}

module.exports = {
  CONTRACTOR_PROFILE_KEYS,
  CONTRACTOR_ROLE_ALLOW,
  STAFF_ROLES,
  isStaffRole,
  hasContractorAccess,
  contractorAccessReason,
}
