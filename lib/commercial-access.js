// Commercial B2B Marketplace access policy.
//
// USED BY:
//   • backend RBAC  -> /api/marketplace/commercial/*, /api/commercial-access/*
//   • frontend gates -> /app/marketplace (Commercial B2B tab)
//   • admin queue    -> /admin/commercial-access
//
// FINAL SPEC (as confirmed by product):
//
//   ROLES
//     commercialRoles[] is a NEW, parallel array. It does NOT extend
//     contractorRoles[]. Allowed values:
//       - vendor
//       - facility_owner
//       - property_manager
//     (`contractor` and `recycler` are NOT in commercialRoles — those
//      sellers get access automatically from their existing contractor
//      identity, see HYBRID AUTO-APPROVE below.)
//
//   HYBRID AUTO-APPROVE
//     hasCommercialAccess(user) returns TRUE when ANY of the following:
//       1. Staff (admin / moderator / superadmin)
//       2. user.verificationLevel ∈ AUTO_APPROVE_VERIFICATION
//       3. user.contractorRoles[] intersects AUTO_APPROVE_CONTRACTOR_ROLES
//       4. user.commercialMembership ∈ ('verified', 'pro', 'enterprise')
//       5. user.commercialAccessStatus === 'approved'
//
//     Anyone else who applies gets their application queued in
//     commercial_access_applications with status: 'pending', for manual
//     admin review at /admin/commercial-access.
//
//   MEMBERSHIP TIERS (future-ready, not enforced for billing today)
//       free       — view/search only (effectively the default for non-approved)
//       verified   — full B2B posting/messaging/offer/reserve/sold
//       pro        — verified + premium analytics/placement (future)
//       enterprise — pro + dedicated account features (future)

const COMMERCIAL_ROLES = ['vendor', 'facility_owner', 'property_manager']

// Seller types displayed on listing cards. Includes contractor/recycler
// (which come from contractorRoles[]) AND the three commercial-only roles.
const COMMERCIAL_SELLER_TYPES = [
  'contractor',
  'vendor',
  'facility_owner',
  'property_manager',
  'recycler',
]

const AUTO_APPROVE_VERIFICATION = [
  'verified_contractor',
  'verified_recycler',
  'verified_facility',
]

const AUTO_APPROVE_CONTRACTOR_ROLES = ['contractor', 'hauler', 'recycler']

const COMMERCIAL_MEMBERSHIP_TIERS = ['free', 'verified_commercial', 'pro_commercial', 'enterprise']

// Memberships that grant commercial access (anything other than 'free').
// Legacy 'verified' and 'pro' values are also accepted for backward compatibility
// during the membership-naming migration (Admin User Management V2).
const COMMERCIAL_ACCESS_MEMBERSHIPS = ['verified_commercial', 'pro_commercial', 'enterprise', 'verified', 'pro']

// B2B listing categories (six canonical buckets, ordered for the UI).
const B2B_CATEGORIES = [
  { key: 'equipment',            label: 'Equipment',            description: 'Heavy machinery, tools, attachments, rentals' },
  { key: 'materials',            label: 'Materials',            description: 'Aggregates, lumber, metals, fill, salvage' },
  { key: 'vehicles',             label: 'Vehicles',             description: 'Trucks, trailers, dumpsters, fleet, parts' },
  { key: 'commercial_inventory', label: 'Commercial Inventory', description: 'Office, retail, restaurant, hotel FF&E' },
  { key: 'services',             label: 'Services',             description: 'Demolition, hauling, recycling, B2B services' },
  { key: 'wholesale_liquidation', label: 'Wholesale / Liquidation', description: 'Bulk lots, pallets, distressed inventory' },
]

const B2B_CATEGORY_KEYS = B2B_CATEGORIES.map((c) => c.key)

const STAFF_ROLES = ['admin', 'moderator', 'superadmin', 'super_admin', 'superAdmin']

function isStaffRole(role) {
  return STAFF_ROLES.includes(String(role || '').toLowerCase())
}

function asLower(arr) {
  return Array.isArray(arr) ? arr.map((r) => String(r || '').toLowerCase()) : []
}

function hasCommercialAccess(user) {
  if (!user) return false
  if (isStaffRole(user.role)) return true
  if (user.commercialAccessStatus === 'suspended') return false
  if (user.commercialAccessStatus === 'approved') return true
  const membership = String(user.commercialMembership || '').toLowerCase()
  if (COMMERCIAL_ACCESS_MEMBERSHIPS.includes(membership)) return true
  // Trial users get full commercial access until the trial expires.
  if (user.commercialTrialEndsAt && new Date(user.commercialTrialEndsAt) > new Date()) return true
  if (AUTO_APPROVE_VERIFICATION.includes(String(user.verificationLevel || '').toLowerCase())) return true
  const contractorRoles = asLower(user.contractorRoles)
  if (contractorRoles.some((r) => AUTO_APPROVE_CONTRACTOR_ROLES.includes(r))) return true
  const commercialRoles = asLower(user.commercialRoles)
  if (commercialRoles.length > 0 && user.commercialAccessStatus !== 'pending') {
    // commercialRoles present means user has been explicitly granted those roles.
    return true
  }
  return false
}

function commercialAccessReason(user) {
  if (!user) return 'not_signed_in'
  if (isStaffRole(user.role)) return 'staff'
  if (user.commercialAccessStatus === 'suspended') return 'suspended'
  if (user.commercialAccessStatus === 'approved') return 'admin_approved'
  const membership = String(user.commercialMembership || '').toLowerCase()
  if (['verified', 'pro', 'enterprise'].includes(membership)) return `membership:${membership}`
  const vl = String(user.verificationLevel || '').toLowerCase()
  if (AUTO_APPROVE_VERIFICATION.includes(vl)) return `verification:${vl}`
  const contractorRoles = asLower(user.contractorRoles)
  const cMatch = contractorRoles.find((r) => AUTO_APPROVE_CONTRACTOR_ROLES.includes(r))
  if (cMatch) return `contractor_role:${cMatch}`
  const commercialRoles = asLower(user.commercialRoles)
  if (commercialRoles.length > 0 && user.commercialAccessStatus !== 'pending') {
    return `commercial_role:${commercialRoles[0]}`
  }
  if (user.commercialAccessStatus === 'pending') return 'pending_review'
  if (user.commercialAccessStatus === 'denied') return 'denied'
  return 'unauthorized'
}

// Auto-approval decision for a freshly-submitted application.
// Returns 'approved' | 'pending' (or 'denied' if explicitly blocked).
function decideApplicationStatus(user) {
  if (!user) return 'pending'
  if (isStaffRole(user.role)) return 'approved'
  if (AUTO_APPROVE_VERIFICATION.includes(String(user.verificationLevel || '').toLowerCase())) return 'approved'
  const contractorRoles = asLower(user.contractorRoles)
  if (contractorRoles.some((r) => AUTO_APPROVE_CONTRACTOR_ROLES.includes(r))) return 'approved'
  return 'pending'
}

function normalizeCommercialRole(input) {
  const v = String(input || '').toLowerCase().trim()
  return COMMERCIAL_ROLES.includes(v) ? v : null
}

function normalizeSellerType(input) {
  const v = String(input || '').toLowerCase().trim()
  return COMMERCIAL_SELLER_TYPES.includes(v) ? v : null
}

function normalizeB2BCategory(input) {
  const v = String(input || '').toLowerCase().trim()
  return B2B_CATEGORY_KEYS.includes(v) ? v : null
}

module.exports = {
  COMMERCIAL_ROLES,
  COMMERCIAL_SELLER_TYPES,
  COMMERCIAL_MEMBERSHIP_TIERS,
  AUTO_APPROVE_VERIFICATION,
  AUTO_APPROVE_CONTRACTOR_ROLES,
  B2B_CATEGORIES,
  B2B_CATEGORY_KEYS,
  STAFF_ROLES,
  isStaffRole,
  hasCommercialAccess,
  commercialAccessReason,
  decideApplicationStatus,
  normalizeCommercialRole,
  normalizeSellerType,
  normalizeB2BCategory,
}
