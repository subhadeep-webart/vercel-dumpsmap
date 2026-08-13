// handlers/workItems.js
// ----------------------------------------------------------------------------
// Sprint A — Foundation endpoints for the three work modules. Schema-first;
// the full bid/award/claim/payout UI ships in Sprints C / D / G.
//
// Endpoints (all /api):
//   JOBS
//     POST   /jobs                       create new job (draft)
//     GET    /jobs?state=open            list jobs (filterable)
//     GET    /jobs?mine=true             list jobs posted by the caller
//     GET    /jobs/:id                   fetch one
//     PATCH  /jobs/:id/state             transition state (poster only)
//
//   BOUNTIES
//     POST   /bounties                   create draft bounty
//     GET    /bounties?state=funding     list
//     GET    /bounties/:id               fetch one
//     PATCH  /bounties/:id/state         transition state
//
//   VOLUNTEER EVENTS
//     POST   /volunteer-events           create
//     GET    /volunteer-events           list
//     GET    /volunteer-events/:id       fetch one
//     PATCH  /volunteer-events/:id/state transition state
//
//   WORK ORDERS (read-only here — created automatically)
//     GET    /work-orders?as=poster|contractor   list mine
//     GET    /work-orders/:id                    fetch one
//
// Indexes / data model live in lib/work-items.js.

import * as wi from '../../../../lib/work-items.js'

function clean(doc) { if (!doc) return doc; const { _id, ...rest } = doc; return rest }

function rid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'wi_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

async function requireAuth(ctx) {
  const { request, getAuth, NextResponse, handleCORS, db } = ctx
  const auth = getAuth(request); if (!auth) return { user: null, err: handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 })) }
  const user = await db.collection('users').findOne({ id: auth.id })
  if (!user) return { user: null, err: handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 })) }
  return { user, err: null }
}

function validateTransition(currentState, nextState, transitions) {
  const allowed = transitions[currentState] || []
  return allowed.includes(nextState)
}

export async function handle(ctx) {
  const { route, method, request, db, NextResponse, handleCORS } = ctx

  // ───── JOBS ─────────────────────────────────────────────────────────────
  if (route === '/jobs' && method === 'POST') {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const body = await request.json().catch(() => ({}))
    const doc = wi.newJobDoc({ id: rid(), posterId: user.id, ...body })
    await db.collection('jobs').insertOne(doc)
    return handleCORS(NextResponse.json({ job: clean(doc) }, { status: 201 }))
  }
  if (route === '/jobs' && method === 'GET') {
    const url = new URL(request.url)
    const q = {}
    if (url.searchParams.get('state')) q.state = url.searchParams.get('state')
    if (url.searchParams.get('posterId')) q.posterId = url.searchParams.get('posterId')
    // ?mine=true — jobs posted by the caller, for the resident portal's Jobs
    // panel. Resolved from the session rather than a caller-supplied id so a user
    // can't enumerate someone else's drafts. Unauthenticated → empty list.
    if (url.searchParams.get('mine') === 'true') {
      const { user, err } = await requireAuth(ctx); if (err) return err
      q.posterId = user.id
    }
    const rows = await db.collection('jobs').find(q).sort({ createdAt: -1 }).limit(100).toArray()
    return handleCORS(NextResponse.json({ jobs: rows.map(clean) }))
  }
  if (method === 'GET' && /^\/jobs\/[^/]+$/.test(route)) {
    const id = route.split('/').pop()
    const job = await db.collection('jobs').findOne({ id })
    if (!job) return handleCORS(NextResponse.json({ error: 'Job not found' }, { status: 404 }))
    return handleCORS(NextResponse.json({ job: clean(job) }))
  }
  if (method === 'PATCH' && /^\/jobs\/[^/]+\/state$/.test(route)) {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const id = route.split('/')[2]
    const body = await request.json().catch(() => ({}))
    const job = await db.collection('jobs').findOne({ id })
    if (!job) return handleCORS(NextResponse.json({ error: 'Job not found' }, { status: 404 }))
    if (job.posterId !== user.id && user.role !== 'super_admin') {
      return handleCORS(NextResponse.json({ error: 'Only the poster can change job state' }, { status: 403 }))
    }
    const next = String(body.state || '')
    if (!validateTransition(job.state, next, wi.JOB_TRANSITIONS)) {
      return handleCORS(NextResponse.json({
        error: `Invalid transition: ${job.state} → ${next}`,
        allowed: wi.JOB_TRANSITIONS[job.state] || [],
      }, { status: 400 }))
    }
    await db.collection('jobs').updateOne({ id }, {
      $set: { state: next, updatedAt: new Date() },
      $push: { stateHistory: { state: next, at: new Date(), by: user.id } },
    })
    const updated = await db.collection('jobs').findOne({ id })
    return handleCORS(NextResponse.json({ job: clean(updated) }))
  }

  // ───── BOUNTIES ─────────────────────────────────────────────────────────
  if (route === '/bounties' && method === 'POST') {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const body = await request.json().catch(() => ({}))
    const doc = wi.newBountyDoc({ id: rid(), posterId: user.id, ...body })
    await db.collection('bounties').insertOne(doc)
    return handleCORS(NextResponse.json({ bounty: clean(doc) }, { status: 201 }))
  }
  if (route === '/bounties' && method === 'GET') {
    const url = new URL(request.url)
    const q = {}
    if (url.searchParams.get('state')) q.state = url.searchParams.get('state')
    const rows = await db.collection('bounties').find(q).sort({ createdAt: -1 }).limit(100).toArray()
    return handleCORS(NextResponse.json({ bounties: rows.map(clean) }))
  }
  if (method === 'GET' && /^\/bounties\/[^/]+$/.test(route)) {
    const id = route.split('/').pop()
    const b = await db.collection('bounties').findOne({ id })
    if (!b) return handleCORS(NextResponse.json({ error: 'Bounty not found' }, { status: 404 }))
    return handleCORS(NextResponse.json({ bounty: clean(b) }))
  }
  if (method === 'PATCH' && /^\/bounties\/[^/]+\/state$/.test(route)) {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const id = route.split('/')[2]
    const body = await request.json().catch(() => ({}))
    const b = await db.collection('bounties').findOne({ id })
    if (!b) return handleCORS(NextResponse.json({ error: 'Bounty not found' }, { status: 404 }))
    if (b.posterId !== user.id && user.role !== 'super_admin') {
      return handleCORS(NextResponse.json({ error: 'Only the poster can change bounty state' }, { status: 403 }))
    }
    const next = String(body.state || '')
    if (!validateTransition(b.state, next, wi.BOUNTY_TRANSITIONS)) {
      return handleCORS(NextResponse.json({
        error: `Invalid transition: ${b.state} → ${next}`,
        allowed: wi.BOUNTY_TRANSITIONS[b.state] || [],
      }, { status: 400 }))
    }
    await db.collection('bounties').updateOne({ id }, {
      $set: { state: next, updatedAt: new Date() },
      $push: { stateHistory: { state: next, at: new Date(), by: user.id } },
    })
    const updated = await db.collection('bounties').findOne({ id })
    return handleCORS(NextResponse.json({ bounty: clean(updated) }))
  }

  // POST /bounties/:id/contribute { amountUsd }
  // Anyone can contribute. Auto-transitions to goal_reached when funding goal hit.
  if (method === 'POST' && /^\/bounties\/[^/]+\/contribute$/.test(route)) {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const id = route.split('/')[2]
    const body = await request.json().catch(() => ({}))
    const amountUsd = Number(body.amountUsd)
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return handleCORS(NextResponse.json({ error: 'amountUsd must be a positive number' }, { status: 400 }))
    }
    if (amountUsd > 100000) {
      return handleCORS(NextResponse.json({ error: 'amountUsd exceeds maximum' }, { status: 400 }))
    }
    const b = await db.collection('bounties').findOne({ id })
    if (!b) return handleCORS(NextResponse.json({ error: 'Bounty not found' }, { status: 404 }))
    if (!['funding', 'goal_reached'].includes(b.state)) {
      return handleCORS(NextResponse.json({ error: `Bounty not accepting contributions (state: ${b.state})` }, { status: 400 }))
    }
    const contribution = { userId: user.id, userName: user.name || user.email, amountUsd, contributedAt: new Date() }
    const newFunded = (b.fundedUsd || 0) + amountUsd
    const updates = {
      $push: { contributors: contribution },
      $set: { fundedUsd: newFunded, updatedAt: new Date() },
    }
    // Auto-transition to goal_reached
    if (b.state === 'funding' && newFunded >= (b.fundingGoalUsd || 0) && (b.fundingGoalUsd || 0) > 0) {
      updates.$set.state = 'goal_reached'
      updates.$push.stateHistory = { state: 'goal_reached', at: new Date(), by: user.id, reason: 'goal_auto_reached' }
    }
    await db.collection('bounties').updateOne({ id }, updates)
    const updated = await db.collection('bounties').findOne({ id })
    return handleCORS(NextResponse.json({ bounty: clean(updated), contribution }))
  }

  // POST /bounties/:id/claim — contractor claims after goal_reached.
  if (method === 'POST' && /^\/bounties\/[^/]+\/claim$/.test(route)) {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const id = route.split('/')[2]
    const b = await db.collection('bounties').findOne({ id })
    if (!b) return handleCORS(NextResponse.json({ error: 'Bounty not found' }, { status: 404 }))
    if (b.state !== 'goal_reached') {
      return handleCORS(NextResponse.json({ error: `Bounty cannot be claimed (state: ${b.state})` }, { status: 400 }))
    }
    if (b.claimedContractorId) {
      return handleCORS(NextResponse.json({ error: 'Bounty already claimed' }, { status: 409 }))
    }
    // Create a work order
    const woId = rid()
    const wo = wi.newWorkOrderDoc({
      id: woId, sourceKind: 'bounty', sourceId: id,
      posterId: b.posterId, contractorId: user.id,
      scope: b.title, budget: b.fundedUsd,
    })
    await db.collection('work_orders').insertOne(wo)
    await db.collection('bounties').updateOne({ id }, {
      $set: { claimedContractorId: user.id, workOrderId: woId, state: 'claimed', updatedAt: new Date() },
      $push: { stateHistory: { state: 'claimed', at: new Date(), by: user.id } },
    })
    const updated = await db.collection('bounties').findOne({ id })
    return handleCORS(NextResponse.json({ bounty: clean(updated), workOrder: clean(wo) }))
  }

  // ───── VOLUNTEER EVENTS ─────────────────────────────────────────────────
  if (route === '/volunteer-events' && method === 'POST') {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const body = await request.json().catch(() => ({}))
    const doc = wi.newVolunteerEventDoc({ id: rid(), organizerId: user.id, ...body })
    await db.collection('volunteer_events').insertOne(doc)
    return handleCORS(NextResponse.json({ event: clean(doc) }, { status: 201 }))
  }
  if (route === '/volunteer-events' && method === 'GET') {
    const url = new URL(request.url)
    const q = {}
    if (url.searchParams.get('state')) q.state = url.searchParams.get('state')
    const rows = await db.collection('volunteer_events').find(q).sort({ scheduledFor: 1, createdAt: -1 }).limit(100).toArray()
    return handleCORS(NextResponse.json({ events: rows.map(clean) }))
  }
  if (method === 'GET' && /^\/volunteer-events\/[^/]+$/.test(route)) {
    const id = route.split('/').pop()
    const e = await db.collection('volunteer_events').findOne({ id })
    if (!e) return handleCORS(NextResponse.json({ error: 'Event not found' }, { status: 404 }))
    return handleCORS(NextResponse.json({ event: clean(e) }))
  }
  if (method === 'PATCH' && /^\/volunteer-events\/[^/]+\/state$/.test(route)) {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const id = route.split('/')[2]
    const body = await request.json().catch(() => ({}))
    const e = await db.collection('volunteer_events').findOne({ id })
    if (!e) return handleCORS(NextResponse.json({ error: 'Event not found' }, { status: 404 }))
    if (e.organizerId !== user.id && user.role !== 'super_admin') {
      return handleCORS(NextResponse.json({ error: 'Only the organizer can change event state' }, { status: 403 }))
    }
    const next = String(body.state || '')
    if (!validateTransition(e.state, next, wi.VOLUNTEER_TRANSITIONS)) {
      return handleCORS(NextResponse.json({
        error: `Invalid transition: ${e.state} → ${next}`,
        allowed: wi.VOLUNTEER_TRANSITIONS[e.state] || [],
      }, { status: 400 }))
    }
    await db.collection('volunteer_events').updateOne({ id }, {
      $set: { state: next, updatedAt: new Date() },
      $push: { stateHistory: { state: next, at: new Date(), by: user.id } },
    })
    const updated = await db.collection('volunteer_events').findOne({ id })
    return handleCORS(NextResponse.json({ event: clean(updated) }))
  }

  // ───── WORK ORDERS (read-only foundation) ───────────────────────────────
  if (route === '/work-orders' && method === 'GET') {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const url = new URL(request.url)
    const as = url.searchParams.get('as') || 'contractor'
    const q = as === 'poster' ? { posterId: user.id } : { contractorId: user.id }
    const rows = await db.collection('work_orders').find(q).sort({ createdAt: -1 }).limit(100).toArray()
    return handleCORS(NextResponse.json({ workOrders: rows.map(clean) }))
  }
  if (method === 'GET' && /^\/work-orders\/[^/]+$/.test(route)) {
    const { user, err } = await requireAuth(ctx); if (err) return err
    const id = route.split('/').pop()
    const wo = await db.collection('work_orders').findOne({ id })
    if (!wo) return handleCORS(NextResponse.json({ error: 'Work order not found' }, { status: 404 }))
    if (wo.posterId !== user.id && wo.contractorId !== user.id && user.role !== 'super_admin') {
      return handleCORS(NextResponse.json({ error: 'Not authorised to view this work order' }, { status: 403 }))
    }
    return handleCORS(NextResponse.json({ workOrder: clean(wo) }))
  }

  return null
}
