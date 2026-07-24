// PR-2c: Vehicle Inspection module — contractor-only daily truck inspections.
//
// Endpoints (all gated to users with contractor access):
//   POST   /api/vehicle-inspections           → create inspection
//   GET    /api/vehicle-inspections           → list current user's inspections
//                                                (filters: ?date=YYYY-MM-DD,
//                                                 ?vehicleNumber=, ?phase=)
//   GET    /api/vehicle-inspections/stats     → today's completed / missing /
//                                                issues counts + active vehicles
//   GET    /api/vehicle-inspections/:id       → single
//   PATCH  /api/vehicle-inspections/:id       → update (e.g. add end-of-day
//                                                mileage to an existing
//                                                pre-shift inspection)
//   DELETE /api/vehicle-inspections/:id       → soft delete
//
// MongoDB collection: `vehicle_inspections`
//
// Schema (partial; defensive defaults applied in normalizeInspection):
// {
//   id, userId, vehicleNumber, vehicleType, licensePlate?, driverName,
//   date (YYYY-MM-DD), startTime, endTime?, phase ('pre_shift'|'post_shift'|'both'),
//   mileageStart, mileageEnd?, milesDriven (auto = end - start, if both set),
//   fuelStart ('empty'|'1_4'|'1_2'|'3_4'|'full'),
//   fuelEnd?    (same enum),
//   dashboardLightsReported (bool),
//   dashboardLights: [string],  // e.g. ['check_engine', 'tire_pressure']
//   damageReported (bool),
//   damageDescription?: string,
//   damageLocations: [string],  // e.g. ['front', 'driver_side']
//   damagePhotos: [url],
//   loadStatus ('empty'|'half'|'full'),
//   cleanliness ('clean'|'dirty'|'needs_wash'|'needs_interior'),
//   checklist: { tires, lights, brakes, mirrors, backupCamera, liftgate,
//                registration, safetyEquipment, firstAid, strapsTools }  // booleans
//   notes?: string,
//   issuesFlag (bool, derived: true if dashboardLights OR damage OR any
//                  checklist:false),
//   deleted?, createdAt, updatedAt
// }

const { hasContractorAccess } = require('../../../../lib/contractor-access')

const FUEL = ['empty', '1_4', '1_2', '3_4', 'full']
const LOAD = ['empty', 'half', 'full']
const CLEAN = ['clean', 'dirty', 'needs_wash', 'needs_interior']
const PHASE = ['pre_shift', 'post_shift', 'both']

const CHECKLIST_KEYS = [
  'tires', 'lights', 'brakes', 'mirrors', 'backupCamera', 'liftgate',
  'registration', 'safetyEquipment', 'firstAid', 'strapsTools',
]

function num(v, def = 0) {
  const n = Number(v); return Number.isFinite(n) ? n : def
}
function s(v, max = 200) { return v ? String(v).slice(0, max) : '' }
function pickEnum(v, allowed, fallback) {
  return allowed.includes(String(v)) ? String(v) : fallback
}

function normalizeInspection(body) {
  const checklist = {}
  for (const k of CHECKLIST_KEYS) checklist[k] = !!(body.checklist && body.checklist[k])
  const dashLights = Array.isArray(body.dashboardLights) ? body.dashboardLights.map((x) => s(x, 40)).slice(0, 12) : []
  const damageLocations = Array.isArray(body.damageLocations) ? body.damageLocations.map((x) => s(x, 30)).slice(0, 10) : []
  const damagePhotos = Array.isArray(body.damagePhotos) ? body.damagePhotos.map((x) => s(x, 600)).slice(0, 8) : []
  const mileageStart = num(body.mileageStart, 0)
  const mileageEnd = body.mileageEnd == null || body.mileageEnd === '' ? null : num(body.mileageEnd, 0)
  const milesDriven = mileageEnd != null && mileageEnd >= mileageStart ? mileageEnd - mileageStart : 0
  const dashLightsReported = !!body.dashboardLightsReported || dashLights.length > 0
  const damageReported = !!body.damageReported || damageLocations.length > 0 || !!(body.damageDescription && body.damageDescription.trim())
  const failedCheck = CHECKLIST_KEYS.some((k) => !checklist[k])
  const issuesFlag = dashLightsReported || damageReported || failedCheck
  return {
    vehicleNumber: s(body.vehicleNumber, 40).trim(),
    vehicleType: s(body.vehicleType, 60).trim(),
    licensePlate: s(body.licensePlate, 20).trim(),
    driverName: s(body.driverName, 80).trim(),
    date: s(body.date || new Date().toISOString().slice(0, 10), 10),
    startTime: s(body.startTime, 8),
    endTime: s(body.endTime, 8),
    phase: pickEnum(body.phase, PHASE, 'pre_shift'),
    mileageStart,
    mileageEnd,
    milesDriven,
    fuelStart: pickEnum(body.fuelStart, FUEL, 'full'),
    fuelEnd: body.fuelEnd ? pickEnum(body.fuelEnd, FUEL, null) : null,
    dashboardLightsReported: dashLightsReported,
    dashboardLights: dashLights,
    damageReported,
    damageDescription: s(body.damageDescription, 800),
    damageLocations,
    damagePhotos,
    loadStatus: pickEnum(body.loadStatus, LOAD, 'empty'),
    cleanliness: pickEnum(body.cleanliness, CLEAN, 'clean'),
    checklist,
    notes: s(body.notes, 800),
    issuesFlag,
  }
}

export async function handle(ctx) {
  const { route, method, request, db, getAuth, clean, uuidv4, NextResponse, handleCORS } = ctx
  if (!route.startsWith('/vehicle-inspections')) return null

  // ALL endpoints require contractor access.
  const auth = getAuth(request)
  if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
  const userRow = await db.collection('users').findOne({ id: auth.id })
  if (!userRow || !hasContractorAccess(userRow)) {
    return handleCORS(NextResponse.json({ error: 'Contractor access required' }, { status: 403 }))
  }

  const col = db.collection('vehicle_inspections')
  const url = new URL(request.url)

  // ---- CREATE -----------------------------------------------------------
  if (route === '/vehicle-inspections' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const norm = normalizeInspection(body)
    if (!norm.vehicleNumber) return handleCORS(NextResponse.json({ error: 'vehicleNumber required' }, { status: 400 }))
    if (!norm.driverName) return handleCORS(NextResponse.json({ error: 'driverName required' }, { status: 400 }))
    const doc = {
      id: uuidv4(),
      userId: auth.id,
      ...norm,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await col.insertOne(doc)
    return handleCORS(NextResponse.json({ inspection: clean(doc) }, { status: 201 }))
  }

  // ---- LIST --------------------------------------------------------------
  if (route === '/vehicle-inspections' && method === 'GET') {
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))
    const date = url.searchParams.get('date')
    const vehicleNumber = url.searchParams.get('vehicleNumber')
    const phase = url.searchParams.get('phase')
    const issuesOnly = url.searchParams.get('issuesOnly') === '1'
    const q = { userId: auth.id, deleted: { $ne: true } }
    if (date) q.date = date
    if (vehicleNumber) q.vehicleNumber = vehicleNumber
    if (phase && PHASE.includes(phase)) q.phase = phase
    if (issuesOnly) q.issuesFlag = true
    const rows = await col.find(q).sort({ date: -1, startTime: -1, createdAt: -1 }).limit(limit).toArray()
    return handleCORS(NextResponse.json({ inspections: rows.map(clean) }))
  }

  // ---- STATS (today's overview) ----------------------------------------
  if (route === '/vehicle-inspections/stats' && method === 'GET') {
    const today = new Date().toISOString().slice(0, 10)
    const baseQ = { userId: auth.id, deleted: { $ne: true } }
    const [todayRows, recentVehicles] = await Promise.all([
      col.find({ ...baseQ, date: today }).toArray(),
      col.distinct('vehicleNumber', baseQ).then((arr) => arr.filter(Boolean)),
    ])
    const completed = todayRows.length
    const withIssues = todayRows.filter((r) => r.issuesFlag).length
    const completePost = todayRows.filter((r) => r.phase === 'post_shift' || r.phase === 'both' || (r.mileageEnd != null && r.fuelEnd != null)).length
    // Per-vehicle: which trucks have inspections today, which don't
    const inspectedToday = new Set(todayRows.map((r) => r.vehicleNumber))
    const missing = recentVehicles.filter((v) => !inspectedToday.has(v))
    return handleCORS(NextResponse.json({
      date: today,
      completed,
      missing: missing.length,
      missingVehicles: missing,
      issues: withIssues,
      postShiftDone: completePost,
      knownVehicles: recentVehicles,
      todayInspections: todayRows.map(clean),
    }))
  }

  // ---- DETAIL / UPDATE / DELETE ----------------------------------------
  if (route.startsWith('/vehicle-inspections/') && route.split('/').length === 3) {
    const id = route.split('/')[2]
    if (id === 'stats') return null // already handled above; safety net
    if (method === 'GET') {
      const row = await col.findOne({ id, userId: auth.id, deleted: { $ne: true } })
      if (!row) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      return handleCORS(NextResponse.json({ inspection: clean(row) }))
    }
    if (method === 'PATCH') {
      const existing = await col.findOne({ id, userId: auth.id, deleted: { $ne: true } })
      if (!existing) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json().catch(() => ({}))
      const merged = { ...existing, ...body }
      // If user changed end-mileage but not start, keep original start.
      const norm = normalizeInspection(merged)
      await col.updateOne({ id }, { $set: { ...norm, updatedAt: new Date() } })
      const updated = await col.findOne({ id })
      return handleCORS(NextResponse.json({ inspection: clean(updated) }))
    }
    if (method === 'DELETE') {
      await col.updateOne({ id, userId: auth.id }, { $set: { deleted: true, updatedAt: new Date() } })
      return handleCORS(NextResponse.json({ ok: true }))
    }
  }

  return null
}
