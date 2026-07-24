// handlers/rewardsEngine.js
// ----------------------------------------------------------------------------
// P4 Rewards Engine \u2014 backend foundation endpoints.
//
//   Public:
//     GET    /api/facilities/:id/rewards-program     \u2014 facility's rewards config (public)
//     GET    /api/facilities/:id/impact              \u2014 DumpMaps Impact Score
//
//   User (auth required):
//     GET    /api/users/me/rewards/balance           \u2014 balance + lifetime totals
//     GET    /api/users/me/rewards/history           \u2014 paginated ledger
//     GET    /api/users/me/rewards/redemptions       \u2014 list user's redemptions
//     POST   /api/users/me/rewards/redeem            \u2014 create a cashout request
//     POST   /api/users/me/rewards/redeem/preview    \u2014 calculate fee preview
//     POST   /api/users/me/rewards/cancel/:id        \u2014 cancel own pending redemption
//     GET    /api/users/me/cashout-methods           \u2014 list methods
//     POST   /api/users/me/cashout-methods           \u2014 add method
//     PATCH  /api/users/me/cashout-methods/:id       \u2014 update method
//     DELETE /api/users/me/cashout-methods/:id       \u2014 remove method
//     POST   /api/facilities/:id/check-in            \u2014 earn check-in points
//
//   Admin (super_admin):
//     GET/PATCH /api/admin/rewards/settings          \u2014 conversion / fees / point rules
//     GET/PATCH /api/admin/impact/settings           \u2014 impact formula tuning
//     PATCH     /api/admin/facilities/:id/rewards-config \u2014 toggle participation
//     GET       /api/admin/rewards/redemptions       \u2014 admin queue
//     PATCH     /api/admin/rewards/redemptions/:id   \u2014 approve/process/reject
//     POST      /api/admin/rewards/award             \u2014 manual point adjustment

const rewards = require('../../../../lib/rewards')
const impact = require('../../../../lib/impact')
const { canAccessFeature, isSuperAdmin, isStaff } = require('../../../../lib/feature-control')

function isStaffRole(role) {
  return ['admin', 'super_admin', 'superadmin', 'moderator'].includes(String(role || '').toLowerCase())
}

async function loadUser(db, request, getAuth) {
  const auth = getAuth(request); if (!auth) return null
  return await db.collection('users').findOne({ id: auth.id })
}

async function requireAuth(ctx) {
  const u = await loadUser(ctx.db, ctx.request, ctx.getAuth)
  if (!u) return { user: null, err: ctx.handleCORS(ctx.NextResponse.json({ error: 'Auth required' }, { status: 401 })) }
  return { user: u, err: null }
}

async function requireSuperAdmin(ctx) {
  const { user, err } = await requireAuth(ctx); if (err) return { user: null, err }
  if (!isSuperAdmin(user.role)) {
    return { user: null, err: ctx.handleCORS(ctx.NextResponse.json({ error: 'Super admin required' }, { status: 403 })) }
  }
  return { user, err: null }
}

// Gate user access to rewards engine via feature flag
async function gateRewardsEngine(ctx, user) {
  const flag = await ctx.db.collection('feature_flags').findOne({ key: 'rewardsEngine' })
  const grant = await ctx.db.collection('feature_grants').findOne({ key: 'rewardsEngine', scope: 'user', scopeId: user.id })
  const access = canAccessFeature(user, 'rewardsEngine', {}, flag, grant)
  if (!access.allowed) {
    return ctx.handleCORS(ctx.NextResponse.json({
      error: 'Rewards engine not available for this account',
      reason: access.reason,
      lockedState: access.lockedState,
    }, { status: 403 }))
  }
  return null
}

export async function handle(ctx) {
  const { route, method, request, db, NextResponse, handleCORS } = ctx

  // --------------------------------------------------------------------------
  // Public: facility impact + rewards program
  // --------------------------------------------------------------------------
  if (method === 'GET' && /^\/facilities\/[^/]+\/impact$/.test(route)) {
    const id = route.split('/')[2]
    const facility = await db.collection('facilities').findOne({ id })
    if (!facility) return handleCORS(NextResponse.json({ error: 'Facility not found' }, { status: 404 }))
    const result = await impact.computeFacilityImpact(db, facility)
    return handleCORS(NextResponse.json({ facilityId: id, ...result }))
  }

  if (method === 'GET' && /^\/facilities\/[^/]+\/rewards-program$/.test(route)) {
    const id = route.split('/')[2]
    const cfg = await rewards.getFacilityRewardsConfig(db, id)
    return handleCORS(NextResponse.json({ rewardsConfig: cfg }))
  }

  // --------------------------------------------------------------------------
  // User-facing rewards endpoints
  // --------------------------------------------------------------------------
  if (route === '/users/me/rewards/balance' && method === 'GET') {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const balance = await rewards.getBalance(db, user.id)
    return handleCORS(NextResponse.json({ ...balance, dollarsAvailable: balance.balance / 100 }))
  }

  if (route === '/users/me/rewards/history' && method === 'GET') {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') || 50)
    const before = url.searchParams.get('before') || null
    const rows = await rewards.getHistory(db, user.id, { limit, before })
    return handleCORS(NextResponse.json({ entries: rows }))
  }

  if (route === '/users/me/rewards/redemptions' && method === 'GET') {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const rows = await db.collection('rewards_redemptions').find({ userId: user.id }).sort({ createdAt: -1 }).limit(100).toArray()
    return handleCORS(NextResponse.json({ redemptions: rows.map(rewards.stripMongoId) }))
  }

  if (route === '/users/me/rewards/redeem/preview' && method === 'POST') {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const gateErr = await gateRewardsEngine(ctx, user); if (gateErr) return gateErr
    const body = await request.json().catch(() => ({}))
    const points = Math.trunc(Number(body.points) || 0)
    if (points <= 0) return handleCORS(NextResponse.json({ error: 'points must be a positive integer' }, { status: 400 }))
    const settings = await rewards.getRewardsSettings(db)
    return handleCORS(NextResponse.json({
      preview: rewards.previewRedemption(points, settings),
      minCashoutPoints: settings.minCashoutPoints,
    }))
  }

  if (route === '/users/me/rewards/redeem' && method === 'POST') {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const gateErr = await gateRewardsEngine(ctx, user); if (gateErr) return gateErr
    const body = await request.json().catch(() => ({}))
    try {
      const r = await rewards.createRedemption(db, {
        userId: user.id,
        points: Math.trunc(Number(body.points) || 0),
        cashoutMethodId: body.cashoutMethodId || null,
        note: body.note || '',
      })
      return handleCORS(NextResponse.json({ redemption: r }))
    } catch (e) {
      return handleCORS(NextResponse.json({ error: e.message, code: e.code || 'REDEEM_FAILED' }, { status: 400 }))
    }
  }

  if (method === 'POST' && /^\/users\/me\/rewards\/cancel\/[^/]+$/.test(route)) {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const redemptionId = route.split('/').pop()
    const r = await db.collection('rewards_redemptions').findOne({ id: redemptionId, userId: user.id })
    if (!r) return handleCORS(NextResponse.json({ error: 'Redemption not found' }, { status: 404 }))
    if (!['pending'].includes(r.status)) {
      return handleCORS(NextResponse.json({ error: `Cannot cancel redemption in status ${r.status}` }, { status: 400 }))
    }
    try {
      const updated = await rewards.setRedemptionStatus(db, redemptionId, 'cancelled', user.id, 'user_cancelled')
      return handleCORS(NextResponse.json({ redemption: updated }))
    } catch (e) {
      return handleCORS(NextResponse.json({ error: e.message }, { status: 400 }))
    }
  }

  // ----- Cashout methods CRUD -----
  if (route === '/users/me/cashout-methods' && method === 'GET') {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const list = await rewards.listCashoutMethods(db, user.id)
    return handleCORS(NextResponse.json({ methods: list }))
  }
  if (route === '/users/me/cashout-methods' && method === 'POST') {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const body = await request.json().catch(() => ({}))
    try {
      const m = await rewards.createCashoutMethod(db, user.id, body)
      return handleCORS(NextResponse.json({ method: m }))
    } catch (e) {
      return handleCORS(NextResponse.json({ error: e.message, code: e.code || 'BAD_REQUEST' }, { status: 400 }))
    }
  }
  if (method === 'PATCH' && /^\/users\/me\/cashout-methods\/[^/]+$/.test(route)) {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const mid = route.split('/').pop()
    const body = await request.json().catch(() => ({}))
    const m = await db.collection('rewards_cashout_methods').findOne({ id: mid, userId: user.id })
    if (!m) return handleCORS(NextResponse.json({ error: 'Method not found' }, { status: 404 }))
    const patch = { updatedAt: new Date() }
    const FIELDS = ['label', 'email', 'facilityId', 'facilityName', 'address', 'notes', 'status', 'isDefault']
    for (const k of FIELDS) if (body[k] !== undefined) patch[k] = body[k]
    if (patch.isDefault === true) {
      await db.collection('rewards_cashout_methods').updateMany({ userId: user.id, isDefault: true }, { $set: { isDefault: false, updatedAt: new Date() } })
    }
    await db.collection('rewards_cashout_methods').updateOne({ id: mid, userId: user.id }, { $set: patch })
    const updated = await db.collection('rewards_cashout_methods').findOne({ id: mid, userId: user.id })
    return handleCORS(NextResponse.json({ method: rewards.stripMongoId(updated) }))
  }
  if (method === 'DELETE' && /^\/users\/me\/cashout-methods\/[^/]+$/.test(route)) {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const mid = route.split('/').pop()
    await db.collection('rewards_cashout_methods').deleteOne({ id: mid, userId: user.id })
    return handleCORS(NextResponse.json({ ok: true }))
  }

  // ----- Facility check-in -----
  if (method === 'POST' && /^\/facilities\/[^/]+\/check-in$/.test(route)) {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const gateErr = await gateRewardsEngine(ctx, user); if (gateErr) return gateErr
    const facilityId = route.split('/')[2]
    const facility = await db.collection('facilities').findOne({ id: facilityId })
    if (!facility) return handleCORS(NextResponse.json({ error: 'Facility not found' }, { status: 404 }))
    const cfg = await rewards.getFacilityRewardsConfig(db, facilityId)
    if (!cfg.participating || !['live', 'beta'].includes(cfg.status)) {
      return handleCORS(NextResponse.json({ error: 'This facility is not participating in rewards', cfg }, { status: 400 }))
    }
    const settings = await rewards.getRewardsSettings(db)
    const rules = settings.pointRules || {}
    // First-visit detection
    const prior = await db.collection('rewards_ledger').findOne({ userId: user.id, facilityId, source: 'facility_check_in' })
    const isFirst = !prior
    const checkInPts = rules.facility_check_in ?? 25
    const firstPts = isFirst ? (rules.first_visit_bonus ?? 100) : 0
    const partnerPts = rules.partner_facility_bonus ?? 25
    const total = checkInPts + firstPts + partnerPts
    const idempotencyKey = `check_in:${user.id}:${facilityId}:${new Date().toISOString().slice(0, 10)}`
    const existing = await db.collection('rewards_ledger').findOne({ userId: user.id, idempotencyKey })
    if (existing) {
      return handleCORS(NextResponse.json({ error: 'Already checked in today', awarded: 0, idempotencyKey }, { status: 409 }))
    }
    const result = await rewards.awardPoints(db, {
      userId: user.id,
      points: total,
      source: 'facility_check_in',
      refType: 'facility',
      refId: facilityId,
      facilityId,
      idempotencyKey,
      meta: { breakdown: { check_in: checkInPts, first_visit_bonus: firstPts, partner_facility_bonus: partnerPts } },
    })
    return handleCORS(NextResponse.json({
      awarded: total,
      breakdown: { check_in: checkInPts, first_visit_bonus: firstPts, partner_facility_bonus: partnerPts },
      isFirstVisit: isFirst,
      ledgerEntry: rewards.stripMongoId(result.entry),
    }))
  }

  // --------------------------------------------------------------------------
  // Admin: rewards settings
  // --------------------------------------------------------------------------
  if (route === '/admin/rewards/settings') {
    const { user, err } = await requireSuperAdmin(ctx); if (err) return err
    if (method === 'GET') {
      const s = await rewards.getRewardsSettings(db)
      return handleCORS(NextResponse.json({ settings: s }))
    }
    if (method === 'PATCH') {
      const body = await request.json().catch(() => ({}))
      const s = await rewards.setRewardsSettings(db, body, user.id)
      return handleCORS(NextResponse.json({ settings: s }))
    }
  }

  // Admin: impact settings
  if (route === '/admin/impact/settings') {
    const { user, err } = await requireSuperAdmin(ctx); if (err) return err
    if (method === 'GET') {
      const s = await impact.getImpactSettings(db)
      return handleCORS(NextResponse.json({ settings: s }))
    }
    if (method === 'PATCH') {
      const body = await request.json().catch(() => ({}))
      const s = await impact.setImpactSettings(db, body, user.id)
      return handleCORS(NextResponse.json({ settings: s }))
    }
  }

  // Admin: facility rewards config
  if (method === 'PATCH' && /^\/admin\/facilities\/[^/]+\/rewards-config$/.test(route)) {
    const { user, err } = await requireSuperAdmin(ctx); if (err) return err
    const fid = route.split('/')[3]
    const body = await request.json().catch(() => ({}))
    const cfg = await rewards.setFacilityRewardsConfig(db, fid, body, user.id)
    // Also reflect summary boolean on facility doc for quick UI lookups
    await db.collection('facilities').updateOne({ id: fid }, { $set: {
      rewardsPartner: !!(cfg.participating && ['live', 'beta'].includes(cfg.status)),
      rewardsProgramStatus: cfg.status,
      updatedAt: new Date(),
    } })
    return handleCORS(NextResponse.json({ rewardsConfig: cfg }))
  }

  // Admin: redemption queue
  if (route === '/admin/rewards/redemptions' && method === 'GET') {
    const { user, err } = await requireSuperAdmin(ctx); if (err) return err
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const q = status ? { status } : {}
    const rows = await db.collection('rewards_redemptions').find(q).sort({ createdAt: -1 }).limit(200).toArray()
    // Enrich with user info
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))]
    const users = await db.collection('users').find({ id: { $in: userIds } }).toArray()
    const userMap = Object.fromEntries(users.map((u) => [u.id, { id: u.id, name: u.name, email: u.email }]))
    return handleCORS(NextResponse.json({
      redemptions: rows.map((r) => ({ ...rewards.stripMongoId(r), user: userMap[r.userId] || null })),
    }))
  }

  if (method === 'PATCH' && /^\/admin\/rewards\/redemptions\/[^/]+$/.test(route)) {
    const { user, err } = await requireSuperAdmin(ctx); if (err) return err
    const rid = route.split('/').pop()
    const body = await request.json().catch(() => ({}))
    const status = String(body.status || '').trim()
    if (!status) return handleCORS(NextResponse.json({ error: 'status required' }, { status: 400 }))
    try {
      const r = await rewards.setRedemptionStatus(db, rid, status, user.id, body.note || '')
      return handleCORS(NextResponse.json({ redemption: r }))
    } catch (e) {
      return handleCORS(NextResponse.json({ error: e.message }, { status: 400 }))
    }
  }

  // Admin: manual award (for testing or corrections)
  if (route === '/admin/rewards/award' && method === 'POST') {
    const { user, err } = await requireSuperAdmin(ctx); if (err) return err
    const body = await request.json().catch(() => ({}))
    if (!body.userId || !Number.isFinite(Number(body.points))) {
      return handleCORS(NextResponse.json({ error: 'userId and numeric points required' }, { status: 400 }))
    }
    const result = await rewards.awardPoints(db, {
      userId: body.userId,
      points: Math.trunc(Number(body.points)),
      source: body.source || 'admin_adjustment',
      refType: 'admin',
      refId: user.id,
      facilityId: body.facilityId || null,
      meta: { note: body.note || '', awardedBy: user.id },
    })
    return handleCORS(NextResponse.json({ entry: rewards.stripMongoId(result.entry), duplicate: result.duplicate }))
  }

  return null
}
