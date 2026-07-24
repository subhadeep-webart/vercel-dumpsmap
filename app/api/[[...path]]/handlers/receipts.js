// PR-2b: Dump Receipt Center handler
//
// Endpoints (all gated to users with contractor access):
//   POST   /api/receipts                 → create receipt (or upsert)
//   GET    /api/receipts                 → list current user's receipts (paginated, filter by month)
//   GET    /api/receipts/stats           → monthly aggregates (this month + previous month + lifetime totals)
//   GET    /api/receipts/:id             → single receipt
//   PATCH  /api/receipts/:id             → update fields
//   DELETE /api/receipts/:id             → soft delete
//
// MongoDB collection: `dump_receipts`
// Schema:
// {
//   id, userId, facilityId?, facilityName,
//   dateOf (ISO date string YYYY-MM-DD),
//   grossLb, tareLb, netLb (auto = gross - tare),
//   netTons (auto = netLb / 2000),
//   pricePerTon, totalCost (number),
//   paymentMethod ('card'|'cash'|'check'|'account'|'other'),
//   materialType (string label),
//   loadType ('mixed'|'clean'|'cnd'|'green'|'metal'|'other'),
//   photoUrl?, notes?,
//   deleted? (bool), createdAt, updatedAt
// }

const { hasContractorAccess } = require('../../../../lib/contractor-access')
const { classifyReceiptRewards } = require('../../../../lib/receipt-classifier')
const rewardsEngine = require('../../../../lib/rewards')

// ---------------------------------------------------------------------------
// Award rewards points for one or more saved receipts (idempotent).
// Reads the active rewards settings + facility doc, classifies the receipt,
// then writes ledger entries. Failures are swallowed so they never break the
// primary "save receipt" flow.
// ---------------------------------------------------------------------------
async function awardReceiptRewardsSafe(db, receipts) {
  const list = Array.isArray(receipts) ? receipts.filter(Boolean) : []
  if (list.length === 0) return []
  let settings
  try { settings = await rewardsEngine.getRewardsSettings(db) } catch { return [] }
  const pointRules = settings?.pointRules || {}
  const facilityIds = [...new Set(list.map((r) => r.facilityId).filter(Boolean))]
  const facilityDocs = facilityIds.length
    ? await db.collection('facilities').find({ id: { $in: facilityIds } }).toArray().catch(() => [])
    : []
  const facilityMap = Object.fromEntries(facilityDocs.map((f) => [f.id, f]))
  const out = []
  for (const r of list) {
    try {
      const facility = r.facilityId ? facilityMap[r.facilityId] : null
      let isFirst = false
      if (r.facilityId) {
        const prior = await db.collection('dump_receipts').countDocuments({
          userId: r.userId,
          facilityId: r.facilityId,
          id: { $ne: r.id },
          deleted: { $ne: true },
        })
        isFirst = prior === 0
      }
      const awards = classifyReceiptRewards({
        receipt: r,
        facility,
        isFirstReceiptAtFacility: isFirst,
        pointRules,
      })
      for (const a of awards) {
        if (!a.points || a.points <= 0) continue
        const idempotencyKey = `receipt:${r.id}:${a.source}`
        const result = await rewardsEngine.awardPoints(db, {
          userId: r.userId,
          points: a.points,
          source: a.source,
          refType: 'receipt',
          refId: r.id,
          facilityId: r.facilityId || null,
          idempotencyKey,
          meta: a.meta || {},
        })
        out.push({ source: a.source, points: a.points, duplicate: !!result.duplicate })
      }
    } catch (e) {
      // Never block the receipt save on a rewards-engine failure.
      console.warn('[receipts→rewards] award failed', r.id, e?.message || e)
    }
  }
  return out
}

function num(v, def = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

function normalizeReceipt(body) {
  const gross = num(body.grossLb, 0)
  const tare = num(body.tareLb, 0)
  const net = Math.max(0, gross - tare)
  const netTons = net / 2000
  const pricePerTon = num(body.pricePerTon, 0)
  // If a totalCost was supplied use it, otherwise compute net tons × price/ton.
  const totalCost = body.totalCost != null && body.totalCost !== ''
    ? num(body.totalCost, 0)
    : Number((netTons * pricePerTon).toFixed(2))
  const envFee = num(body.environmentalFee, 0)

  return {
    facilityId: body.facilityId || null,
    facilityName: String(body.facilityName || '').trim().slice(0, 120),
    dateOf: String(body.dateOf || new Date().toISOString().slice(0, 10)).slice(0, 10),
    grossLb: gross,
    tareLb: tare,
    netLb: net,
    netTons: Number(netTons.toFixed(4)),
    pricePerTon,
    totalCost,
    paymentMethod: String(body.paymentMethod || 'card').toLowerCase().slice(0, 24),
    materialType: String(body.materialType || '').trim().slice(0, 80),
    loadType: String(body.loadType || 'mixed').toLowerCase().slice(0, 24),
    photoUrl: body.photoUrl ? String(body.photoUrl).slice(0, 600) : null,
    photos: Array.isArray(body.photos) ? body.photos.slice(0, 5).map((p) => String(p).slice(0, 600)) : [],
    notes: body.notes ? String(body.notes).slice(0, 800) : '',
    // Contractor Ops v2 fields
    ticketNumber: body.ticketNumber ? String(body.ticketNumber).trim().slice(0, 60) : '',
    timeIn: body.timeIn ? String(body.timeIn).slice(0, 8) : '', // HH:MM[:SS]
    timeOut: body.timeOut ? String(body.timeOut).slice(0, 8) : '',
    environmentalFee: envFee,
    vehicleId: body.vehicleId ? String(body.vehicleId).slice(0, 80) : null,
    vehicleNumber: body.vehicleNumber ? String(body.vehicleNumber).trim().slice(0, 40) : '',
    jobName: body.jobName ? String(body.jobName).trim().slice(0, 120) : '',
    // OCR scanner additions — optional, persisted as-is when present
    facilityAddress: body.facilityAddress ? String(body.facilityAddress).trim().slice(0, 200) : '',
    facilityCity: body.facilityCity ? String(body.facilityCity).trim().slice(0, 80) : '',
    recyclingPayout: num(body.recyclingPayout, 0),
    weightUnit: body.weightUnit ? String(body.weightUnit).toLowerCase().slice(0, 8) : 'lb',
    ocr: (body.ocr && typeof body.ocr === 'object') ? {
      provider: String(body.ocr.provider || '').slice(0, 60),
      model: String(body.ocr.model || '').slice(0, 80),
      confidence: num(body.ocr.confidence, 0),
      elapsedMs: num(body.ocr.elapsedMs, 0),
      scannedAt: new Date(),
    } : null,
  }
}

function aggregateRange(receipts) {
  let trips = 0
  let totalCost = 0
  let totalNetTons = 0
  let totalNetLb = 0
  for (const r of receipts) {
    trips += 1
    totalCost += num(r.totalCost, 0)
    totalNetTons += num(r.netTons, 0)
    totalNetLb += num(r.netLb, 0)
  }
  const avgCostPerTon = totalNetTons > 0 ? totalCost / totalNetTons : 0
  const avgCostPerTrip = trips > 0 ? totalCost / trips : 0
  return {
    trips,
    totalCost: Number(totalCost.toFixed(2)),
    totalNetTons: Number(totalNetTons.toFixed(3)),
    totalNetLb: Math.round(totalNetLb),
    avgCostPerTon: Number(avgCostPerTon.toFixed(2)),
    avgCostPerTrip: Number(avgCostPerTrip.toFixed(2)),
  }
}

function startOfMonthIso(date) {
  const d = new Date(date)
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function previousMonthRange(now = new Date()) {
  const start = new Date(now)
  start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0)
  start.setUTCMonth(start.getUTCMonth() - 1)
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)
  return { startIso: start.toISOString().slice(0, 10), endIso: end.toISOString().slice(0, 10) }
}

export async function handle(ctx) {
  const { route, method, request, db, getAuth, clean, uuidv4, NextResponse, handleCORS } = ctx
  if (!route.startsWith('/receipts')) return null

  // ALL receipt endpoints require auth + contractor access.
  const auth = getAuth(request)
  if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
  const userRow = await db.collection('users').findOne({ id: auth.id })
  if (!userRow || !hasContractorAccess(userRow)) {
    return handleCORS(NextResponse.json({ error: 'Contractor access required' }, { status: 403 }))
  }

  const col = db.collection('dump_receipts')

  // ---- BATCH CREATE -------------------------------------------------------
  // POST /receipts/batch  Body: { confirm: true, receipts: [...] }
  // Max 10 receipts per batch. confirm=true is required (the "I confirm
  // these records are accurate" checkbox on the client).
  if (route === '/receipts/batch' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const rows = Array.isArray(body.receipts) ? body.receipts : []
    if (!body.confirm) {
      return handleCORS(NextResponse.json({ error: 'Confirmation required ("I confirm these receipt records are accurate")' }, { status: 400 }))
    }
    if (rows.length === 0) {
      return handleCORS(NextResponse.json({ error: 'No receipts in batch' }, { status: 400 }))
    }
    if (rows.length > 10) {
      return handleCORS(NextResponse.json({ error: 'Maximum 10 receipts per batch' }, { status: 400 }))
    }
    const now = new Date()
    const batchId = uuidv4()
    const docs = []
    for (const r of rows) {
      const norm = normalizeReceipt(r)
      if (!norm.facilityName && !norm.facilityId) {
        return handleCORS(NextResponse.json({ error: `Each receipt requires a facilityName or facilityId (problem row index ${docs.length})` }, { status: 400 }))
      }
      if (norm.facilityId && !norm.facilityName) {
        const f = await db.collection('facilities').findOne({ id: norm.facilityId })
        if (f) norm.facilityName = f.name
      }
      docs.push({
        id: uuidv4(),
        userId: auth.id,
        batchId,
        ...norm,
        deleted: false,
        createdAt: now,
        updatedAt: now,
      })
    }
    await col.insertMany(docs)
    const rewardsAwards = await awardReceiptRewardsSafe(db, docs)
    return handleCORS(NextResponse.json({
      batchId,
      count: docs.length,
      receipts: docs.map(clean),
      rewards: { awards: rewardsAwards, totalPoints: rewardsAwards.reduce((s, a) => s + (a.duplicate ? 0 : a.points), 0) },
    }, { status: 201 }))
  }

  // ---- CREATE -------------------------------------------------------------
  if (route === '/receipts' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const norm = normalizeReceipt(body)
    if (!norm.facilityName && !norm.facilityId) {
      return handleCORS(NextResponse.json({ error: 'facilityName or facilityId required' }, { status: 400 }))
    }
    // If facilityId provided but facilityName is empty, look it up
    if (norm.facilityId && !norm.facilityName) {
      const f = await db.collection('facilities').findOne({ id: norm.facilityId })
      if (f) norm.facilityName = f.name
    }
    const doc = {
      id: uuidv4(),
      userId: auth.id,
      ...norm,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await col.insertOne(doc)
    const rewardsAwards = await awardReceiptRewardsSafe(db, [doc])
    return handleCORS(NextResponse.json({
      receipt: clean(doc),
      rewards: { awards: rewardsAwards, totalPoints: rewardsAwards.reduce((s, a) => s + (a.duplicate ? 0 : a.points), 0) },
    }, { status: 201 }))
  }

  // ---- LIST + STATS -------------------------------------------------------
  if (route === '/receipts' && method === 'GET') {
    const url = new URL(request.url)
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))
    const month = url.searchParams.get('month') // 'YYYY-MM' optional
    const q = { userId: auth.id, deleted: { $ne: true } }
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      q.dateOf = { $gte: `${month}-01`, $lt: monthAfter(month) }
    }
    const rows = await col.find(q).sort({ dateOf: -1, createdAt: -1 }).limit(limit).toArray()
    return handleCORS(NextResponse.json({ receipts: rows.map(clean) }))
  }

  if (route === '/receipts/stats' && method === 'GET') {
    const now = new Date()
    const thisMonthStart = startOfMonthIso(now)
    const { startIso: prevStart, endIso: prevEnd } = previousMonthRange(now)
    const baseQ = { userId: auth.id, deleted: { $ne: true } }

    const [thisMonthRows, prevMonthRows, allRows, byFacility, byMaterial, byVehicle, byJob, monthlyTrend] = await Promise.all([
      col.find({ ...baseQ, dateOf: { $gte: thisMonthStart } }).toArray(),
      col.find({ ...baseQ, dateOf: { $gte: prevStart, $lt: prevEnd } }).toArray(),
      col.find(baseQ).toArray(),
      // Top 10 facilities by trip count, with avg $/ton
      col.aggregate([
        { $match: baseQ },
        {
          $group: {
            _id: { facilityId: '$facilityId', facilityName: '$facilityName' },
            trips: { $sum: 1 },
            totalCost: { $sum: '$totalCost' },
            totalNetTons: { $sum: '$netTons' },
          },
        },
        { $sort: { trips: -1 } },
        { $limit: 10 },
      ]).toArray(),
      // Material breakdown (all-time)
      col.aggregate([
        { $match: { ...baseQ, materialType: { $exists: true, $ne: '' } } },
        {
          $group: {
            _id: '$materialType',
            trips: { $sum: 1 },
            totalCost: { $sum: '$totalCost' },
            totalNetTons: { $sum: '$netTons' },
          },
        },
        { $sort: { totalNetTons: -1 } },
      ]).toArray(),
      // Per-vehicle (this month)
      col.aggregate([
        { $match: { ...baseQ, vehicleNumber: { $exists: true, $ne: '' }, dateOf: { $gte: thisMonthStart } } },
        {
          $group: {
            _id: '$vehicleNumber',
            trips: { $sum: 1 },
            totalCost: { $sum: '$totalCost' },
            totalNetTons: { $sum: '$netTons' },
          },
        },
        { $sort: { trips: -1 } },
      ]).toArray(),
      // Per-job (this month)
      col.aggregate([
        { $match: { ...baseQ, jobName: { $exists: true, $ne: '' }, dateOf: { $gte: thisMonthStart } } },
        {
          $group: {
            _id: '$jobName',
            trips: { $sum: 1 },
            totalCost: { $sum: '$totalCost' },
            totalNetTons: { $sum: '$netTons' },
          },
        },
        { $sort: { totalCost: -1 } },
      ]).toArray(),
      // Monthly trend (last 6 months)
      col.aggregate([
        { $match: baseQ },
        {
          $group: {
            _id: { $substr: ['$dateOf', 0, 7] }, // YYYY-MM
            trips: { $sum: 1 },
            totalCost: { $sum: '$totalCost' },
            totalNetTons: { $sum: '$netTons' },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 6 },
      ]).toArray(),
    ])

    // Derive most-used / cheapest / most-expensive facility from byFacility.
    const facilitiesWithAvg = byFacility.map((b) => ({
      facilityId: b._id.facilityId || null,
      facilityName: b._id.facilityName || 'Unknown facility',
      trips: b.trips,
      totalCost: Number((b.totalCost || 0).toFixed(2)),
      totalNetTons: Number((b.totalNetTons || 0).toFixed(3)),
      avgCostPerTon: b.totalNetTons > 0 ? Number(((b.totalCost || 0) / b.totalNetTons).toFixed(2)) : 0,
    }))
    const mostUsedFacility = facilitiesWithAvg[0] || null
    // Cheapest / most expensive — require at least 2 trips at the facility to
    // smooth out one-off spikes.
    const eligible = facilitiesWithAvg.filter((f) => f.trips >= 2 && f.avgCostPerTon > 0)
    const cheapestFacility = eligible.length ? [...eligible].sort((a, b) => a.avgCostPerTon - b.avgCostPerTon)[0] : null
    const mostExpensiveFacility = eligible.length ? [...eligible].sort((a, b) => b.avgCostPerTon - a.avgCostPerTon)[0] : null

    return handleCORS(NextResponse.json({
      thisMonth: aggregateRange(thisMonthRows),
      previousMonth: aggregateRange(prevMonthRows),
      lifetime: aggregateRange(allRows),
      topFacilities: facilitiesWithAvg.slice(0, 5),
      mostUsedFacility,
      cheapestFacility,
      mostExpensiveFacility,
      materialBreakdown: byMaterial.map((m) => ({
        material: m._id || 'unspecified',
        trips: m.trips,
        totalCost: Number((m.totalCost || 0).toFixed(2)),
        totalNetTons: Number((m.totalNetTons || 0).toFixed(3)),
      })),
      vehicleBreakdownThisMonth: byVehicle.map((v) => ({
        vehicleNumber: v._id,
        trips: v.trips,
        totalCost: Number((v.totalCost || 0).toFixed(2)),
        totalNetTons: Number((v.totalNetTons || 0).toFixed(3)),
        avgCostPerTrip: v.trips > 0 ? Number(((v.totalCost || 0) / v.trips).toFixed(2)) : 0,
      })),
      jobBreakdownThisMonth: byJob.map((j) => ({
        jobName: j._id,
        trips: j.trips,
        totalCost: Number((j.totalCost || 0).toFixed(2)),
        totalNetTons: Number((j.totalNetTons || 0).toFixed(3)),
      })),
      monthlyTrend: monthlyTrend.reverse().map((m) => ({
        month: m._id,
        trips: m.trips,
        totalCost: Number((m.totalCost || 0).toFixed(2)),
        totalNetTons: Number((m.totalNetTons || 0).toFixed(3)),
      })),
    }))
  }

  // ---- PER-VEHICLE DASHBOARD ---------------------------------------------
  // GET /receipts/by-vehicle/:vehicleNumber — returns aggregates + recent
  // trips for a single truck so the per-truck dashboard tile can show all
  // its history.
  if (route.startsWith('/receipts/by-vehicle/') && method === 'GET') {
    const vehicleNumber = decodeURIComponent(route.split('/')[3] || '')
    if (!vehicleNumber) return handleCORS(NextResponse.json({ error: 'vehicleNumber required' }, { status: 400 }))
    const q = { userId: auth.id, deleted: { $ne: true }, vehicleNumber }
    const monthStart = startOfMonthIso(new Date())
    const [thisMonthRows, allRows] = await Promise.all([
      col.find({ ...q, dateOf: { $gte: monthStart } }).toArray(),
      col.find(q).sort({ dateOf: -1, createdAt: -1 }).limit(50).toArray(),
    ])
    return handleCORS(NextResponse.json({
      vehicleNumber,
      thisMonth: aggregateRange(thisMonthRows),
      lifetime: aggregateRange(allRows),
      recent: allRows.slice(0, 20).map(clean),
    }))
  }

  // ---- DETAIL / UPDATE / DELETE ------------------------------------------
  if (route.startsWith('/receipts/') && route.split('/').length === 3) {
    const id = route.split('/')[2]
    if (method === 'GET') {
      const row = await col.findOne({ id, userId: auth.id, deleted: { $ne: true } })
      if (!row) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      return handleCORS(NextResponse.json({ receipt: clean(row) }))
    }
    if (method === 'PATCH') {
      const existing = await col.findOne({ id, userId: auth.id, deleted: { $ne: true } })
      if (!existing) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json().catch(() => ({}))
      const merged = { ...existing, ...body }
      // If caller didn't explicitly set totalCost, force re-computation from
      // weights × pricePerTon (otherwise the stale existing.totalCost wins).
      if (!('totalCost' in body)) delete merged.totalCost
      const norm = normalizeReceipt(merged)
      await col.updateOne({ id }, { $set: { ...norm, updatedAt: new Date() } })
      const updated = await col.findOne({ id })
      return handleCORS(NextResponse.json({ receipt: clean(updated) }))
    }
    if (method === 'DELETE') {
      await col.updateOne({ id, userId: auth.id }, { $set: { deleted: true, updatedAt: new Date() } })
      return handleCORS(NextResponse.json({ ok: true }))
    }
  }

  return null
}

function monthAfter(yyyymm) {
  const [y, m] = yyyymm.split('-').map((s) => parseInt(s, 10))
  const next = new Date(Date.UTC(y, m, 1))
  return next.toISOString().slice(0, 10)
}
