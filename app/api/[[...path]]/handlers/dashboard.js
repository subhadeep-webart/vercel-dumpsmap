// PR-2b: Dashboard Activity Hub handler
//
// Endpoint: GET /api/dashboard/feed
// Returns a personalized merged feed for the logged-in user combining:
//   • Recent live alerts (last 24h, max 6)
//   • Recent community posts (last 7 days, max 6)
//   • Active hot-spot jobs (max 4)
//   • Marketplace listings recently posted in user's area (max 4)
//   • Mini saved-items preview (saved marketplace listings, max 4)
//   • Quick stats (role-aware: trips this month for contractors; items posted for residents)
//
// All data is best-effort; missing collections fail silently.

import { hasContractorAccess } from '../../../../lib/contractor-access.js'
import { resolveMarketplaceRole } from '../../../../lib/marketplace-roles.js'

function timeAgoDate(d) {
  return d ? new Date(d).toISOString() : null
}

async function safeMany(promise) {
  try { return await promise } catch { return [] }
}

export async function handle(ctx) {
  const { route, method, request, db, getAuth, clean, NextResponse, handleCORS } = ctx
  if (route !== '/dashboard/feed' || method !== 'GET') return null

  const auth = getAuth(request)
  if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
  const userRow = await db.collection('users').findOne({ id: auth.id })
  if (!userRow) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))

  const role = resolveMarketplaceRole(userRow)
  const contractor = hasContractorAccess(userRow)
  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // -- Alerts (last 24h) ---------------------------------------------------
  const alerts = await safeMany(
    db.collection('alerts')
      .find({ createdAt: { $gte: sinceDay } })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray()
  )

  // -- Community posts (last 7d) -------------------------------------------
  const posts = await safeMany(
    db.collection('community_posts')
      .find({ deleted: { $ne: true }, createdAt: { $gte: sinceWeek } })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray()
  )

  // -- Active hot-spot jobs ------------------------------------------------
  const hotSpots = await safeMany(
    db.collection('jobs')
      .find({ status: { $in: ['open', 'active'] }, $or: [{ isHotSpot: true }, { urgency: 'urgent' }, { urgency: 'high' }] })
      .sort({ createdAt: -1 })
      .limit(4)
      .toArray()
  )

  // -- Fresh marketplace listings ------------------------------------------
  const marketplace = await safeMany(
    db.collection('marketplace_listings')
      .find({ status: { $ne: 'deleted' }, itemStatus: { $in: [null, 'available', 'on_truck', 'at_site', 'last_chance', 'reserved'] } })
      .sort({ createdAt: -1 })
      .limit(4)
      .toArray()
  )

  // -- Saved items preview --------------------------------------------------
  const savedRows = await safeMany(
    db.collection('marketplace_saves').find({ userId: auth.id }).sort({ createdAt: -1 }).limit(4).toArray()
  )
  const savedIds = savedRows.map((s) => s.listingId).filter(Boolean)
  const savedListings = savedIds.length
    ? await safeMany(db.collection('marketplace_listings').find({ id: { $in: savedIds } }).toArray())
    : []

  // -- Quick stats (role-aware) -------------------------------------------
  const stats = { role: role.key, label: role.label, contractor }
  if (contractor) {
    const monthStart = new Date()
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
    const monthIso = monthStart.toISOString().slice(0, 10)
    const receipts = await safeMany(
      db.collection('dump_receipts')
        .find({ userId: auth.id, deleted: { $ne: true }, dateOf: { $gte: monthIso } })
        .toArray()
    )
    let cost = 0, tons = 0
    for (const r of receipts) { cost += Number(r.totalCost || 0); tons += Number(r.netTons || 0) }
    stats.contractor = {
      tripsThisMonth: receipts.length,
      totalCostThisMonth: Number(cost.toFixed(2)),
      totalTonsThisMonth: Number(tons.toFixed(2)),
    }
  }
  // Resident-ish stats
  const [myListings, myPosts, myJobs] = await Promise.all([
    safeMany(db.collection('marketplace_listings').countDocuments({ sellerId: auth.id, status: { $ne: 'deleted' } })),
    safeMany(db.collection('community_posts').countDocuments({ userId: auth.id, deleted: { $ne: true } })),
    safeMany(db.collection('jobs').countDocuments({ posterId: auth.id })),
  ])
  stats.activity = {
    myListings: typeof myListings === 'number' ? myListings : 0,
    myPosts: typeof myPosts === 'number' ? myPosts : 0,
    myJobs: typeof myJobs === 'number' ? myJobs : 0,
  }

  // -- Merged "What's Happening Now" feed -----------------------------------
  const feed = []
  for (const a of alerts) {
    feed.push({
      kind: 'alert',
      id: a.id,
      title: a.facilityName || 'Facility update',
      body: a.text || '',
      facilityId: a.facilityId || null,
      tone: a.severity === 'high' ? 'red' : a.severity === 'low' ? 'green' : 'amber',
      createdAt: timeAgoDate(a.createdAt),
      href: a.facilityId ? `/facilities/${a.facilityId}` : null,
    })
  }
  for (const p of posts) {
    feed.push({
      kind: 'post',
      id: p.id,
      title: p.title || p.category || 'Community post',
      body: (p.body || '').slice(0, 220),
      city: p.city || null,
      tone: p.category === 'illegal_dumping' ? 'red' : 'blue',
      createdAt: timeAgoDate(p.createdAt),
      href: `/community/posts/${p.id}`,
    })
  }
  for (const j of hotSpots) {
    feed.push({
      kind: 'job',
      id: j.id,
      title: j.title || 'Hot spot job',
      body: j.description ? String(j.description).slice(0, 180) : '',
      city: j.city || null,
      tone: 'red',
      createdAt: timeAgoDate(j.createdAt),
      href: `/jobs/${j.id}`,
    })
  }
  feed.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  return handleCORS(NextResponse.json({
    user: { id: userRow.id, name: userRow.name, email: userRow.email, role: userRow.role, primaryProfile: userRow.primaryProfile },
    stats,
    feed: feed.slice(0, 14),
    hotSpots: hotSpots.map(clean),
    marketplaceFresh: marketplace.map(clean),
    savedItems: savedListings.map(clean),
  }))
}
