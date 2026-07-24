// Shared role → marketplace status workflow.
//
// Used by:
//   • /app/app/marketplace/[id]/page.js   (Seller Quick Actions)
//   • /app/components/marketplace/PostItemDialog.jsx  (status picker on create)
//   • /app/app/api/[[...path]]/route.js   (backend validation in quick-status)
//
// We keep this as a plain JS module (no React, no `import`s) so it can be
// imported by both client and server code without bundling issues.

// Master list of every status DumpMaps supports anywhere in the marketplace.
// The frontend filters this list by the seller's role.
const ALL_STATUSES = [
  'available', 'on_truck', 'at_site', 'last_chance',
  'pending_pickup', 'pickup_scheduled', 'reserved',
  'accepted', 'processed', 'disposed',
  'sold', 'claimed', 'donated', 'recycled',
]

// Per-role allowed statuses. Order is the order shown in the UI.
const ROLE_STATUSES = {
  resident:         ['available', 'reserved', 'sold', 'donated'],
  contractor:       ['available', 'on_truck', 'at_site', 'last_chance', 'claimed', 'sold', 'donated', 'recycled'],
  property_manager: ['available', 'pickup_scheduled', 'reserved', 'claimed', 'donated', 'disposed'],
  facility:         ['available', 'accepted', 'processed', 'recycled'],
}

// Human-friendly metadata used by the Quick Actions buttons.
const STATUS_META = {
  available:        { label: 'Available',        style: 'bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-50' },
  on_truck:         { label: 'On Truck',         style: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  at_site:          { label: 'At Site',          style: 'bg-blue-600 hover:bg-blue-700 text-white' },
  last_chance:      { label: 'Last Chance',      style: 'bg-rose-600 hover:bg-rose-700 text-white' },
  reserved:         { label: 'Reserved',         style: 'bg-amber-500 hover:bg-amber-600 text-white' },
  pickup_scheduled: { label: 'Pickup Scheduled', style: 'bg-blue-500 hover:bg-blue-600 text-white' },
  pending_pickup:   { label: 'Pending Pickup',   style: 'bg-amber-500 hover:bg-amber-600 text-white' },
  accepted:         { label: 'Accepted',         style: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
  processed:        { label: 'Processed',        style: 'bg-purple-500 hover:bg-purple-600 text-white' },
  claimed:          { label: 'Claimed',          style: 'bg-neutral-700 hover:bg-neutral-800 text-white' },
  sold:             { label: 'Sold',             style: 'bg-neutral-800 hover:bg-neutral-900 text-white' },
  donated:          { label: 'Donated',          style: 'bg-purple-600 hover:bg-purple-700 text-white' },
  recycled:         { label: 'Recycled',         style: 'bg-emerald-700 hover:bg-emerald-800 text-white' },
  disposed:         { label: 'Disposed',         style: 'bg-neutral-600 hover:bg-neutral-700 text-white' },
}

// Resolve a `user` object → roleKey + display label.
// Inputs:
//   user.primaryProfile  (preferred, from PROFILE_TYPES: 'hauler'|'recycler'|'donor'|'facility_owner'|'general')
//   user.marketplaceRole (optional explicit override)
//   user.role            (system role: 'user'|'moderator'|'admin'|...)
function resolveMarketplaceRole(user) {
  const raw = String(
    user?.marketplaceRole ||
    user?.primaryProfile ||
    user?.userRole ||
    user?.role ||
    'resident'
  ).toLowerCase()

  // Explicit overrides take precedence
  if (raw === 'resident')         return { key: 'resident',         label: 'Resident' }
  if (raw === 'contractor')       return { key: 'contractor',       label: 'Contractor' }
  if (raw === 'property_manager') return { key: 'property_manager', label: 'Property Manager' }
  if (raw === 'facility')         return { key: 'facility',         label: 'Facility' }

  // Profile-type mapping (from PROFILE_TYPES in app/page.js)
  if (raw === 'hauler' || raw.includes('hauler') || raw.includes('contractor')) {
    return { key: 'contractor', label: 'Contractor' }
  }
  if (raw === 'facility_owner' || raw.includes('facility') || raw.includes('center')) {
    return { key: 'facility', label: 'Facility' }
  }
  if (raw === 'recycler' || raw.includes('recycl')) {
    // Recyclers handle accept/process/recycle flows — same as a facility.
    return { key: 'facility', label: 'Recycler' }
  }
  if (raw === 'donor' || raw.includes('donor') || raw.includes('donat')) {
    // Donors are personal sellers — same workflow as Resident.
    return { key: 'resident', label: 'Donor' }
  }
  if (raw.includes('property') || raw === 'manager' || raw === 'pm') {
    return { key: 'property_manager', label: 'Property Manager' }
  }
  if (raw === 'general' || raw === 'user' || raw === 'nonprofit' || raw.includes('nonprofit')) {
    return { key: 'resident', label: raw === 'nonprofit' ? 'Nonprofit' : 'Resident' }
  }

  // Safe default — most permissive workflow excluded; resident is least-risk.
  return { key: 'resident', label: 'Resident' }
}

// Returns the list of status string keys allowed for this user.
function allowedStatusesForUser(user) {
  const { key } = resolveMarketplaceRole(user)
  return ROLE_STATUSES[key] || ROLE_STATUSES.resident
}

// Returns true if `nextStatus` is in the role's allowed list.
// `currentStatus` is permitted unchanged (so a status set under an old role
// won't block edits — only NEW transitions are restricted).
function isStatusAllowed(user, nextStatus, currentStatus) {
  if (!nextStatus) return false
  if (currentStatus && nextStatus === currentStatus) return true
  const allowed = allowedStatusesForUser(user)
  return allowed.includes(nextStatus)
}

module.exports = {
  ALL_STATUSES,
  ROLE_STATUSES,
  STATUS_META,
  resolveMarketplaceRole,
  allowedStatusesForUser,
  isStatusAllowed,
}
