// recommendations_constants.js
// ---------------------------------------------------------------------------
// Constants for the Recommendations pages — the facility directory
// (app/recommendations/facilities/page.js), the contractor directory
// (app/recommendations/contractors/page.js), and the contractor profile
// (app/recommendations/contractors/[id]/page.js). Extracted so the pages and
// their data hooks share one source of truth for query limits, list caps, the
// verified-badge levels, and the rating-distribution rows.

// Facility directory: how many top-rated facilities to request per query.
export const FACILITY_LIMIT = 60

// Facility directory: how many facility-type filter chips to show (the first N
// entries of FACILITY_TYPE_CONFIG).
export const FACILITY_TYPE_CHIP_LIMIT = 8

// Facility directory: minimum rating a facility must have to appear. Shown in
// the count line and the empty state.
export const FACILITY_MIN_RATING = 3.5

// Contractor directory: how many distinct cities to surface as filter chips.
export const CITY_CHIP_LIMIT = 12

// Card previews: how many accepted-material / service badges to show per card.
export const CARD_BADGE_LIMIT = 4

// Verification levels that earn the blue verified badge on a contractor.
export const VERIFIED_LEVELS = ['verified_contractor', 'verified_facility_owner']

// Star buckets for the review-distribution bars, high to low.
export const RATING_STARS = [5, 4, 3, 2, 1]
