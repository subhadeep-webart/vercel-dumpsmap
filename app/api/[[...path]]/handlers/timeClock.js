// Time Clock 2.0 — Contractor time tracking with manual entries, work
// association (job/work order/vehicle), rounding rules, manager approvals,
// and CSV export.
//
// Endpoints (all gated to users with contractor access; manager endpoints
// require role in [super_admin, admin, moderator] OR contractor with role 'manager'):
//
//   --- Active tracking (existing) ---
//   GET    /time-clock/current             → active entry or null
//   POST   /time-clock/clock-in            → start a new entry
//   POST   /time-clock/clock-out           → end the active entry
//   POST   /time-clock/break/start         → begin a break on the active entry
//   POST   /time-clock/break/end           → end the open break
//
//   --- CRUD ---
//   GET    /time-clock/entries             → list current user's entries
//   POST   /time-clock/entries             → MANUAL entry (provide clockInAt + clockOutAt)
//   GET    /time-clock/entries/:id         → single
//   PATCH  /time-clock/entries/:id         → edit ANY field (clock times, breaks, work refs, notes)
//   DELETE /time-clock/entries/:id         → soft delete
//   POST   /time-clock/entries/:id/submit  → submit for approval
//   POST   /time-clock/entries/:id/duplicate → duplicate to today (or provided date)
//
//   --- Summary / export ---
//   GET    /time-clock/summary             → totals + by-job breakdown
//   GET    /time-clock/export.csv          → CSV download for filtered range
//   GET    /time-clock/email-payload       → returns mailto-ready payload
//
//   --- Settings (per-user rounding rules etc.) ---
//   GET    /time-clock/settings
//   PATCH  /time-clock/settings
//
//   --- Manager approvals ---
//   GET    /time-clock/manager/queue       → submitted entries from managed users
//   POST   /time-clock/manager/:id/approve { notes? }
//   POST   /time-clock/manager/:id/reject  { reason }

const { hasContractorAccess } = require('../../../../lib/contractor-access')

const STATUS = ['active', 'completed', 'submitted', 'approved', 'rejected']
const MANAGER_ROLES = ['super_admin', 'admin', 'moderator', 'manager']

// ---- helpers --------------------------------------------------------------
function s(v, max = 200) { return v ? String(v).slice(0, max) : '' }
function num(v, def = 0) { const n = Number(v); return Number.isFinite(n) ? n : def }
function pickEnum(v, allowed, fallback) { return allowed.includes(String(v)) ? String(v) : fallback }
function ymd(d = new Date()) { return new Date(d).toISOString().slice(0, 10) }
function safeDate(v) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function pickLocation(loc) {
  if (!loc || typeof loc !== 'object') return null
  const lat = Number(loc.lat); const lng = Number(loc.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    lat,
    lng,
    accuracy: Number.isFinite(Number(loc.accuracy)) ? Number(loc.accuracy) : null,
  }
}

// Default rounding settings.
const DEFAULT_SETTINGS = {
  roundToMinutes: 1,                  // 1 = no rounding; 5/10/15/30 supported
  roundDirection: 'nearest',          // 'nearest' | 'up' | 'down'
  autoBreakMinutes: 0,                // optional auto-deduct break (e.g. 30 for a 30-min lunch)
  managerEmail: '',                   // for email-payload mailto:
  defaultRate: 0,                     // hourly rate ($) for est. earnings
}

function applyRounding(minutes, settings) {
  const step = Math.max(1, num(settings?.roundToMinutes, 1))
  if (step <= 1) return Math.max(0, minutes)
  const dir = settings?.roundDirection || 'nearest'
  if (dir === 'up') return Math.ceil(minutes / step) * step
  if (dir === 'down') return Math.floor(minutes / step) * step
  return Math.round(minutes / step) * step
}

// Compute totals on an in-memory entry. Returns mutated copy. The "raw" values
// are stored so we can re-compute with different rounding settings later.
function computeTotals(entry, now = new Date(), settings = null) {
  const endsAt = entry.clockOutAt ? new Date(entry.clockOutAt) : now
  const startAt = new Date(entry.clockInAt)
  const totalMs = Math.max(0, endsAt - startAt)
  const totalMinutesRaw = Math.round(totalMs / 60000)
  let breakMs = 0
  const breaks = Array.isArray(entry.breaks) ? entry.breaks : []
  for (const b of breaks) {
    if (!b || !b.startAt) continue
    const bs = new Date(b.startAt)
    const be = b.endAt ? new Date(b.endAt) : (entry.clockOutAt ? new Date(entry.clockOutAt) : now)
    if (be > bs) breakMs += (be - bs)
  }
  let breakMinutesRaw = Math.round(breakMs / 60000)
  // Auto-deduct break (only if no explicit breaks logged AND entry is completed)
  if (
    breakMinutesRaw === 0 &&
    entry.clockOutAt &&
    settings?.autoBreakMinutes > 0 &&
    totalMinutesRaw >= (settings.autoBreakMinutes + 30)
  ) {
    breakMinutesRaw = settings.autoBreakMinutes
  }
  const netMinutesRaw = Math.max(0, totalMinutesRaw - breakMinutesRaw)
  const netMinutes = applyRounding(netMinutesRaw, settings)
  const totalMinutes = applyRounding(totalMinutesRaw, settings)
  return {
    ...entry,
    totalMinutesRaw,
    breakMinutesRaw,
    netMinutesRaw,
    totalMinutes,
    breakMinutes: breakMinutesRaw,
    netMinutes,
  }
}

function activeBreak(entry) {
  if (!entry || !Array.isArray(entry.breaks)) return null
  return entry.breaks.find((b) => b && !b.endAt) || null
}

async function getSettings(db, userId) {
  const row = await db.collection('time_clock_settings').findOne({ userId })
  return { ...DEFAULT_SETTINGS, ...(row || {}) }
}

function isManager(userRow) {
  return !!userRow && (
    MANAGER_ROLES.includes(userRow.role) ||
    MANAGER_ROLES.includes(userRow.profileType) ||
    userRow.isManager === true
  )
}

function toCsvLine(values) {
  return values
    .map((v) => {
      if (v == null) return ''
      const s = String(v)
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
      return s
    })
    .join(',')
}

function buildEditNote(prev, next, who) {
  const changed = []
  const keys = ['clockInAt', 'clockOutAt', 'jobId', 'jobLabel', 'workOrderId', 'workOrderLabel',
                'vehicleId', 'vehicleLabel', 'facilityId', 'facilityName', 'notes']
  for (const k of keys) {
    if (next[k] !== undefined && String(prev[k] ?? '') !== String(next[k] ?? '')) {
      changed.push(k)
    }
  }
  if (Array.isArray(next.breaks)) changed.push('breaks')
  return {
    at: new Date(),
    by: who,
    changed,
  }
}

// ---- main handler ---------------------------------------------------------
export async function handle(ctx) {
  const { route, method, request, db, getAuth, clean, uuidv4, NextResponse, handleCORS } = ctx
  if (!route.startsWith('/time-clock')) return null

  const auth = getAuth(request)
  if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
  const userRow = await db.collection('users').findOne({ id: auth.id })
  if (!userRow || !hasContractorAccess(userRow)) {
    return handleCORS(NextResponse.json({ error: 'Contractor access required' }, { status: 403 }))
  }

  const col = db.collection('time_entries')
  const url = new URL(request.url)
  const settings = await getSettings(db, auth.id)

  // ===================================================================
  // SETTINGS (per-user)
  // ===================================================================
  if (route === '/time-clock/settings' && method === 'GET') {
    return handleCORS(NextResponse.json({ settings }))
  }
  if (route === '/time-clock/settings' && method === 'PATCH') {
    const body = await request.json().catch(() => ({}))
    const next = { ...settings }
    if (body.roundToMinutes !== undefined) {
      const v = num(body.roundToMinutes, 1)
      next.roundToMinutes = [1, 5, 10, 15, 30].includes(v) ? v : 1
    }
    if (body.roundDirection !== undefined) {
      next.roundDirection = pickEnum(body.roundDirection, ['nearest', 'up', 'down'], 'nearest')
    }
    if (body.autoBreakMinutes !== undefined) {
      next.autoBreakMinutes = Math.max(0, Math.min(120, num(body.autoBreakMinutes, 0)))
    }
    if (body.managerEmail !== undefined) next.managerEmail = s(body.managerEmail, 200)
    if (body.defaultRate !== undefined) next.defaultRate = Math.max(0, num(body.defaultRate, 0))
    next.userId = auth.id
    next.updatedAt = new Date()
    delete next.createdAt  // Remove createdAt to avoid conflict with $setOnInsert
    await db.collection('time_clock_settings').updateOne(
      { userId: auth.id },
      { $set: next, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    )
    const fresh = await getSettings(db, auth.id)
    return handleCORS(NextResponse.json({ settings: fresh }))
  }

  // ===================================================================
  // EXPORT — CSV
  // ===================================================================
  if (route === '/time-clock/export.csv' && method === 'GET') {
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined
    const q = { userId: auth.id, deleted: { $ne: true } }
    if (from || to) {
      q.date = {}
      if (from) q.date.$gte = s(from, 10)
      if (to) q.date.$lte = s(to, 10)
    }
    const rows = await col.find(q).sort({ clockInAt: -1 }).limit(2000).toArray()
    const header = [
      'Date', 'Clock In', 'Clock Out', 'Total (min)', 'Break (min)', 'Net (min)', 'Net (hours)',
      'Status', 'Job', 'Work Order', 'Vehicle', 'Facility', 'Notes', 'Manual', 'Approved By', 'Approved At',
    ]
    const lines = [toCsvLine(header)]
    for (const r of rows) {
      const t = computeTotals(r, new Date(), settings)
      lines.push(toCsvLine([
        r.date,
        r.clockInAt ? new Date(r.clockInAt).toISOString() : '',
        r.clockOutAt ? new Date(r.clockOutAt).toISOString() : '',
        t.totalMinutes,
        t.breakMinutes,
        t.netMinutes,
        (t.netMinutes / 60).toFixed(2),
        r.status,
        r.jobLabel || r.jobId || '',
        r.workOrderLabel || r.workOrderId || '',
        r.vehicleLabel || r.vehicleId || '',
        r.facilityName || r.facilityId || '',
        (r.notes || '').replace(/\n/g, ' '),
        r.isManualEntry ? 'Yes' : 'No',
        r.approvedBy || '',
        r.approvedAt ? new Date(r.approvedAt).toISOString() : '',
      ]))
    }
    const csv = lines.join('\n')
    return handleCORS(new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="timeclock_${from || 'all'}_${to || ymd()}.csv"`,
      },
    }))
  }

  // ===================================================================
  // EMAIL PAYLOAD (returns mailto-ready content for client to compose)
  // ===================================================================
  if (route === '/time-clock/email-payload' && method === 'GET') {
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined
    const q = { userId: auth.id, deleted: { $ne: true } }
    if (from || to) {
      q.date = {}
      if (from) q.date.$gte = s(from, 10)
      if (to) q.date.$lte = s(to, 10)
    }
    const rows = await col.find(q).sort({ clockInAt: 1 }).limit(500).toArray()
    let totalNet = 0
    const lines = rows.map((r) => {
      const t = computeTotals(r, new Date(), settings)
      totalNet += t.netMinutes
      const inT = r.clockInAt ? new Date(r.clockInAt).toLocaleString() : '—'
      const outT = r.clockOutAt ? new Date(r.clockOutAt).toLocaleString() : '—'
      return `• ${r.date} | ${inT} → ${outT} | ${(t.netMinutes / 60).toFixed(2)}h | ${r.jobLabel || r.workOrderLabel || 'Unassigned'}`
    }).join('\n')
    const subject = `Timesheet · ${userRow.name || userRow.email} · ${from || rows[0]?.date || ''} – ${to || ymd()}`
    const earnings = settings.defaultRate > 0
      ? `\n\nEstimated earnings: $${((totalNet / 60) * settings.defaultRate).toFixed(2)} @ $${settings.defaultRate}/hr`
      : ''
    const body = `Submitted timesheet from ${userRow.name || userRow.email}.

Range: ${from || 'all-time'} → ${to || ymd()}
Entries: ${rows.length}
Total worked: ${(totalNet / 60).toFixed(2)} hours (${totalNet} minutes)${earnings}

${lines || '(no entries in range)'}

— DumpMaps Time Clock`
    return handleCORS(NextResponse.json({
      to: settings.managerEmail || '',
      subject,
      body,
      entries: rows.length,
      totalNetMinutes: totalNet,
    }))
  }

  // ===================================================================
  // MANAGER QUEUE
  // ===================================================================
  if (route === '/time-clock/manager/queue' && method === 'GET') {
    if (!isManager(userRow)) {
      return handleCORS(NextResponse.json({ error: 'Manager access required' }, { status: 403 }))
    }
    const status = url.searchParams.get('status') || 'submitted'
    const rows = await col
      .find({ status, deleted: { $ne: true } })
      .sort({ clockInAt: -1 }).limit(200).toArray()
    // Enrich with author info
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))]
    const users = await db.collection('users').find({ id: { $in: userIds } }).toArray()
    const uMap = new Map(users.map((u) => [u.id, u]))
    const enriched = rows.map((r) => {
      const u = uMap.get(r.userId)
      const us = u ? { ...DEFAULT_SETTINGS } : settings
      return {
        ...clean(computeTotals(r, new Date(), us)),
        author: u ? { id: u.id, name: u.name || u.email, email: u.email, avatarUrl: u.avatarUrl || u.profilePhotoUrl || null } : null,
      }
    })
    return handleCORS(NextResponse.json({ entries: enriched }))
  }

  // ---- MANAGER APPROVE / REJECT ----------------------------------------
  if (route.startsWith('/time-clock/manager/') && (method === 'POST')) {
    if (!isManager(userRow)) {
      return handleCORS(NextResponse.json({ error: 'Manager access required' }, { status: 403 }))
    }
    const tail = route.slice('/time-clock/manager/'.length)
    const m = tail.match(/^([^/]+)\/(approve|reject)$/)
    if (!m) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const [, entryId, action] = m
    const row = await col.findOne({ id: entryId, deleted: { $ne: true } })
    if (!row) return handleCORS(NextResponse.json({ error: 'Entry not found' }, { status: 404 }))
    if (row.status !== 'submitted') {
      return handleCORS(NextResponse.json({ error: `Cannot ${action} from status: ${row.status}` }, { status: 400 }))
    }
    const body = await request.json().catch(() => ({}))
    const now = new Date()
    const patch = { updatedAt: now }
    if (action === 'approve') {
      patch.status = 'approved'
      patch.approvedBy = auth.id
      patch.approverName = userRow.name || userRow.email
      patch.approvedAt = now
      patch.approverNotes = s(body.notes, 500)
      patch.rejectionReason = ''
    } else {
      patch.status = 'rejected'
      patch.approvedBy = auth.id
      patch.approverName = userRow.name || userRow.email
      patch.approvedAt = now
      patch.rejectionReason = s(body.reason, 500) || 'No reason provided'
    }
    await col.updateOne({ id: entryId }, { $set: patch })
    const fresh = await col.findOne({ id: entryId })
    return handleCORS(NextResponse.json({ entry: clean(computeTotals(fresh, new Date(), settings)) }))
  }

  // ===================================================================
  // CURRENT (active entry)
  // ===================================================================
  if (route === '/time-clock/current' && method === 'GET') {
    const row = await col.findOne({ userId: auth.id, status: 'active', deleted: { $ne: true } })
    if (!row) return handleCORS(NextResponse.json({ entry: null, settings }))
    return handleCORS(NextResponse.json({ entry: clean(computeTotals(row, new Date(), settings)), settings }))
  }

  // ===================================================================
  // CLOCK IN
  // ===================================================================
  if (route === '/time-clock/clock-in' && method === 'POST') {
    const existingActive = await col.findOne({ userId: auth.id, status: 'active', deleted: { $ne: true } })
    if (existingActive) {
      return handleCORS(NextResponse.json({
        error: 'Already clocked in',
        entry: clean(computeTotals(existingActive, new Date(), settings)),
      }, { status: 409 }))
    }
    const body = await request.json().catch(() => ({}))
    const now = new Date()
    const doc = {
      id: uuidv4(),
      userId: auth.id,
      jobId: s(body.jobId, 80) || null,
      jobLabel: s(body.jobLabel, 160) || null,
      workOrderId: s(body.workOrderId, 80) || null,
      workOrderLabel: s(body.workOrderLabel, 160) || null,
      vehicleId: s(body.vehicleId, 80) || null,
      vehicleLabel: s(body.vehicleLabel, 160) || null,
      facilityId: s(body.facilityId, 80) || null,
      facilityName: s(body.facilityName, 160) || null,
      date: ymd(now),
      clockInAt: now,
      clockOutAt: null,
      breaks: [],
      totalMinutes: 0,
      breakMinutes: 0,
      netMinutes: 0,
      status: 'active',
      notes: s(body.notes, 800),
      locationIn: pickLocation(body.location),
      locationOut: null,
      isManualEntry: false,
      editHistory: [],
      deleted: false,
      createdAt: now,
      updatedAt: now,
    }
    await col.insertOne(doc)
    return handleCORS(NextResponse.json({ entry: clean(computeTotals(doc, new Date(), settings)) }, { status: 201 }))
  }

  // ===================================================================
  // CLOCK OUT
  // ===================================================================
  if (route === '/time-clock/clock-out' && method === 'POST') {
    const active = await col.findOne({ userId: auth.id, status: 'active', deleted: { $ne: true } })
    if (!active) return handleCORS(NextResponse.json({ error: 'Not clocked in' }, { status: 404 }))
    const body = await request.json().catch(() => ({}))
    const now = new Date()
    const breaks = (active.breaks || []).map((b) => (b && !b.endAt ? { ...b, endAt: now } : b))
    const merged = { ...active, breaks, clockOutAt: now }
    const totals = computeTotals(merged, now, settings)
    const update = {
      clockOutAt: now,
      breaks,
      totalMinutes: totals.totalMinutes,
      breakMinutes: totals.breakMinutes,
      netMinutes: totals.netMinutes,
      status: 'completed',
      notes: body.notes !== undefined ? s(body.notes, 800) : active.notes,
      locationOut: pickLocation(body.location),
      updatedAt: now,
    }
    await col.updateOne({ id: active.id }, { $set: update })
    const fresh = await col.findOne({ id: active.id })
    return handleCORS(NextResponse.json({ entry: clean(computeTotals(fresh, new Date(), settings)) }))
  }

  // ===================================================================
  // BREAK START / END
  // ===================================================================
  if (route === '/time-clock/break/start' && method === 'POST') {
    const active = await col.findOne({ userId: auth.id, status: 'active', deleted: { $ne: true } })
    if (!active) return handleCORS(NextResponse.json({ error: 'Not clocked in' }, { status: 404 }))
    if (activeBreak(active)) {
      return handleCORS(NextResponse.json({ error: 'Break already in progress' }, { status: 409 }))
    }
    const body = await request.json().catch(() => ({}))
    const now = new Date()
    const breakRow = { id: uuidv4(), startAt: now, endAt: null, reason: s(body.reason, 80) }
    const breaks = [...(active.breaks || []), breakRow]
    await col.updateOne({ id: active.id }, { $set: { breaks, updatedAt: now } })
    const fresh = await col.findOne({ id: active.id })
    return handleCORS(NextResponse.json({ entry: clean(computeTotals(fresh, new Date(), settings)) }))
  }

  if (route === '/time-clock/break/end' && method === 'POST') {
    const active = await col.findOne({ userId: auth.id, status: 'active', deleted: { $ne: true } })
    if (!active) return handleCORS(NextResponse.json({ error: 'Not clocked in' }, { status: 404 }))
    const ob = activeBreak(active)
    if (!ob) return handleCORS(NextResponse.json({ error: 'No break in progress' }, { status: 409 }))
    const now = new Date()
    const breaks = (active.breaks || []).map((b) => (b && b.id === ob.id ? { ...b, endAt: now } : b))
    await col.updateOne({ id: active.id }, { $set: { breaks, updatedAt: now } })
    const fresh = await col.findOne({ id: active.id })
    return handleCORS(NextResponse.json({ entry: clean(computeTotals(fresh, new Date(), settings)) }))
  }

  // ===================================================================
  // LIST ENTRIES
  // ===================================================================
  if (route === '/time-clock/entries' && method === 'GET') {
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)))
    const status = url.searchParams.get('status')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const jobId = url.searchParams.get('jobId')
    const workOrderId = url.searchParams.get('workOrderId')
    const q = { userId: auth.id, deleted: { $ne: true } }
    if (status && STATUS.includes(status)) q.status = status
    if (from || to) {
      q.date = {}
      if (from) q.date.$gte = s(from, 10)
      if (to) q.date.$lte = s(to, 10)
    }
    if (jobId) q.jobId = jobId
    if (workOrderId) q.workOrderId = workOrderId
    const rows = await col.find(q).sort({ clockInAt: -1 }).limit(limit).toArray()
    return handleCORS(NextResponse.json({
      entries: rows.map((r) => clean(computeTotals(r, new Date(), settings))),
      settings,
    }))
  }

  // ===================================================================
  // CREATE MANUAL ENTRY
  // ===================================================================
  if (route === '/time-clock/entries' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const clockIn = safeDate(body.clockInAt)
    const clockOut = safeDate(body.clockOutAt)
    if (!clockIn || !clockOut) {
      return handleCORS(NextResponse.json({ error: 'clockInAt and clockOutAt (ISO strings) are required' }, { status: 400 }))
    }
    if (clockOut <= clockIn) {
      return handleCORS(NextResponse.json({ error: 'clockOutAt must be after clockInAt' }, { status: 400 }))
    }
    // Validate breaks if provided
    const breaks = Array.isArray(body.breaks) ? body.breaks.map((b) => ({
      id: b.id || uuidv4(),
      startAt: safeDate(b.startAt),
      endAt: safeDate(b.endAt),
      reason: s(b.reason, 80),
    })).filter((b) => b.startAt && b.endAt && b.endAt > b.startAt) : []

    const now = new Date()
    const draft = {
      id: uuidv4(),
      userId: auth.id,
      jobId: s(body.jobId, 80) || null,
      jobLabel: s(body.jobLabel, 160) || null,
      workOrderId: s(body.workOrderId, 80) || null,
      workOrderLabel: s(body.workOrderLabel, 160) || null,
      vehicleId: s(body.vehicleId, 80) || null,
      vehicleLabel: s(body.vehicleLabel, 160) || null,
      facilityId: s(body.facilityId, 80) || null,
      facilityName: s(body.facilityName, 160) || null,
      date: ymd(clockIn),
      clockInAt: clockIn,
      clockOutAt: clockOut,
      breaks,
      status: 'completed',
      notes: s(body.notes, 800),
      locationIn: null,
      locationOut: null,
      isManualEntry: true,
      editHistory: [],
      deleted: false,
      createdAt: now,
      updatedAt: now,
    }
    const totals = computeTotals(draft, now, settings)
    draft.totalMinutes = totals.totalMinutes
    draft.breakMinutes = totals.breakMinutes
    draft.netMinutes = totals.netMinutes
    await col.insertOne(draft)
    return handleCORS(NextResponse.json({ entry: clean(computeTotals(draft, new Date(), settings)) }, { status: 201 }))
  }

  // ===================================================================
  // DETAIL / UPDATE / DELETE / SUBMIT / DUPLICATE
  // ===================================================================
  if (route.startsWith('/time-clock/entries/')) {
    const tail = route.slice('/time-clock/entries/'.length)
    const segs = tail.split('/').filter(Boolean)
    const id = segs[0]
    const sub = segs[1]

    if (sub === 'submit' && method === 'POST') {
      const row = await col.findOne({ id, userId: auth.id, deleted: { $ne: true } })
      if (!row) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (row.status === 'active') return handleCORS(NextResponse.json({ error: 'Clock out before submitting' }, { status: 400 }))
      if (row.status === 'approved') return handleCORS(NextResponse.json({ error: 'Already approved' }, { status: 400 }))
      await col.updateOne({ id }, { $set: { status: 'submitted', submittedAt: new Date(), updatedAt: new Date() } })
      const fresh = await col.findOne({ id })
      return handleCORS(NextResponse.json({ entry: clean(computeTotals(fresh, new Date(), settings)) }))
    }

    if (sub === 'duplicate' && method === 'POST') {
      const row = await col.findOne({ id, userId: auth.id, deleted: { $ne: true } })
      if (!row) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json().catch(() => ({}))
      const targetDate = body.targetDate ? new Date(body.targetDate + 'T00:00:00') : new Date()
      // Shift original clock times to the same time-of-day on the target date.
      const origIn = new Date(row.clockInAt)
      const origOut = row.clockOutAt ? new Date(row.clockOutAt) : null
      const newIn = new Date(targetDate)
      newIn.setHours(origIn.getHours(), origIn.getMinutes(), origIn.getSeconds(), 0)
      let newOut = null
      if (origOut) {
        const durationMs = origOut.getTime() - origIn.getTime()
        newOut = new Date(newIn.getTime() + durationMs)
      }
      const now = new Date()
      const newDoc = {
        ...row,
        _id: undefined,
        id: uuidv4(),
        clockInAt: newIn,
        clockOutAt: newOut,
        date: ymd(newIn),
        status: 'completed',
        breaks: [],
        isManualEntry: true,
        editHistory: [{ at: now, by: auth.id, changed: ['duplicated_from:' + row.id] }],
        submittedAt: null,
        approvedBy: null,
        approverName: null,
        approvedAt: null,
        approverNotes: null,
        rejectionReason: null,
        createdAt: now,
        updatedAt: now,
      }
      delete newDoc._id
      const totals = computeTotals(newDoc, now, settings)
      newDoc.totalMinutes = totals.totalMinutes
      newDoc.breakMinutes = totals.breakMinutes
      newDoc.netMinutes = totals.netMinutes
      await col.insertOne(newDoc)
      return handleCORS(NextResponse.json({ entry: clean(computeTotals(newDoc, now, settings)) }, { status: 201 }))
    }

    if (segs.length === 1) {
      if (method === 'GET') {
        const row = await col.findOne({ id, userId: auth.id, deleted: { $ne: true } })
        if (!row) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        return handleCORS(NextResponse.json({ entry: clean(computeTotals(row, new Date(), settings)) }))
      }
      if (method === 'PATCH') {
        const row = await col.findOne({ id, userId: auth.id, deleted: { $ne: true } })
        if (!row) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        if (row.status === 'approved') return handleCORS(NextResponse.json({ error: 'Approved entries cannot be edited' }, { status: 400 }))
        const body = await request.json().catch(() => ({}))
        const patch = { updatedAt: new Date() }
        if (body.jobId !== undefined) patch.jobId = s(body.jobId, 80) || null
        if (body.jobLabel !== undefined) patch.jobLabel = s(body.jobLabel, 160) || null
        if (body.workOrderId !== undefined) patch.workOrderId = s(body.workOrderId, 80) || null
        if (body.workOrderLabel !== undefined) patch.workOrderLabel = s(body.workOrderLabel, 160) || null
        if (body.vehicleId !== undefined) patch.vehicleId = s(body.vehicleId, 80) || null
        if (body.vehicleLabel !== undefined) patch.vehicleLabel = s(body.vehicleLabel, 160) || null
        if (body.facilityId !== undefined) patch.facilityId = s(body.facilityId, 80) || null
        if (body.facilityName !== undefined) patch.facilityName = s(body.facilityName, 160) || null
        if (body.notes !== undefined) patch.notes = s(body.notes, 800)
        // Allow clock-time edits ONLY when entry is not 'active'
        if (body.clockInAt !== undefined) {
          if (row.status === 'active') return handleCORS(NextResponse.json({ error: 'Clock out before editing times' }, { status: 400 }))
          const v = safeDate(body.clockInAt)
          if (!v) return handleCORS(NextResponse.json({ error: 'Invalid clockInAt' }, { status: 400 }))
          patch.clockInAt = v
          patch.date = ymd(v)
        }
        if (body.clockOutAt !== undefined) {
          if (row.status === 'active') return handleCORS(NextResponse.json({ error: 'Clock out before editing times' }, { status: 400 }))
          const v = safeDate(body.clockOutAt)
          if (!v) return handleCORS(NextResponse.json({ error: 'Invalid clockOutAt' }, { status: 400 }))
          patch.clockOutAt = v
        }
        if (Array.isArray(body.breaks)) {
          patch.breaks = body.breaks
            .map((b) => ({
              id: b.id || uuidv4(),
              startAt: safeDate(b.startAt),
              endAt: safeDate(b.endAt),
              reason: s(b.reason, 80),
            }))
            .filter((b) => b.startAt && b.endAt && b.endAt > b.startAt)
        }
        // Audit
        patch.editHistory = [...(row.editHistory || []), buildEditNote(row, patch, auth.id)]
        // Recompute totals
        const merged = { ...row, ...patch }
        if (merged.clockOutAt) {
          const t = computeTotals(merged, new Date(), settings)
          patch.totalMinutes = t.totalMinutes
          patch.breakMinutes = t.breakMinutes
          patch.netMinutes = t.netMinutes
        }
        await col.updateOne({ id }, { $set: patch })
        const fresh = await col.findOne({ id })
        return handleCORS(NextResponse.json({ entry: clean(computeTotals(fresh, new Date(), settings)) }))
      }
      if (method === 'DELETE') {
        await col.updateOne({ id, userId: auth.id }, { $set: { deleted: true, updatedAt: new Date() } })
        return handleCORS(NextResponse.json({ ok: true }))
      }
    }
  }

  // ===================================================================
  // SUMMARY
  // ===================================================================
  if (route === '/time-clock/summary' && method === 'GET') {
    const today = ymd(new Date())
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 6)
    const weekStartStr = ymd(weekStart)
    const baseQ = { userId: auth.id, deleted: { $ne: true } }
    const [todayRows, weekRows] = await Promise.all([
      col.find({ ...baseQ, date: today }).toArray(),
      col.find({ ...baseQ, date: { $gte: weekStartStr } }).toArray(),
    ])
    const sum = (rows) => rows.reduce((acc, r) => {
      const t = computeTotals(r, new Date(), settings)
      acc.total += t.totalMinutes
      acc.net += t.netMinutes
      acc.breaks += t.breakMinutes
      return acc
    }, { total: 0, net: 0, breaks: 0 })
    const todayTotals = sum(todayRows)
    const weekTotals = sum(weekRows)
    const byJob = {}
    for (const r of weekRows) {
      const key = r.jobLabel || r.workOrderLabel || (r.jobId ? `job:${r.jobId}` : 'Unassigned')
      const t = computeTotals(r, new Date(), settings)
      if (!byJob[key]) byJob[key] = { job: key, jobId: r.jobId || null, workOrderId: r.workOrderId || null, totalMinutes: 0, netMinutes: 0 }
      byJob[key].totalMinutes += t.totalMinutes
      byJob[key].netMinutes += t.netMinutes
    }
    const days = new Set(weekRows.map((r) => r.date))
    return handleCORS(NextResponse.json({
      today: { date: today, ...todayTotals, entries: todayRows.length },
      week: { from: weekStartStr, to: today, ...weekTotals, daysWorked: days.size, entries: weekRows.length },
      byJob: Object.values(byJob).sort((a, b) => b.netMinutes - a.netMinutes),
      settings,
    }))
  }

  return null
}
