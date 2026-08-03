// handlers/activityHub.js
// ----------------------------------------------------------------------------
// Activity Hub — UNIFIED on `community_posts` as the single source of truth
// (P0 fix Jun 2026). All user-authored posts live in `community_posts`, share
// the same reactions / comments / saves / views infrastructure, and render the
// SAME detail page at /community/posts/:id.
//
// Endpoints owned here:
//   GET  /api/activity-hub/feed?filter=…&limit=…&before=…
//        Paginated feed: user posts + aggregated system activity
//        (jobs, bounties, facility alerts).
//   POST /api/activity-hub/posts
//        Universal create. Writes to `community_posts`.
//        Mapping type → category (kept for back-compat with old card type filters):
//          general          → general
//          facility_update  → facility_update
//          illegal_dumping  → illegal_dumping
//          safety_alert     → safety_alert
//          contractor_tip   → contractor_tip
//          donation_need    → donation_need
//          free_item        → free_items
//          government_notice→ agency_notice
//          job              → pickup_request   (legacy)
//          bounty           → general          (bounties have their own collection;
//                                              we keep a marker post in community)
//
//   POST /api/activity-hub/posts/:id/save     — toggle bookmark
//   GET  /api/activity-hub/saved              — list saved posts for current user
//
// Like / comment / react / view-count endpoints all live under the existing
// /api/community/posts/:id/* routes in route.js — no duplication.
// ----------------------------------------------------------------------------

const VALID_TYPES = [
  'facility_update', 'job', 'bounty', 'donation_need', 'free_item',
  'illegal_dumping', 'safety_alert', 'contractor_tip', 'government_notice', 'general',
  'traffic', 'wait_time',
]

const FILTER_TO_TYPES = {
  all:        VALID_TYPES,
  alerts:     ['illegal_dumping', 'safety_alert'],
  jobs:       ['job'],
  bounties:   ['bounty'],
  donations:  ['donation_need', 'free_item'],
  facilities: ['facility_update', 'traffic', 'wait_time'],
  tips:       ['contractor_tip'],
  government: ['government_notice'],
  saved:      VALID_TYPES, // server-side filter applied via savedByMe
  mine:       VALID_TYPES, // server-side filter applied via authorId (own posts only)
}

// Map Activity Hub `type` → `community_posts.category` (the storage column).
const TYPE_TO_CATEGORY = {
  general:          'general',
  facility_update:  'facility_update',
  illegal_dumping:  'illegal_dumping',
  safety_alert:     'safety_alert',
  contractor_tip:   'contractor_tip',
  donation_need:    'donation_need',
  free_item:        'free_items',
  government_notice:'agency_notice',
  job:              'pickup_request',
  bounty:           'general',
  traffic:          'facility_update',
  wait_time:        'facility_update',
}

// Reverse map (category → type) for the card output shape.
const CATEGORY_TO_TYPE = {
  general:         'general',
  facility_update: 'facility_update',
  illegal_dumping: 'illegal_dumping',
  safety_alert:    'safety_alert',
  contractor_tip:  'contractor_tip',
  donation_need:   'donation_need',
  free_items:      'free_item',
  agency_notice:   'government_notice',
  pickup_request:  'job',
}

// Allowed live-status signals a Facility Update post can carry.
const FACILITY_LIVE_SIGNALS = [
  'busy', 'slow', 'not_busy', 'closed',
  'accepting', 'not_accepting',
  'long_wait', 'very_busy', 'scale_issue', 'gate_closed',
  'price_update', 'safety_alert',
]

function clean(d) { if (!d) return d; const { _id, ...r } = d; return r }
function rid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'ah_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

async function loadUser(ctx) {
  const auth = ctx.getAuth(ctx.request); if (!auth) return null
  return await ctx.db.collection('users').findOne({ id: auth.id })
}

function jobToCard(j) {
  return {
    id: 'job_' + j.id, kind: 'aggregate', sourceId: j.id, type: 'job',
    title: j.title, description: j.description, budget: j.budget,
    location: j.location, photos: j.photos || [], state: j.state,
    posterId: j.posterId, createdAt: j.createdAt, href: `/jobs/${j.id}`,
  }
}
function bountyToCard(b) {
  return {
    id: 'bounty_' + b.id, kind: 'aggregate', sourceId: b.id, type: 'bounty',
    title: b.title, description: b.description,
    fundingGoalUsd: b.fundingGoalUsd, fundedUsd: b.fundedUsd,
    location: b.location, photos: b.photos || [], state: b.state,
    posterId: b.posterId, createdAt: b.createdAt, href: `/bounties/${b.id}`,
  }
}
function alertToCard(a) {
  return {
    id: 'alert_' + a.id, kind: 'aggregate', sourceId: a.id, type: 'facility_update',
    title: a.message || a.text || (a.type || '').replace(/_/g, ' '),
    description: a.text || '', photos: [],
    facilityId: a.facilityId, location: {},
    state: a.status || 'active', posterId: a.userId, createdAt: a.createdAt,
    href: a.facilityId ? `/facilities/${a.facilityId}` : null,
  }
}

// Build a card from a community_posts row. `me` is current user id (or null).
// `authorMap` is a Map keyed by authorId.
// `reactionMap` and `saveSet` are looked up by post id.
function postToCard(p, { authorMap = new Map(), reactionMap = new Map(), saveSet = new Set() } = {}) {
  const author = authorMap.get(p.authorId) || null
  return {
    id: p.id,
    kind: 'post',
    sourceId: p.id,
    type: CATEGORY_TO_TYPE[p.category] || p.category || 'general',
    category: p.category || 'general',
    title: p.title || '',
    description: p.body || '',
    photos: Array.isArray(p.photos) ? p.photos : [],
    location: p.location || '',
    city: p.city || '',
    state: p.state || '',
    facilityId: p.relatedFacilityId || null,
    facilityLiveSignal: p.facilityLiveSignal || null,
    isOfficial: !!p.isOfficial,
    urgency: p.urgency || 'normal',
    posterId: p.authorId,
    author: author ? {
      id: author.id,
      name: author.name || author.email?.split('@')[0] || 'User',
      avatarUrl: author.profilePhotoUrl || author.avatarUrl || null,
      verificationLevel: author.verificationLevel || 'normal_user',
      role: author.role || 'normal_user',
    } : null,
    likes: p.reactionCount || 0,
    comments: p.commentCount || 0,
    views: p.viewCount || 0,
    saves: p.saveCount || 0,
    myReaction: reactionMap.get(p.id) || null,
    savedByMe: saveSet.has(p.id),
    createdAt: p.createdAt,
    href: `/community/posts/${p.id}`,
  }
}

export async function handle(ctx) {
  const { route, method, request, db, NextResponse, handleCORS, getAuth, uuidv4 } = ctx

  // ============================================================================
  // GET /activity-hub/feed
  // ============================================================================
  if (route === '/activity-hub/feed' && method === 'GET') {
    const url = new URL(request.url)
    const filter = (url.searchParams.get('filter') || 'all').toLowerCase()
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 20)))
    const before = url.searchParams.get('before') // ISO timestamp for pagination cursor
    const auth = getAuth(request)

    const wantTypes = FILTER_TO_TYPES[filter] || VALID_TYPES
    // Translate filter types → category storage values for the DB query.
    const wantCategories = wantTypes.map((t) => TYPE_TO_CATEGORY[t] || t).filter(Boolean)
    const uniqueCategories = [...new Set(wantCategories)]

    // 1) USER-AUTHORED POSTS from community_posts
    const postFilter = { status: { $ne: 'removed' } }
    if (filter !== 'all' && filter !== 'mine' && uniqueCategories.length) postFilter.category = { $in: uniqueCategories }
    // "My Posts" — constrain to the caller's own posts at the DB level.
    if (filter === 'mine' && auth) postFilter.authorId = auth.id
    if (before) {
      try { postFilter.createdAt = { $lt: new Date(before) } } catch {}
    }
    const posts = await db.collection('community_posts').find(postFilter)
      .sort({ createdAt: -1 }).limit(limit * 2).toArray()

    // Author + reaction + save enrichment
    const authorIds = [...new Set(posts.map((p) => p.authorId).filter(Boolean))]
    const authors = authorIds.length
      ? await db.collection('users').find(
          { id: { $in: authorIds } },
          { projection: { id: 1, name: 1, email: 1, avatarUrl: 1, profilePhotoUrl: 1, verificationLevel: 1, role: 1 } },
        ).toArray()
      : []
    const authorMap = new Map(authors.map((u) => [u.id, u]))
    let reactionMap = new Map()
    let saveSet = new Set()
    if (auth) {
      const postIds = posts.map((p) => p.id)
      if (postIds.length) {
        const [rxs, saves] = await Promise.all([
          db.collection('community_reactions').find({
            userId: auth.id, targetKind: 'post', targetId: { $in: postIds },
          }, { projection: { targetId: 1, type: 1 } }).toArray(),
          db.collection('community_saves').find({
            userId: auth.id, postId: { $in: postIds },
          }, { projection: { postId: 1 } }).toArray(),
        ])
        reactionMap = new Map(rxs.map((r) => [r.targetId, r.type]))
        saveSet = new Set(saves.map((s) => s.postId))
      }
    }
    const cards = posts.map((p) => postToCard(p, { authorMap, reactionMap, saveSet }))

    // 2) AGGREGATED SYSTEM ACTIVITY (only when filter allows).
    // Skipped entirely for "mine" / "saved", which show only user-authored posts.
    const wantAggregates = filter !== 'mine' && filter !== 'saved'
    if (wantAggregates && wantTypes.includes('job')) {
      try {
        const jobs = await db.collection('jobs').find({ state: { $in: ['open', 'in_review', 'awarded'] } })
          .sort({ createdAt: -1 }).limit(limit).toArray()
        cards.push(...jobs.map(jobToCard))
      } catch {}
    }
    if (wantAggregates && wantTypes.includes('bounty')) {
      try {
        const bounties = await db.collection('bounties').find({ state: { $in: ['funding', 'goal_reached'] } })
          .sort({ createdAt: -1 }).limit(limit).toArray()
        cards.push(...bounties.map(bountyToCard))
      } catch {}
    }
    if (wantAggregates && wantTypes.includes('facility_update')) {
      try {
        const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const alerts = await db.collection('facility_alerts').find({
          createdAt: { $gte: recentCutoff },
          status: { $ne: 'resolved' },
        }).sort({ createdAt: -1 }).limit(limit).toArray()
        cards.push(...alerts.map(alertToCard))
      } catch {}
    }
    cards.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    // If filter=saved, gate to only posts the user saved.
    let final = cards
    if (filter === 'saved') {
      final = auth ? final.filter((c) => c.kind === 'post' && c.savedByMe) : []
    }
    // If filter=mine, only the caller's own posts (empty when signed out).
    if (filter === 'mine') {
      final = auth ? final.filter((c) => c.kind === 'post' && c.posterId === auth.id) : []
    }
    return handleCORS(NextResponse.json({ feed: final.slice(0, limit), filter, count: final.length }))
  }

  // ============================================================================
  // GET /facilities/:id/updates
  // Recent facility check-ins (status history) for a specific facility.
  // Powers the "Recent Updates" section on the facility detail page.
  // ============================================================================
  if (method === 'GET' && /^\/facilities\/[^/]+\/updates$/.test(route)) {
    const facilityId = route.split('/')[2]
    const url2 = new URL(request.url)
    const limit = Math.min(50, Math.max(1, Number(url2.searchParams.get('limit') || 20)))
    const posts = await db.collection('community_posts').find({
      category: 'facility_update',
      relatedFacilityId: facilityId,
      status: { $ne: 'removed' },
    }).sort({ createdAt: -1 }).limit(limit).toArray()
    const authorIds = [...new Set(posts.map((p) => p.authorId).filter(Boolean))]
    const authors = authorIds.length
      ? await db.collection('users').find(
          { id: { $in: authorIds } },
          { projection: { id: 1, name: 1, email: 1, avatarUrl: 1, profilePhotoUrl: 1, verificationLevel: 1 } },
        ).toArray()
      : []
    const authorMap = new Map(authors.map((u) => [u.id, u]))
    const updates = posts.map((p) => {
      const a = authorMap.get(p.authorId)
      return {
        id: p.id,
        signal: p.facilityLiveSignal || null,
        title: p.title || '',
        body: p.body || '',
        photos: Array.isArray(p.photos) ? p.photos : [],
        createdAt: p.createdAt,
        author: a ? {
          id: a.id,
          name: a.name || a.email?.split('@')[0] || 'User',
          avatarUrl: a.profilePhotoUrl || a.avatarUrl || null,
          verificationLevel: a.verificationLevel || 'normal_user',
        } : null,
      }
    })
    return handleCORS(NextResponse.json({ updates, count: updates.length }))
  }

  // ============================================================================
  // POST /activity-hub/posts — universal post creator
  // Writes to `community_posts` (the single source of truth).
  // ============================================================================
  if (route === '/activity-hub/posts' && method === 'POST') {
    const user = await loadUser(ctx)
    if (!user) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const body = await request.json().catch(() => ({}))
    const type = String(body.type || 'general').toLowerCase()
    if (!VALID_TYPES.includes(type)) {
      return handleCORS(NextResponse.json({ error: `Invalid type. One of: ${VALID_TYPES.join(', ')}` }, { status: 400 }))
    }

    // Role gates
    const role = String(user.role || '').toLowerCase()
    const profileType = String(user.profileType || '').toLowerCase()
    if (type === 'government_notice') {
      if (!['government', 'super_admin'].includes(profileType) && !['super_admin', 'admin'].includes(role)) {
        return handleCORS(NextResponse.json({ error: 'Only government accounts can post government notices' }, { status: 403 }))
      }
    }
    if (type === 'contractor_tip') {
      if (!['contractor'].includes(profileType) && !user.verifiedContractor && !['super_admin', 'admin'].includes(role)) {
        return handleCORS(NextResponse.json({ error: 'Only verified contractors can post tips' }, { status: 403 }))
      }
    }

    const category = TYPE_TO_CATEGORY[type] || 'general'
    const facilityId = body.facilityId || body.relatedFacilityId || null
    const facilityLiveSignal = body.facilityLiveSignal && FACILITY_LIVE_SIGNALS.includes(body.facilityLiveSignal)
      ? body.facilityLiveSignal : null

    const post = {
      id: rid(),
      authorId: user.id,
      category,
      // Carry the canonical Activity Hub type alongside category so the feed
      // card UI can switch on either (some filters use type-level granularity).
      type,
      title: String(body.title || '').slice(0, 160),
      body: String(body.body || body.text || '').slice(0, 4000),
      photos: Array.isArray(body.photos) ? body.photos.slice(0, 10) : [],
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 10) : [],
      location: String(body.location || '').slice(0, 200),
      city: String(body.city || '').slice(0, 80),
      state: String(body.state || '').slice(0, 40),
      zip: String(body.zip || '').slice(0, 12),
      lat: body.lat != null && body.lat !== '' ? parseFloat(body.lat) : null,
      lng: body.lng != null && body.lng !== '' ? parseFloat(body.lng) : null,
      urgency: ['low', 'normal', 'high'].includes(body.urgency) ? body.urgency : 'normal',
      relatedFacilityId: facilityId,
      facilityLiveSignal,
      groupId: body.groupId || null,
      isOfficial: ['super_admin', 'admin'].includes(role) && category === 'agency_notice',
      status: 'active',
      reactionCount: 0,
      reactions: {},
      commentCount: 0,
      viewCount: 0,
      saveCount: 0,
      reportCount: 0,
      pinned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await db.collection('community_posts').insertOne(post)

    // --------------------------------------------------------------------
    // Facility live-status sync. When the post is a Facility Update and
    // carries a `facilityLiveSignal`, mirror it onto the facility record so
    // facility page + map pins pick it up instantly.
    // --------------------------------------------------------------------
    if (facilityId && facilityLiveSignal) {
      try {
        await db.collection('facilities').updateOne(
          { id: facilityId },
          { $set: {
              liveStatus: facilityLiveSignal,
              liveStatusUpdatedAt: new Date(),
              liveStatusUpdatedBy: user.id,
              liveStatusPostId: post.id,
              liveStatusNote: post.title || post.body?.slice(0, 200) || '',
            } },
        )
      } catch {}
    }

    return handleCORS(NextResponse.json({ post: clean(post) }, { status: 201 }))
  }

  // ============================================================================
  // POST /activity-hub/posts/:id/save — toggle bookmark
  // ============================================================================
  if (method === 'POST' && /^\/activity-hub\/posts\/[^/]+\/save$/.test(route)) {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const id = route.split('/')[3]
    const post = await db.collection('community_posts').findOne({ id })
    if (!post) return handleCORS(NextResponse.json({ error: 'Post not found' }, { status: 404 }))
    const existing = await db.collection('community_saves').findOne({ userId: auth.id, postId: id })
    if (existing) {
      await db.collection('community_saves').deleteOne({ id: existing.id })
      await db.collection('community_posts').updateOne({ id }, { $inc: { saveCount: -1 } })
      return handleCORS(NextResponse.json({ saved: false, saveCount: Math.max(0, (post.saveCount || 1) - 1) }))
    }
    await db.collection('community_saves').insertOne({
      id: uuidv4(), userId: auth.id, postId: id, createdAt: new Date(),
    })
    await db.collection('community_posts').updateOne({ id }, { $inc: { saveCount: 1 } })
    return handleCORS(NextResponse.json({ saved: true, saveCount: (post.saveCount || 0) + 1 }))
  }

  // ============================================================================
  // GET /activity-hub/saved — list saved posts (for the "Saved" tab)
  // ============================================================================
  if (route === '/activity-hub/saved' && method === 'GET') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const saves = await db.collection('community_saves').find({ userId: auth.id }).sort({ createdAt: -1 }).limit(200).toArray()
    const ids = saves.map((s) => s.postId)
    if (!ids.length) return handleCORS(NextResponse.json({ feed: [], count: 0 }))
    const posts = await db.collection('community_posts').find({ id: { $in: ids }, status: { $ne: 'removed' } }).toArray()
    const authorIds = [...new Set(posts.map((p) => p.authorId).filter(Boolean))]
    const authors = authorIds.length
      ? await db.collection('users').find(
          { id: { $in: authorIds } },
          { projection: { id: 1, name: 1, email: 1, avatarUrl: 1, profilePhotoUrl: 1, verificationLevel: 1, role: 1 } },
        ).toArray()
      : []
    const authorMap = new Map(authors.map((u) => [u.id, u]))
    const rxs = await db.collection('community_reactions').find({
      userId: auth.id, targetKind: 'post', targetId: { $in: ids },
    }).toArray()
    const reactionMap = new Map(rxs.map((r) => [r.targetId, r.type]))
    const saveSet = new Set(ids)
    const cards = posts.map((p) => postToCard(p, { authorMap, reactionMap, saveSet }))
    cards.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    return handleCORS(NextResponse.json({ feed: cards, count: cards.length }))
  }

  return null
}
