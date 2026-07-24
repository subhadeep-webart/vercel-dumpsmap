// lib/receipt-classifier.js
// ----------------------------------------------------------------------------
// Decides which rewards points to award for a saved receipt and computes the
// breakdown. Returns the list of award decisions (idempotent at the caller
// via `receipt:<id>:<source>` keys).
//
// Inputs:
//   receipt    - normalised receipt doc (must include id, materialType, loadType,
//                facilityId)
//   facility   - facility doc (may be null) - for typeKey + rewardsPartner check
//   isFirstReceiptAtFacility - boolean - already computed by caller
//   pointRules - rewards settings.pointRules object (from getRewardsSettings)
//
// Output: array of { source, points, meta } entries to write.

const EWASTE_HINTS = ['e-waste', 'e waste', 'ewaste', 'electronics']
const DONATION_HINTS = ['donation', 'donate', 'goodwill', 'salvation']
const TRANSFER_FACILITY_TYPES = ['transfer_station', 'transfer-station', 'transferStation']
const EWASTE_FACILITY_TYPES = ['ewaste', 'e_waste', 'electronics_recycler']
const DONATION_FACILITY_TYPES = ['donation_center', 'thrift', 'donation']

function lc(s) { return String(s || '').toLowerCase() }

function matchAny(haystack, needles) {
  const s = lc(haystack)
  return needles.some((n) => s.includes(n))
}

/**
 * Build the list of point awards for a receipt.
 */
function classifyReceiptRewards({ receipt, facility, isFirstReceiptAtFacility, pointRules }) {
  if (!receipt || !pointRules) return []
  const awards = []
  const facilityType = lc(facility?.typeKey || facility?.type || '')
  const materialLc = lc(receipt.materialType)
  const loadLc = lc(receipt.loadType)

  // 1) Primary verified-receipt point (always)
  let primarySource = 'receipt_verified'
  let primaryPoints = pointRules.receipt_verified ?? 50

  // 2) Specialised receipt categories override primary
  const isEwaste =
    matchAny(materialLc, EWASTE_HINTS) ||
    matchAny(loadLc, EWASTE_HINTS) ||
    EWASTE_FACILITY_TYPES.includes(facilityType)
  const isDonation =
    matchAny(materialLc, DONATION_HINTS) ||
    matchAny(loadLc, DONATION_HINTS) ||
    DONATION_FACILITY_TYPES.includes(facilityType)
  const isTransfer = TRANSFER_FACILITY_TYPES.includes(facilityType)

  if (isEwaste) {
    primarySource = 'ewaste_receipt'
    primaryPoints = pointRules.ewaste_receipt ?? 75
  } else if (isDonation) {
    primarySource = 'donation_receipt'
    primaryPoints = pointRules.donation_receipt ?? 75
  } else if (isTransfer) {
    primarySource = 'transfer_station_receipt'
    primaryPoints = pointRules.transfer_station_receipt ?? 50
  }

  awards.push({
    source: primarySource,
    points: primaryPoints,
    meta: { receiptId: receipt.id, materialType: receipt.materialType, loadType: receipt.loadType },
  })

  // 3) Partner facility bonus (if facility is in active rewards program)
  if (facility?.rewardsPartner && ['live', 'beta'].includes(lc(facility.rewardsProgramStatus))) {
    awards.push({
      source: 'partner_facility_bonus',
      points: pointRules.partner_facility_bonus ?? 25,
      meta: { receiptId: receipt.id, facilityId: facility.id },
    })
  }

  // 4) First receipt at this facility for this user → first_visit_bonus
  //    (Only awarded once per user-facility lifetime via idempotency.)
  if (isFirstReceiptAtFacility && receipt.facilityId) {
    awards.push({
      source: 'first_visit_bonus',
      points: pointRules.first_visit_bonus ?? 100,
      meta: { receiptId: receipt.id, facilityId: receipt.facilityId },
    })
  }

  return awards
}

module.exports = {
  classifyReceiptRewards,
}
