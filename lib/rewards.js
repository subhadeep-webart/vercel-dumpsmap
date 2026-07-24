// lib/rewards.js
// ----------------------------------------------------------------------------
// DumpMaps P4 — Rewards Engine (Backend Foundation)
//
// This is the canonical points + cashout calculator. It is intentionally pure
// (no Stripe / external calls) — every payout method is admin-processed for v1
// so the engine is operational immediately without third-party dependencies.
//
// Collections (created lazily by handler):
//   • rewards_ledger        — every point award/debit (immutable audit log)
//   • rewards_redemptions   — cashout requests (pending → processing → paid|rejected)
//   • rewards_cashout_methods — saved user payout destinations
//   • rewards_settings      — singleton admin config (rules, fees, conversion)
//   • facility_rewards_config — per-facility participation config
//
// Ledger entry shape:
//   {
//     id, userId, points (int, +earn/-debit), source (string), refType, refId,
//     facilityId, status: 'posted'|'reversed', meta, createdAt, idempotencyKey
//   }
//
// Award sources (default point values — Admin-overridable):
const DEFAULT_POINT_RULES = {
  facility_check_in:        25,
  receipt_verified:         50,
  first_visit_bonus:        100,
  donation_receipt:         75,
  ewaste_receipt:           75,
  transfer_station_receipt: 50,
  partner_facility_bonus:   25,
  community_post:           10,
  illegal_dump_report:      25,
  cleanup_event:            100,
  referral_bonus:           250,
  // Manual admin awards / corrections — no fixed value (provided per call)
  admin_adjustment:         0,
}

const DEFAULT_SETTINGS = {
  conversionRate: 100,          // 100 points = $1.00
  minCashoutPoints: 1000,       // $10 minimum
  pointRules: { ...DEFAULT_POINT_RULES },
  // Fee schedule: pick first matching bracket (inclusive bounds).
  // amount = dollar amount being cashed out before fee.
  feeBrackets: [
    { minUsd: 10,  maxUsd: 19.99, kind: 'flat',    value: 0.5  },
    { minUsd: 20,  maxUsd: 99.99, kind: 'percent', value: 0.03 },
    { minUsd: 100, maxUsd: null,  kind: 'percent', value: 0.02 },
  ],
  // Receipt validation windows allowed in facility config
  validationWindows: ['24h', '72h', '7d', '30d'],
  // Per-user max redemption per calendar month (USD, optional safety guard)
  monthlyRedemptionCapUsd: 500,
  updatedAt: new Date(),
}

const FACILITY_REWARD_TYPES = ['percentage_cashback', 'flat_reward', 'bonus_event']
const FACILITY_REWARD_STATUSES = ['live', 'beta', 'demo', 'paused', 'not_active']
const REDEMPTION_STATUSES = ['pending', 'processing', 'paid', 'rejected', 'cancelled']

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------
async function getRewardsSettings(db) {
  const row = await db.collection('rewards_settings').findOne({ _id: 'singleton' })
  if (!row) return { ...DEFAULT_SETTINGS, _isDefault: true }
  return { ...DEFAULT_SETTINGS, ...row, pointRules: { ...DEFAULT_SETTINGS.pointRules, ...(row.pointRules || {}) } }
}

async function setRewardsSettings(db, patch, byUserId) {
  const existing = await db.collection('rewards_settings').findOne({ _id: 'singleton' })
  const next = {
    ...DEFAULT_SETTINGS,
    ...(existing || {}),
    ...patch,
    pointRules: { ...DEFAULT_SETTINGS.pointRules, ...((existing && existing.pointRules) || {}), ...(patch.pointRules || {}) },
    updatedAt: new Date(),
    updatedBy: byUserId || null,
  }
  await db.collection('rewards_settings').updateOne({ _id: 'singleton' }, { $set: next }, { upsert: true })
  return next
}

// ----------------------------------------------------------------------------
// Point award (idempotent)
// ----------------------------------------------------------------------------
async function awardPoints(db, {
  userId, points, source, refType = null, refId = null, facilityId = null,
  meta = {}, idempotencyKey = null,
}) {
  if (!userId) throw new Error('awardPoints: userId required')
  if (!source) throw new Error('awardPoints: source required')
  const pts = Number(points)
  if (!Number.isFinite(pts) || pts === 0) throw new Error('awardPoints: points must be a non-zero number')

  // Idempotency: skip if same key already used for this user.
  if (idempotencyKey) {
    const existing = await db.collection('rewards_ledger').findOne({ userId, idempotencyKey })
    if (existing) return { entry: existing, duplicate: true }
  }

  const entry = {
    id: cryptoRandomId(),
    userId,
    points: Math.trunc(pts),
    source,
    refType,
    refId,
    facilityId,
    status: 'posted',
    meta: meta || {},
    idempotencyKey: idempotencyKey || null,
    createdAt: new Date(),
  }
  await db.collection('rewards_ledger').insertOne(entry)
  return { entry, duplicate: false }
}

async function getBalance(db, userId) {
  const pipeline = [
    { $match: { userId, status: 'posted' } },
    { $group: {
      _id: null,
      balance: { $sum: '$points' },
      lifetimeEarned: { $sum: { $cond: [{ $gt: ['$points', 0] }, '$points', 0] } },
      lifetimeSpent: { $sum: { $cond: [{ $lt: ['$points', 0] }, '$points', 0] } },
      lastActivityAt: { $max: '$createdAt' },
    } },
  ]
  const [row] = await db.collection('rewards_ledger').aggregate(pipeline).toArray()
  return {
    balance: row?.balance || 0,
    lifetimeEarned: row?.lifetimeEarned || 0,
    lifetimeSpent: Math.abs(row?.lifetimeSpent || 0),
    lastActivityAt: row?.lastActivityAt || null,
  }
}

async function getHistory(db, userId, { limit = 50, before = null } = {}) {
  const q = { userId }
  if (before) q.createdAt = { $lt: new Date(before) }
  const rows = await db.collection('rewards_ledger')
    .find(q).sort({ createdAt: -1 }).limit(Math.min(200, Math.max(1, Number(limit) || 50))).toArray()
  return rows.map(stripMongoId)
}

// ----------------------------------------------------------------------------
// Cashout / Redemption
// ----------------------------------------------------------------------------
function calculateFee(amountUsd, feeBrackets) {
  for (const b of feeBrackets || []) {
    const lo = b.minUsd ?? -Infinity
    const hi = b.maxUsd == null ? Infinity : b.maxUsd
    if (amountUsd >= lo && amountUsd <= hi) {
      if (b.kind === 'flat') return roundCents(b.value)
      if (b.kind === 'percent') return roundCents(amountUsd * b.value)
    }
  }
  return 0
}

function roundCents(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

// Compute redemption preview without creating one.
function previewRedemption(points, settings) {
  const rate = settings.conversionRate || 100
  const grossUsd = roundCents(points / rate)
  const fee = calculateFee(grossUsd, settings.feeBrackets)
  const netUsd = roundCents(Math.max(0, grossUsd - fee))
  return { points: Math.trunc(points), grossUsd, fee, netUsd, conversionRate: rate }
}

async function createRedemption(db, {
  userId, points, cashoutMethodId = null, note = '',
}) {
  const settings = await getRewardsSettings(db)
  const balance = await getBalance(db, userId)
  if (points < settings.minCashoutPoints) {
    const err = new Error(`Minimum cashout is ${settings.minCashoutPoints} points ($${(settings.minCashoutPoints / settings.conversionRate).toFixed(2)})`)
    err.code = 'BELOW_MINIMUM'; throw err
  }
  if (points > balance.balance) {
    const err = new Error('Insufficient balance')
    err.code = 'INSUFFICIENT_BALANCE'; throw err
  }
  const preview = previewRedemption(points, settings)
  // Monthly cap guard
  if (settings.monthlyRedemptionCapUsd) {
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
    const monthRows = await db.collection('rewards_redemptions').find({
      userId,
      createdAt: { $gte: monthStart },
      status: { $in: ['pending', 'processing', 'paid'] },
    }).toArray()
    const usedUsd = monthRows.reduce((s, r) => s + (r.grossUsd || 0), 0)
    if (usedUsd + preview.grossUsd > settings.monthlyRedemptionCapUsd) {
      const err = new Error(`Monthly redemption cap of $${settings.monthlyRedemptionCapUsd.toFixed(2)} reached`)
      err.code = 'MONTHLY_CAP'; throw err
    }
  }
  // Validate cashout method belongs to user (if provided)
  let method = null
  if (cashoutMethodId) {
    method = await db.collection('rewards_cashout_methods').findOne({ id: cashoutMethodId, userId })
    if (!method) {
      const err = new Error('Cashout method not found'); err.code = 'BAD_METHOD'; throw err
    }
  }
  const redemption = {
    id: cryptoRandomId(),
    userId,
    points: preview.points,
    grossUsd: preview.grossUsd,
    fee: preview.fee,
    netUsd: preview.netUsd,
    conversionRate: preview.conversionRate,
    cashoutMethodId: method?.id || null,
    cashoutMethodType: method?.type || 'manual',
    cashoutMethodSummary: method ? summarizeMethod(method) : 'Manual (admin-processed)',
    note: String(note || '').slice(0, 500),
    status: 'pending',
    statusHistory: [{ status: 'pending', at: new Date() }],
    createdAt: new Date(),
  }
  // Write the debit ledger entry + redemption together (in serial — Mongo no txn assumed)
  await db.collection('rewards_redemptions').insertOne(redemption)
  await awardPoints(db, {
    userId,
    points: -preview.points,
    source: 'redemption_hold',
    refType: 'redemption',
    refId: redemption.id,
    idempotencyKey: `redemption:${redemption.id}`,
    meta: { grossUsd: preview.grossUsd, fee: preview.fee, netUsd: preview.netUsd },
  })
  return stripMongoId(redemption)
}

function summarizeMethod(m) {
  if (!m) return 'Unknown'
  if (m.type === 'manual') return 'Manual / Check'
  if (m.type === 'facility_credit') return `Facility credit @ ${m.facilityName || m.facilityId || 'facility'}`
  if (m.type === 'stripe_connect') return `Stripe Connect (${m.last4 || 'acct'})`
  if (m.type === 'gift_card') return `Gift card (${m.email || ''})`
  if (m.type === 'paypal') return `PayPal (${m.email || ''})`
  return m.type
}

async function setRedemptionStatus(db, redemptionId, nextStatus, adminUserId, note = '') {
  if (!REDEMPTION_STATUSES.includes(nextStatus)) {
    const err = new Error(`Invalid status ${nextStatus}`); err.code = 'BAD_STATUS'; throw err
  }
  const r = await db.collection('rewards_redemptions').findOne({ id: redemptionId })
  if (!r) {
    const err = new Error('Redemption not found'); err.code = 'NOT_FOUND'; throw err
  }
  if (r.status === nextStatus) return stripMongoId(r)
  const entry = { status: nextStatus, at: new Date(), by: adminUserId || null, note: note || '' }
  await db.collection('rewards_redemptions').updateOne({ id: redemptionId }, {
    $set: { status: nextStatus, updatedAt: new Date() },
    $push: { statusHistory: entry },
  })
  // If reject/cancel, refund the points hold.
  if (['rejected', 'cancelled'].includes(nextStatus) && ['pending', 'processing'].includes(r.status)) {
    await awardPoints(db, {
      userId: r.userId,
      points: r.points,
      source: 'redemption_refund',
      refType: 'redemption',
      refId: r.id,
      idempotencyKey: `redemption_refund:${r.id}`,
      meta: { reason: nextStatus, note },
    })
  }
  const after = await db.collection('rewards_redemptions').findOne({ id: redemptionId })
  return stripMongoId(after)
}

// ----------------------------------------------------------------------------
// Cashout Methods CRUD
// ----------------------------------------------------------------------------
async function listCashoutMethods(db, userId) {
  const rows = await db.collection('rewards_cashout_methods').find({ userId }).sort({ isDefault: -1, createdAt: -1 }).toArray()
  return rows.map(stripMongoId)
}

async function createCashoutMethod(db, userId, payload) {
  const ALLOWED_TYPES = ['manual', 'facility_credit', 'stripe_connect', 'gift_card', 'paypal']
  const type = String(payload.type || 'manual')
  if (!ALLOWED_TYPES.includes(type)) {
    const err = new Error('Invalid cashout method type'); err.code = 'BAD_TYPE'; throw err
  }
  const row = {
    id: cryptoRandomId(),
    userId,
    type,
    label: payload.label || defaultLabelFor(type),
    // Free-form details (never store raw card data)
    email: payload.email || null,
    facilityId: payload.facilityId || null,
    facilityName: payload.facilityName || null,
    address: payload.address || null,
    notes: payload.notes || '',
    isDefault: !!payload.isDefault,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  if (row.isDefault) {
    await db.collection('rewards_cashout_methods').updateMany({ userId, isDefault: true }, { $set: { isDefault: false, updatedAt: new Date() } })
  }
  await db.collection('rewards_cashout_methods').insertOne(row)
  return stripMongoId(row)
}

function defaultLabelFor(type) {
  const labels = {
    manual: 'Manual / Check (admin-processed)',
    facility_credit: 'Facility credit',
    stripe_connect: 'Bank account (Stripe)',
    gift_card: 'Gift card',
    paypal: 'PayPal',
  }
  return labels[type] || type
}

// ----------------------------------------------------------------------------
// Facility rewards config
// ----------------------------------------------------------------------------
async function getFacilityRewardsConfig(db, facilityId) {
  const row = await db.collection('facility_rewards_config').findOne({ facilityId })
  if (!row) {
    return {
      facilityId,
      participating: false,
      rewardType: null,
      validationWindow: '7d',
      rewardCap: null,
      monthlyBudget: null,
      monthlySpent: 0,
      status: 'not_active',
      _isDefault: true,
    }
  }
  return stripMongoId(row)
}

async function setFacilityRewardsConfig(db, facilityId, patch, byUserId) {
  const existing = await db.collection('facility_rewards_config').findOne({ facilityId })
  const next = {
    facilityId,
    participating: false,
    rewardType: null,
    validationWindow: '7d',
    rewardCap: null,
    monthlyBudget: null,
    monthlySpent: existing?.monthlySpent || 0,
    status: 'not_active',
    ...(existing || {}),
    ...patch,
    facilityId, // ensure not overridden
    updatedAt: new Date(),
    updatedBy: byUserId || null,
  }
  if (!FACILITY_REWARD_STATUSES.includes(next.status)) next.status = 'not_active'
  if (next.rewardType && !FACILITY_REWARD_TYPES.includes(next.rewardType)) next.rewardType = null
  await db.collection('facility_rewards_config').updateOne({ facilityId }, { $set: next }, { upsert: true })
  return next
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function stripMongoId(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return rest
}

function cryptoRandomId() {
  // Compact UUIDv4 — no external dep so this helper stays portable
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'rw_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

module.exports = {
  DEFAULT_POINT_RULES,
  DEFAULT_SETTINGS,
  FACILITY_REWARD_TYPES,
  FACILITY_REWARD_STATUSES,
  REDEMPTION_STATUSES,
  getRewardsSettings,
  setRewardsSettings,
  awardPoints,
  getBalance,
  getHistory,
  calculateFee,
  previewRedemption,
  createRedemption,
  setRedemptionStatus,
  listCashoutMethods,
  createCashoutMethod,
  getFacilityRewardsConfig,
  setFacilityRewardsConfig,
  stripMongoId,
}
