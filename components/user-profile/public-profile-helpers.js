// Shared small helpers/constants for the public profile components.

// Human labels for the 10 profileType enum values (see authProfile.js).
export const PROFILE_TYPE_LABEL = {
  resident: 'Resident',
  contractor: 'Contractor',
  facility: 'Facility',
  recycler: 'Recycler',
  donation_center: 'Donation Center',
  vendor: 'Vendor',
  property_manager: 'Property Manager',
  government: 'Government',
  enterprise: 'Enterprise',
  super_admin: 'Admin',
}

// Compact "$1,200" / "Free" / "—" price formatter for listing cards.
export function formatPrice(price) {
  if (price === 0) return 'Free'
  if (typeof price !== 'number' || !Number.isFinite(price)) return null
  return `$${price.toLocaleString()}`
}
