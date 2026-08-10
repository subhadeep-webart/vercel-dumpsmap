// receipt_scanner_constants.js
// ---------------------------------------------------------------------------
// Constants for the AI Receipt Scanner page (app/receipt-scanner/page.js) and
// its hooks/helpers. Hoisted here so the select option lists, the review-flow
// stages, and the reward-source label map live in one place instead of being
// re-created inline on every render.

// Feature flag key that gates the whole page (beta rollout).
export const FEATURE_KEY = 'ocrReceiptScanner'

// Where to send the user when they aren't authenticated.
export const LOGIN_REDIRECT = '/?login=1&returnTo=/receipt-scanner'

// Material <select> options. Leading '' renders as the "— none —" placeholder.
export const MATERIALS = [
  '', 'MSW', 'C&D', 'Green Waste', 'Mixed', 'Metal', 'Cardboard', 'E-waste', 'Yard Waste', 'Other',
]

// Load-type <select> values (rendered upper-cased in the label).
export const LOADS = ['mixed', 'clean', 'cnd', 'green', 'metal', 'other']

// Payment-method <select> values (rendered title-cased in the label).
export const PAY_METHODS = ['card', 'cash', 'check', 'account', 'other']

// Human-readable labels for reward source identifiers, used in the "DumpMaps
// Rewards" breakdown on the done screen. Unknown sources fall back to a
// prettified version of the raw key (see humanizeSource in the helpers).
export const REWARD_SOURCE_LABELS = {
  receipt_verified: 'Verified receipt',
  ewaste_receipt: 'E-Waste receipt',
  donation_receipt: 'Donation receipt',
  transfer_station_receipt: 'Transfer station receipt',
  partner_facility_bonus: 'Partner facility bonus',
  first_visit_bonus: 'First visit bonus',
  facility_check_in: 'Facility check-in',
}
