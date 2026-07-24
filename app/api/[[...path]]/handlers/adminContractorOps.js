// PR-2c: Admin views for contractor ops (Receipt records + Vehicle Inspections).
//
// Endpoints (staff/admin/moderator only):
//   GET  /api/admin/receipts                 — cross-user receipt listing
//                                              (?userId=, ?suspicious=1, ?limit=)
//   GET  /api/admin/receipts/stats           — global aggregates + flagged rows
//   GET  /api/admin/vehicle-inspections      — cross-user inspections
//                                              (?userId=, ?issuesOnly=1, ?date=)
//   GET  /api/admin/vehicle-inspections/stats — global inspection counters
//
// "Suspicious" receipts heuristic: totalCost > $2000 OR netTons > 25 OR
// netLb > 50000 OR totalCost <= 0 with netTons > 0.
//
// All responses redact nothing of payment-card info because we never store
// PAN data — paymentMethod is just a label like 'card'/'cash'/'check'.

const STAFF_LOCAL = ['super_admin', 'admin', 'moderator']

async function gateStaff(ctx) {
  const { request, db, getAuth, NextResponse, handleCORS } = ctx
  const auth = getAuth(request)
  if (!auth) return { error: handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 })) }
  const user = await db.collection('users').findOne({ id: auth.id })
  if (!user || !STAFF_LOCAL.includes(user.role)) {
    return { error: handleCORS(NextResponse.json({ error: 'Admin access required' }, { status: 403 })) }
  }
  return { user }
}

function isSuspiciousReceipt(r) {
  const c = Number(r.totalCost || 0)
  const t = Number(r.netTons || 0)
  const lb = Number(r.netLb || 0)
  return c > 2000 || t > 25 || lb > 50000 || (c <= 0 && t > 0)
}

export async function handle(ctx) {
  const { route, method, request, db, clean, NextResponse, handleCORS } = ctx
  if (!route.startsWith('/admin/receipts') && !route.startsWith('/admin/vehicle-inspections')) return null

  const gate = await gateStaff(ctx)
  if (gate.error) return gate.error
  const url = new URL(request.url)

  // ---- /admin/receipts ---------------------------------------------------
  if (route === '/admin/receipts' && method === 'GET') {
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)))
    const userId = url.searchParams.get('userId') || null
    const suspiciousOnly = url.searchParams.get('suspicious') === '1'
    const batchId = url.searchParams.get('batchId') || null
    const q = { deleted: { $ne: true } }
    if (userId) q.userId = userId
    if (batchId) q.batchId = batchId
    const rows = await db.collection('dump_receipts')
      .find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
    const enriched = rows.map(clean).map((r) => ({ ...r, suspicious: isSuspiciousReceipt(r) }))
    const filtered = suspiciousOnly ? enriched.filter((r) => r.suspicious) : enriched
    // Stamp on author email for the admin table
    const userIds = [...new Set(filtered.map((r) => r.userId).filter(Boolean))]
    const users = userIds.length
      ? await db.collection('users').find({ id: { $in: userIds } }).project({ id: 1, email: 1, name: 1, role: 1 }).toArray()
      : []
    const userById = Object.fromEntries(users.map((u) => [u.id, u]))
    return handleCORS(NextResponse.json({
      receipts: filtered.map((r) => ({
        ...r,
        userEmail: userById[r.userId]?.email || null,
        userName: userById[r.userId]?.name || null,
        userRole: userById[r.userId]?.role || null,
      })),
      total: filtered.length,
    }))
  }

  if (route === '/admin/receipts/stats' && method === 'GET') {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const baseQ = { deleted: { $ne: true } }
    const [allRows, monthAgg, batchAgg, manualAgg] = await Promise.all([
      db.collection('dump_receipts').find(baseQ).limit(2000).toArray(),
      db.collection('dump_receipts').aggregate([
        { $match: { ...baseQ, dateOf: { $gte: monthStart } } },
        { $group: { _id: null, trips: { $sum: 1 }, totalCost: { $sum: '$totalCost' }, totalNetTons: { $sum: '$netTons' } } },
      ]).toArray(),
      db.collection('dump_receipts').aggregate([
        { $match: { ...baseQ, batchId: { $exists: true, $ne: null } } },
        { $group: { _id: '$batchId', count: { $sum: 1 }, userId: { $first: '$userId' }, createdAt: { $first: '$createdAt' } } },
        { $sort: { createdAt: -1 } },
        { $limit: 20 },
      ]).toArray(),
      db.collection('dump_receipts').aggregate([
        { $match: { ...baseQ, batchId: { $exists: false } } },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]).toArray(),
    ])
    const flagged = allRows.filter(isSuspiciousReceipt).slice(0, 10).map(clean)
    return handleCORS(NextResponse.json({
      thisMonth: monthAgg[0] ? {
        trips: monthAgg[0].trips,
        totalCost: Number((monthAgg[0].totalCost || 0).toFixed(2)),
        totalNetTons: Number((monthAgg[0].totalNetTons || 0).toFixed(3)),
      } : { trips: 0, totalCost: 0, totalNetTons: 0 },
      flagged,
      recentBatches: batchAgg.map((b) => ({ batchId: b._id, userId: b.userId, count: b.count, createdAt: b.createdAt })),
      manualCount: manualAgg[0]?.count || 0,
      totalReceiptsInWindow: allRows.length,
    }))
  }

  // ---- /admin/vehicle-inspections ---------------------------------------
  if (route === '/admin/vehicle-inspections' && method === 'GET') {
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)))
    const userId = url.searchParams.get('userId') || null
    const issuesOnly = url.searchParams.get('issuesOnly') === '1'
    const date = url.searchParams.get('date') || null
    const q = { deleted: { $ne: true } }
    if (userId) q.userId = userId
    if (issuesOnly) q.issuesFlag = true
    if (date) q.date = date
    const rows = await db.collection('vehicle_inspections')
      .find(q)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .toArray()
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))]
    const users = userIds.length
      ? await db.collection('users').find({ id: { $in: userIds } }).project({ id: 1, email: 1, name: 1, role: 1 }).toArray()
      : []
    const userById = Object.fromEntries(users.map((u) => [u.id, u]))
    return handleCORS(NextResponse.json({
      inspections: rows.map(clean).map((r) => ({
        ...r,
        userEmail: userById[r.userId]?.email || null,
        userName: userById[r.userId]?.name || null,
      })),
      total: rows.length,
    }))
  }

  if (route === '/admin/vehicle-inspections/stats' && method === 'GET') {
    const today = new Date().toISOString().slice(0, 10)
    const baseQ = { deleted: { $ne: true } }
    const [today7, allWithIssues, damageReports, dashLights] = await Promise.all([
      db.collection('vehicle_inspections').find({ ...baseQ, date: today }).toArray(),
      db.collection('vehicle_inspections').countDocuments({ ...baseQ, issuesFlag: true }),
      db.collection('vehicle_inspections').find({ ...baseQ, damageReported: true }).sort({ createdAt: -1 }).limit(10).toArray(),
      db.collection('vehicle_inspections').find({ ...baseQ, dashboardLightsReported: true }).sort({ createdAt: -1 }).limit(10).toArray(),
    ])
    return handleCORS(NextResponse.json({
      today: today,
      todayCompleted: today7.length,
      todayWithIssues: today7.filter((r) => r.issuesFlag).length,
      totalWithIssues: allWithIssues,
      recentDamageReports: damageReports.map(clean),
      recentDashLightReports: dashLights.map(clean),
    }))
  }

  return null
}
