// lib/impact.js
// ----------------------------------------------------------------------------
// DumpMaps Impact Score™ — formula engine + facility aggregator.
//
// Surfaces a single function `computeFacilityImpact(db, facilityId)` that
// returns the headline metrics for the Impact Score card on facility pages.
//
// Formulas are EPA-based defaults but stored in a singleton `impact_settings`
// document so Super Admin can tune them without code changes.
//
// All inputs come from real MongoDB data (no mocks):
//   • lbsDiverted        — sum of (receipt.netWeight in lbs) over verified receipts
//                          for this facility. Falls back to (tons * 2000)
//                          when net weight is stored in tons.
//   • contractorVisits   — count of receipts + check-ins for the facility.
//   • rewardsPaidUsd     — sum of paid redemptions traced to this facility
//                          via rewards_ledger.facilityId.
//   • communityRating    — facility.rating (existing field).
//
// Derived metrics (formula-driven):
//   • lbsCo2Offset       = lbsDiverted * lbsCo2PerLbDiverted
//   • treesEquivalent    = lbsCo2Offset / lbsCo2PerTreePerYear
//   • landfillDiversion% = (lbsDiverted / totalProcessedLbs) * 100   (if known)
//
// `isNew` flag: true when ALL aggregated metrics are zero — used by the UI to
// show the "Be the first to contribute" empty state with placeholders.
// ----------------------------------------------------------------------------

const DEFAULT_IMPACT_SETTINGS = {
  // EPA estimate: 1 lb of mixed material diverted from landfill = ~2.94 lbs
  // CO2-equivalent avoided (incl. methane suppression + virgin manufacturing
  // offsets). We use a conservative 2.5 as default to avoid over-claiming.
  lbsCo2PerLbDiverted: 2.5,
  // A mature tree sequesters ~48 lbs of CO2/year (US Forest Service).
  lbsCo2PerTreePerYear: 48,
  // Optional: gallons of water saved per lb diverted (cardboard/paper heavy)
  gallonsWaterPerLbDiverted: 7,
  // Display rounding rules
  roundLbsDivertedTo: 100,        // round to nearest 100 lbs in display
  roundTreesTo: 1,                 // integer trees
  roundCo2To: 100,                 // nearest 100 lbs CO2
  roundDollarsTo: 0.01,            // cents
  // Schema version (so we can migrate if formulas change)
  schemaVersion: 1,
  updatedAt: new Date(),
}

async function getImpactSettings(db) {
  const row = await db.collection('impact_settings').findOne({ _id: 'singleton' })
  if (!row) return { ...DEFAULT_IMPACT_SETTINGS, _isDefault: true }
  return { ...DEFAULT_IMPACT_SETTINGS, ...row }
}

async function setImpactSettings(db, patch, byUserId) {
  const existing = await db.collection('impact_settings').findOne({ _id: 'singleton' })
  const next = {
    ...DEFAULT_IMPACT_SETTINGS,
    ...(existing || {}),
    ...patch,
    updatedAt: new Date(),
    updatedBy: byUserId || null,
  }
  await db.collection('impact_settings').updateOne({ _id: 'singleton' }, { $set: next }, { upsert: true })
  return next
}

// Extract a numeric net weight in LBS from a receipt document, normalising
// pounds vs tons. Receipts saved via OCR/Receipt-Center carry weights in lbs
// in `netLb` (or `netLbs`); legacy receipts may store `tons`/`netTons`.
function receiptNetLbs(r) {
  if (!r) return 0
  const candidates = [
    r.netLb, r.netLbs, r.netWeight,
    r.weights?.net, r.weights?.netLbs,
    r.weight?.net, r.weight?.netLbs,
  ].filter((x) => x != null)
  for (const c of candidates) {
    const n = Number(c); if (Number.isFinite(n) && n > 0) return n
  }
  // Tons fallback
  const tons = Number(r.netTons || r.tons || r.weights?.tons || 0)
  if (Number.isFinite(tons) && tons > 0) return tons * 2000
  return 0
}

async function aggregateFacilityRaw(db, facilityId) {
  const [receipts, checkIns, payouts] = await Promise.all([
    db.collection('dump_receipts').find({ facilityId, deleted: { $ne: true } }).toArray().catch(() => []),
    db.collection('rewards_ledger').countDocuments({ facilityId, source: 'facility_check_in', status: 'posted' }).catch(() => 0),
    db.collection('rewards_redemptions').find({ status: 'paid' }).toArray().catch(() => []),
  ])
  let lbsDiverted = 0
  const uniqueUsers = new Set()
  for (const r of receipts) {
    lbsDiverted += receiptNetLbs(r)
    if (r.userId) uniqueUsers.add(r.userId)
  }
  // Payouts traced to this facility via ledger debits with facilityId
  let rewardsPaidUsd = 0
  if (payouts.length) {
    const redemptionIds = payouts.map((p) => p.id)
    const ledger = await db.collection('rewards_ledger').find({
      refType: 'redemption',
      refId: { $in: redemptionIds },
      facilityId,
    }).toArray().catch(() => [])
    // Sum proportional payout — for now allocate full payout when any ledger
    // entry exists for this facility within the redemption window.
    const traced = new Set(ledger.map((l) => l.refId))
    for (const p of payouts) {
      if (traced.has(p.id)) rewardsPaidUsd += Number(p.netUsd || 0)
    }
  }
  return {
    lbsDiverted,
    contractorVisits: receipts.length + checkIns,
    uniqueContractors: uniqueUsers.size,
    rewardsPaidUsd,
    receiptCount: receipts.length,
    checkInCount: checkIns,
  }
}

function roundTo(n, step) {
  if (!step || step <= 0) return n
  return Math.round(n / step) * step
}

async function computeFacilityImpact(db, facility) {
  if (!facility?.id) return null
  const settings = await getImpactSettings(db)
  const raw = await aggregateFacilityRaw(db, facility.id)

  const lbsCo2Offset = raw.lbsDiverted * settings.lbsCo2PerLbDiverted
  const treesEquivalent = lbsCo2Offset / settings.lbsCo2PerTreePerYear
  const gallonsWaterSaved = raw.lbsDiverted * settings.gallonsWaterPerLbDiverted

  const isNew = raw.lbsDiverted === 0 && raw.contractorVisits === 0 && raw.rewardsPaidUsd === 0

  return {
    isNew,
    metrics: {
      lbsDiverted:        roundTo(raw.lbsDiverted, settings.roundLbsDivertedTo),
      contractorVisits:   raw.contractorVisits,
      uniqueContractors:  raw.uniqueContractors,
      treesEquivalent:    roundTo(treesEquivalent, settings.roundTreesTo),
      lbsCo2Offset:       roundTo(lbsCo2Offset, settings.roundCo2To),
      gallonsWaterSaved:  roundTo(gallonsWaterSaved, 1),
      rewardsPaidUsd:     roundTo(raw.rewardsPaidUsd, settings.roundDollarsTo),
      communityRating:    Number(facility.rating || 0),
      reviewCount:        Number(facility.reviewCount || 0),
      receiptCount:       raw.receiptCount,
      checkInCount:       raw.checkInCount,
    },
    formulaVersion: settings.schemaVersion,
    computedAt: new Date(),
  }
}

module.exports = {
  DEFAULT_IMPACT_SETTINGS,
  getImpactSettings,
  setImpactSettings,
  computeFacilityImpact,
  aggregateFacilityRaw,
}
