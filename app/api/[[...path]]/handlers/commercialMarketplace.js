// PR-2c: Commercial B2B Marketplace
//
// Scope:
//   • A separate listing tier that lives in the existing
//     `marketplace_listings` collection, distinguished by
//     marketplaceType === 'b2b'. We deliberately share the collection
//     with residential listings so messaging / offers / reserve / mark-sold
//     (PR-1c infrastructure) can be reused unchanged. The B2B tab simply
//     filters on this flag.
//
//   • Posting / messaging / offers / reserve / mark-sold are gated on
//     hasCommercialAccess(user) — see /app/lib/commercial-access.js.
//     Anonymous and non-approved users can still browse + search.
//
//   • A separate `commercial_access_applications` collection stores
//     applications submitted by users who don't auto-qualify. The
//     hybrid auto-approval logic is in commercial-access.js:
//     decideApplicationStatus(user).
//
// Endpoints:
//   GET    /api/marketplace/commercial             (public)  list+search B2B
//   POST   /api/marketplace/commercial             (gated)   create
//   GET    /api/marketplace/commercial/:id         (public)  detail
//   PATCH  /api/marketplace/commercial/:id         (owner)   update
//   DELETE /api/marketplace/commercial/:id         (owner)   delete
//
//   GET    /api/commercial-access/me               (auth)    current user's status
//   POST   /api/commercial-access/apply            (auth)    submit application
//
//   GET    /api/admin/commercial-access            (staff)   queue
//   PATCH  /api/admin/commercial-access/:id        (staff)   approve/deny/info/suspend

const { v4: uuidv4 } = require('uuid')
const {
  hasCommercialAccess,
  commercialAccessReason,
  decideApplicationStatus,
  normalizeCommercialRole,
  normalizeSellerType,
  normalizeB2BCategory,
  isStaffRole,
  B2B_CATEGORIES,
  COMMERCIAL_ROLES,
  COMMERCIAL_SELLER_TYPES,
} = require('../../../../lib/commercial-access')

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'for_parts', 'refurbished', 'used']

function clampStr(v, max) {
  return String(v || '').slice(0, max).trim()
}
function clampNum(v, min, max, fallback) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, min), max)
}

// Decide what a fresh user's seller type is, based on existing roles.
// (Used when auto-stamping the seller type onto a listing if the seller
//  didn't pick one explicitly.)
function inferSellerType(user) {
  if (!user) return null
  const cRoles = (user.commercialRoles || []).map((r) => String(r).toLowerCase())
  for (const r of cRoles) {
    if (COMMERCIAL_SELLER_TYPES.includes(r)) return r
  }
  const contractorRoles = (user.contractorRoles || []).map((r) => String(r).toLowerCase())
  if (contractorRoles.includes('recycler')) return 'recycler'
  if (contractorRoles.some((r) => ['contractor', 'hauler'].includes(r))) return 'contractor'
  return null
}

function publicListing(l) {
  if (!l) return null
  // Drop Mongo _id, normalize dates, expose only public fields
  const { _id, ...clean } = l
  return clean
}

async function loadSellerSummary(db, sellerId) {
  if (!sellerId) return null
  const u = await db.collection('users').findOne({ id: sellerId })
  if (!u) return null
  return {
    id: u.id,
    name: u.name || u.email || 'Member',
    email: undefined,                                  // never expose
    profileImage: u.profileImage || null,
    verificationLevel: u.verificationLevel || null,
    commercialMembership: u.commercialMembership || 'free',
    commercialAccessStatus: u.commercialAccessStatus || null,
    commercialRoles: Array.isArray(u.commercialRoles) ? u.commercialRoles : [],
    contractorRoles: Array.isArray(u.contractorRoles) ? u.contractorRoles : [],
    companyName: u.companyName || null,
    city: u.city || null,
    state: u.state || null,
  }
}

// Whether the seller's record indicates they're verified for the badge UI.
function isVerifiedForBadge(user) {
  if (!user) return false
  if (user.commercialMembership && ['verified', 'pro', 'enterprise'].includes(user.commercialMembership)) return true
  const vl = String(user.verificationLevel || '').toLowerCase()
  if (['verified_contractor', 'verified_recycler', 'verified_facility'].includes(vl)) return true
  return false
}

export async function handle(ctx) {
  const { route, method, request, db, getAuth, NextResponse, handleCORS, logActivity } = ctx
  const url = new URL(request.url)

  // ------------------------------------------------------------------ LIST
  if (route === '/marketplace/commercial' && method === 'GET') {
    const search = clampStr(url.searchParams.get('q'), 200)
    const category = normalizeB2BCategory(url.searchParams.get('category'))
    const condition = url.searchParams.get('condition')
    const city = clampStr(url.searchParams.get('city'), 80)
    const state = clampStr(url.searchParams.get('state'), 32)
    const sellerType = normalizeSellerType(url.searchParams.get('sellerType'))
    const minPrice = url.searchParams.get('minPrice')
    const maxPrice = url.searchParams.get('maxPrice')
    const limit = clampNum(url.searchParams.get('limit'), 1, 200, 60)
    const verifiedOnly = url.searchParams.get('verifiedOnly') === 'true'

    const query = {
      marketplaceType: 'b2b',
      status: { $ne: 'removed' },
      sold: { $ne: true },
    }
    if (category) query.b2bCategory = category
    if (condition && CONDITIONS.includes(condition)) query.condition = condition
    if (city) query.city = new RegExp('^' + city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    if (state) query.state = state.toUpperCase()
    if (sellerType) query.sellerType = sellerType
    if (verifiedOnly) query.sellerVerified = true
    if (search) {
      query.$or = [
        { title:       new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { description: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { materialTags: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ]
    }
    const min = Number(minPrice)
    const max = Number(maxPrice)
    if (Number.isFinite(min) || Number.isFinite(max)) {
      query.price = {}
      if (Number.isFinite(min)) query.price.$gte = min
      if (Number.isFinite(max)) query.price.$lte = max
    }

    const rows = await db.collection('marketplace_listings')
      .find(query)
      .sort({ membershipTier: -1, featured: -1, createdAt: -1 })
      .limit(limit)
      .toArray()

    return handleCORS(NextResponse.json({
      listings: rows.map(publicListing),
      total: rows.length,
      categories: B2B_CATEGORIES,
    }))
  }

  // ---------------------------------------------------------------- CREATE
  if (route === '/marketplace/commercial' && method === 'POST') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Sign in required to post a B2B listing.' }, { status: 401 }))
    const user = await db.collection('users').findOne({ id: auth.id })
    if (!user) return handleCORS(NextResponse.json({ error: 'Account not found' }, { status: 404 }))
    if (!hasCommercialAccess(user)) {
      return handleCORS(NextResponse.json({
        error: 'Commercial access required to post B2B listings.',
        reason: commercialAccessReason(user),
        applyUrl: '/marketplace?apply=1',
      }, { status: 403 }))
    }

    const body = await request.json().catch(() => ({}))
    const category = normalizeB2BCategory(body.category)
    if (!category) return handleCORS(NextResponse.json({ error: 'category is required' }, { status: 400 }))
    const title = clampStr(body.title, 140)
    if (!title) return handleCORS(NextResponse.json({ error: 'title is required' }, { status: 400 }))

    const sellerType = normalizeSellerType(body.sellerType) || inferSellerType(user) || 'contractor'
    const condition = CONDITIONS.includes(body.condition) ? body.condition : 'good'
    const price = typeof body.price === 'number' && Number.isFinite(body.price) ? body.price : null
    const quantity = Number.isFinite(Number(body.quantity)) ? Math.max(1, Math.min(99999, Math.round(Number(body.quantity)))) : 1

    const listing = {
      id: uuidv4(),
      sellerId: user.id,
      sellerName: user.companyName || user.name || user.email,
      sellerType,
      sellerVerified: isVerifiedForBadge(user),
      sellerMembership: user.commercialMembership || 'free',
      sellerCity: user.city || '',
      sellerState: user.state || '',

      // Discriminator: marks this listing as a B2B exchange item.
      marketplaceType: 'b2b',
      segment: 'commercial',
      kind: 'sell',

      // B2B-specific
      b2bCategory: category,
      title,
      description: clampStr(body.description, 4000),
      photos: Array.isArray(body.photos) ? body.photos.slice(0, 10) : [],
      price,
      priceType: price == null ? 'contact' : (body.priceType === 'obo' ? 'obo' : 'fixed'),
      acceptsOffers: !!body.acceptsOffers,
      currency: clampStr(body.currency, 8) || 'USD',
      quantity,
      condition,
      dimensions: clampStr(body.dimensions, 240),
      materialTags: Array.isArray(body.materialTags) ? body.materialTags.slice(0, 10).map((t) => clampStr(t, 40)) : [],

      // Location
      location: clampStr(body.location, 200),
      city: clampStr(body.city, 80),
      state: clampStr(body.state, 32).toUpperCase(),
      zip: clampStr(body.zip, 16),
      lat: typeof body.lat === 'number' ? body.lat : null,
      lng: typeof body.lng === 'number' ? body.lng : null,

      // Lifecycle
      status: 'active',
      itemStatus: 'available',
      sold: false,
      soldAt: null,
      reservation: null,
      featured: false,
      viewCount: 0,
      savedByUserIds: [],
      reportCount: 0,
      contactPreference: body.contactPreference || 'in_app',
      membershipTier: user.commercialMembership === 'pro' || user.commercialMembership === 'enterprise' ? 1 : 0,

      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days for B2B (vs 30 residential)
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await db.collection('marketplace_listings').insertOne(listing)
    try { await logActivity(db, user, 'marketplace.commercial.create', { kind: 'listing', id: listing.id, label: listing.title }, { category, sellerType, price }) } catch {}
    return handleCORS(NextResponse.json({ listing: publicListing(listing) }))
  }

  // ---------------------------------------------------------------- DETAIL
  const detailMatch = route.match(/^\/marketplace\/commercial\/([^/]+)$/)
  if (detailMatch && method === 'GET') {
    const id = detailMatch[1]
    const l = await db.collection('marketplace_listings').findOne({ id, marketplaceType: 'b2b' })
    if (!l) return handleCORS(NextResponse.json({ error: 'Listing not found' }, { status: 404 }))
    db.collection('marketplace_listings').updateOne({ id }, { $inc: { viewCount: 1 } }).catch(() => {})
    const seller = await loadSellerSummary(db, l.sellerId)
    return handleCORS(NextResponse.json({ listing: publicListing(l), seller }))
  }

  // ---------------------------------------------------------------- UPDATE
  if (detailMatch && method === 'PATCH') {
    const id = detailMatch[1]
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const l = await db.collection('marketplace_listings').findOne({ id, marketplaceType: 'b2b' })
    if (!l) return handleCORS(NextResponse.json({ error: 'Listing not found' }, { status: 404 }))
    const me = await db.collection('users').findOne({ id: auth.id })
    if (!me) return handleCORS(NextResponse.json({ error: 'Account not found' }, { status: 404 }))
    if (l.sellerId !== me.id && !isStaffRole(me.role)) {
      return handleCORS(NextResponse.json({ error: 'You do not own this listing' }, { status: 403 }))
    }
    const body = await request.json().catch(() => ({}))
    const update = { updatedAt: new Date() }
    if (body.title)        update.title = clampStr(body.title, 140)
    if (body.description != null) update.description = clampStr(body.description, 4000)
    if (body.b2bCategory)  { const c = normalizeB2BCategory(body.b2bCategory); if (c) update.b2bCategory = c }
    if (body.sellerType)   { const s = normalizeSellerType(body.sellerType);  if (s) update.sellerType = s }
    if (body.condition && CONDITIONS.includes(body.condition)) update.condition = body.condition
    if (typeof body.price === 'number' || body.price === null) update.price = body.price
    if (typeof body.quantity === 'number') update.quantity = Math.max(1, Math.min(99999, Math.round(body.quantity)))
    if (Array.isArray(body.photos))      update.photos = body.photos.slice(0, 10)
    if (Array.isArray(body.materialTags)) update.materialTags = body.materialTags.slice(0, 10)
    if (body.location != null) update.location = clampStr(body.location, 200)
    if (body.city != null)     update.city = clampStr(body.city, 80)
    if (body.state != null)    update.state = clampStr(body.state, 32).toUpperCase()
    if (body.zip != null)      update.zip = clampStr(body.zip, 16)
    if (body.status && ['active', 'paused', 'removed'].includes(body.status)) update.status = body.status
    await db.collection('marketplace_listings').updateOne({ id }, { $set: update })
    const fresh = await db.collection('marketplace_listings').findOne({ id })
    return handleCORS(NextResponse.json({ listing: publicListing(fresh) }))
  }

  // ---------------------------------------------------------------- DELETE
  if (detailMatch && method === 'DELETE') {
    const id = detailMatch[1]
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const l = await db.collection('marketplace_listings').findOne({ id, marketplaceType: 'b2b' })
    if (!l) return handleCORS(NextResponse.json({ error: 'Listing not found' }, { status: 404 }))
    const me = await db.collection('users').findOne({ id: auth.id })
    if (!me) return handleCORS(NextResponse.json({ error: 'Account not found' }, { status: 404 }))
    if (l.sellerId !== me.id && !isStaffRole(me.role)) {
      return handleCORS(NextResponse.json({ error: 'You do not own this listing' }, { status: 403 }))
    }
    await db.collection('marketplace_listings').updateOne({ id }, { $set: { status: 'removed', removedAt: new Date(), updatedAt: new Date() } })
    return handleCORS(NextResponse.json({ ok: true }))
  }

  // ------------------------------------------------------ ME (status check)
  if (route === '/commercial-access/me' && method === 'GET') {
    const auth = getAuth(request)
    if (!auth) {
      return handleCORS(NextResponse.json({
        loggedIn: false,
        hasAccess: false,
        reason: 'not_signed_in',
      }))
    }
    const me = await db.collection('users').findOne({ id: auth.id })
    if (!me) return handleCORS(NextResponse.json({ error: 'Account not found' }, { status: 404 }))
    return handleCORS(NextResponse.json({
      loggedIn: true,
      hasAccess: hasCommercialAccess(me),
      reason: commercialAccessReason(me),
      status: me.commercialAccessStatus || null,
      commercialRoles: me.commercialRoles || [],
      commercialMembership: me.commercialMembership || 'free',
      contractorRoles: me.contractorRoles || [],
      verificationLevel: me.verificationLevel || null,
    }))
  }

  // ------------------------------------------------------ APPLY
  if (route === '/commercial-access/apply' && method === 'POST') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Sign in required to apply' }, { status: 401 }))
    const me = await db.collection('users').findOne({ id: auth.id })
    if (!me) return handleCORS(NextResponse.json({ error: 'Account not found' }, { status: 404 }))

    const body = await request.json().catch(() => ({}))
    const requestedRole = normalizeCommercialRole(body.requestedRole)
    if (!requestedRole) {
      return handleCORS(NextResponse.json({
        error: `requestedRole must be one of: ${COMMERCIAL_ROLES.join(', ')}`,
      }, { status: 400 }))
    }
    const companyName = clampStr(body.companyName, 200)
    const website = clampStr(body.website, 240)
    const phone = clampStr(body.phone, 40)
    const businessDescription = clampStr(body.businessDescription, 2000)

    // Check for an open prior application
    const existing = await db.collection('commercial_access_applications').findOne({
      userId: me.id,
      status: { $in: ['pending', 'info_requested'] },
    })
    if (existing) {
      return handleCORS(NextResponse.json({
        ok: true,
        applicationId: existing.id,
        status: existing.status,
        message: 'You already have an application in review.',
      }))
    }

    const decision = decideApplicationStatus(me)
    const application = {
      id: uuidv4(),
      userId: me.id,
      userEmail: me.email,
      userName: me.name || me.email,
      requestedRole,
      companyName,
      website,
      phone,
      businessDescription,
      status: decision,                           // 'approved' (auto) or 'pending'
      submittedAt: new Date(),
      decidedAt: decision === 'approved' ? new Date() : null,
      decidedBy: decision === 'approved' ? 'auto' : null,
      decisionNote: decision === 'approved' ? 'Auto-approved (hybrid rule)' : null,
    }
    await db.collection('commercial_access_applications').insertOne(application)

    if (decision === 'approved') {
      const nextRoles = Array.from(new Set([...(me.commercialRoles || []), requestedRole]))
      await db.collection('users').updateOne(
        { id: me.id },
        { $set: {
            commercialRoles: nextRoles,
            commercialAccessStatus: 'approved',
            commercialApprovedAt: new Date(),
            commercialMembership: me.commercialMembership && me.commercialMembership !== 'free' ? me.commercialMembership : 'verified_commercial',
            commercialCompanyName: companyName || me.commercialCompanyName || null,
            commercialWebsite: website || me.commercialWebsite || null,
            commercialPhone: phone || me.commercialPhone || null,
          } }
      )
    } else {
      // pending
      await db.collection('users').updateOne(
        { id: me.id },
        { $set: { commercialAccessStatus: 'pending', commercialAppliedAt: new Date() } }
      )
    }

    try { await logActivity(db, me, 'commercial_access.apply', { kind: 'user', id: me.id, label: me.email }, { requestedRole, status: decision }) } catch {}

    return handleCORS(NextResponse.json({
      ok: true,
      applicationId: application.id,
      status: application.status,
      decisionNote: application.decisionNote,
      message: decision === 'approved'
        ? 'Approved — you can now post B2B listings.'
        : 'Application received. An admin will review shortly.',
    }))
  }

  // ----------------------------------------------- ADMIN: list applications
  if (route === '/admin/commercial-access' && method === 'GET') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const admin = await db.collection('users').findOne({ id: auth.id })
    if (!admin || !isStaffRole(admin.role)) {
      return handleCORS(NextResponse.json({ error: 'Admin access required' }, { status: 403 }))
    }
    const statusFilter = url.searchParams.get('status') || 'pending'
    const q = statusFilter === 'all' ? {} : { status: statusFilter }
    const apps = await db.collection('commercial_access_applications')
      .find(q)
      .sort({ submittedAt: -1 })
      .limit(500)
      .toArray()

    // Enrich with current user state
    const userIds = Array.from(new Set(apps.map((a) => a.userId).filter(Boolean)))
    const users = userIds.length ? await db.collection('users').find({ id: { $in: userIds } }).toArray() : []
    const userMap = new Map(users.map((u) => [u.id, u]))
    const enriched = apps.map((a) => {
      const u = userMap.get(a.userId)
      return {
        ...a,
        _id: undefined,
        currentUser: u ? {
          id: u.id,
          email: u.email,
          name: u.name,
          commercialAccessStatus: u.commercialAccessStatus,
          commercialRoles: u.commercialRoles || [],
          commercialMembership: u.commercialMembership || 'free',
          verificationLevel: u.verificationLevel || null,
          contractorRoles: u.contractorRoles || [],
        } : null,
      }
    })
    const counts = {
      pending:        await db.collection('commercial_access_applications').countDocuments({ status: 'pending' }),
      info_requested: await db.collection('commercial_access_applications').countDocuments({ status: 'info_requested' }),
      approved:       await db.collection('commercial_access_applications').countDocuments({ status: 'approved' }),
      denied:         await db.collection('commercial_access_applications').countDocuments({ status: 'denied' }),
      suspended:      await db.collection('commercial_access_applications').countDocuments({ status: 'suspended' }),
    }
    return handleCORS(NextResponse.json({ applications: enriched, counts }))
  }

  // ----------------------------------------------- ADMIN: decision endpoint
  const adminAppMatch = route.match(/^\/admin\/commercial-access\/([^/]+)$/)
  if (adminAppMatch && method === 'PATCH') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const admin = await db.collection('users').findOne({ id: auth.id })
    if (!admin || !isStaffRole(admin.role)) {
      return handleCORS(NextResponse.json({ error: 'Admin access required' }, { status: 403 }))
    }
    const appId = adminAppMatch[1]
    const app = await db.collection('commercial_access_applications').findOne({ id: appId })
    if (!app) return handleCORS(NextResponse.json({ error: 'Application not found' }, { status: 404 }))

    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '').toLowerCase()
    const note = clampStr(body.note, 1000)
    const validActions = ['approve', 'deny', 'request_info', 'suspend']
    if (!validActions.includes(action)) {
      return handleCORS(NextResponse.json({ error: `action must be one of: ${validActions.join(', ')}` }, { status: 400 }))
    }

    const targetUser = await db.collection('users').findOne({ id: app.userId })
    const now = new Date()
    let newAppStatus = app.status
    const userUpdate = { $set: {} }

    if (action === 'approve') {
      newAppStatus = 'approved'
      if (targetUser) {
        const nextRoles = Array.from(new Set([...(targetUser.commercialRoles || []), app.requestedRole]))
        userUpdate.$set.commercialRoles = nextRoles
        userUpdate.$set.commercialAccessStatus = 'approved'
        userUpdate.$set.commercialApprovedAt = now
        userUpdate.$set.commercialMembership = targetUser.commercialMembership && targetUser.commercialMembership !== 'free' ? targetUser.commercialMembership : 'verified_commercial'
        if (app.companyName)  userUpdate.$set.commercialCompanyName = app.companyName
        if (app.website)      userUpdate.$set.commercialWebsite = app.website
        if (app.phone)        userUpdate.$set.commercialPhone = app.phone
      }
    } else if (action === 'deny') {
      newAppStatus = 'denied'
      if (targetUser) userUpdate.$set.commercialAccessStatus = 'denied'
    } else if (action === 'request_info') {
      newAppStatus = 'info_requested'
    } else if (action === 'suspend') {
      newAppStatus = 'suspended'
      if (targetUser) userUpdate.$set.commercialAccessStatus = 'suspended'
    }

    await db.collection('commercial_access_applications').updateOne(
      { id: appId },
      { $set: {
          status: newAppStatus,
          decidedAt: now,
          decidedBy: admin.email || admin.id,
          decisionNote: note || null,
          updatedAt: now,
        } }
    )
    if (targetUser && Object.keys(userUpdate.$set).length > 0) {
      await db.collection('users').updateOne({ id: targetUser.id }, userUpdate)
    }

    try { await logActivity(db, admin, `commercial_access.${action}`, { kind: 'user', id: app.userId, label: app.userEmail }, { applicationId: appId, requestedRole: app.requestedRole, note }) } catch {}

    const fresh = await db.collection('commercial_access_applications').findOne({ id: appId })
    return handleCORS(NextResponse.json({ ok: true, application: { ...fresh, _id: undefined } }))
  }

  return null
}
