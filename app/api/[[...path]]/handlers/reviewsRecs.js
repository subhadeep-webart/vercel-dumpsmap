// PR-2b: Reviews & Recommendations handler module
// Endpoints:
//   GET    /api/reviews?target=facility|contractor&targetId=...
//   POST   /api/reviews/contractor
//   PATCH  /api/reviews/:id
//   DELETE /api/reviews/:id
//   GET    /api/recommendations/contractors[?city=&q=&limit=]
//   GET    /api/recommendations/contractors/:id
//   GET    /api/recommendations/facilities[?city=&typeKey=&minRating=]

export async function handle(ctx) {
  const { route, method, request, db, getAuth, isStaff, clean, uuidv4, NextResponse, handleCORS } = ctx

  // GET /api/reviews?target=facility|contractor&targetId=...&limit=...
  if (route === '/reviews' && method === 'GET') {
    const url = new URL(request.url)
    const target = url.searchParams.get('target') || 'facility'
    const targetId = url.searchParams.get('targetId') || url.searchParams.get('facilityId')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 300)
    if (!targetId) return handleCORS(NextResponse.json({ error: 'targetId required' }, { status: 400 }))
    const q = target === 'contractor' ? { contractorUserId: targetId } : { facilityId: targetId }
    const reviews = await db.collection('reviews').find(q).sort({ createdAt: -1 }).limit(limit).toArray()
    const userIds = Array.from(new Set(reviews.map(r => r.authorId).filter(Boolean)))
    const users = await db.collection('users').find({ id: { $in: userIds } }).toArray()
    const userMap = new Map(users.map(u => [u.id, u]))
    const enriched = reviews.map(r => ({
      ...clean(r),
      author: userMap.has(r.authorId)
        ? {
            id: r.authorId,
            name: userMap.get(r.authorId).name || r.authorName || 'User',
            avatarUrl: userMap.get(r.authorId).avatarUrl || null,
            verificationLevel: userMap.get(r.authorId).verificationLevel || 'normal_user',
          }
        : { id: r.authorId || 'guest', name: r.authorName || 'Guest' },
    }))
    const count = reviews.length
    const avg = count ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count : 0
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const r of reviews) {
      const k = Math.max(1, Math.min(5, parseInt(r.rating) || 0))
      if (dist[k] !== undefined) dist[k] += 1
    }
    return handleCORS(NextResponse.json({ reviews: enriched, aggregate: { count, average: Math.round(avg * 10) / 10, distribution: dist } }))
  }

  // POST /api/reviews/contractor — upsert contractor review
  if (route === '/reviews/contractor' && method === 'POST') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const body = await request.json().catch(() => ({}))
    if (!body.contractorUserId || !body.rating) {
      return handleCORS(NextResponse.json({ error: 'contractorUserId and rating required' }, { status: 400 }))
    }
    if (body.contractorUserId === auth.id) {
      return handleCORS(NextResponse.json({ error: 'Cannot review yourself' }, { status: 400 }))
    }
    const existing = await db.collection('reviews').findOne({ contractorUserId: body.contractorUserId, authorId: auth.id })
    const u = await db.collection('users').findOne({ id: auth.id })
    const data = {
      rating: Math.max(1, Math.min(5, parseInt(body.rating))),
      text: (body.text || '').slice(0, 2000),
      photos: Array.isArray(body.photos) ? body.photos.slice(0, 4) : [],
      material: body.material || '',
      jobType: body.jobType || '',
      updatedAt: new Date(),
    }
    let review
    if (existing) {
      await db.collection('reviews').updateOne({ id: existing.id }, { $set: data })
      review = await db.collection('reviews').findOne({ id: existing.id })
    } else {
      review = {
        id: uuidv4(),
        contractorUserId: body.contractorUserId,
        target: 'contractor',
        ...data,
        authorId: auth.id,
        authorName: u?.name || auth.email,
        createdAt: new Date(),
      }
      await db.collection('reviews').insertOne(review)
    }
    const all = await db.collection('reviews').find({ contractorUserId: body.contractorUserId }).toArray()
    const avg = all.length ? all.reduce((s, r) => s + (r.rating || 0), 0) / all.length : 0
    await db.collection('users').updateOne(
      { id: body.contractorUserId },
      { $set: { contractorRating: Math.round(avg * 10) / 10, contractorReviewCount: all.length } },
    )
    return handleCORS(NextResponse.json({ review: clean(review) }))
  }

  // PATCH /api/reviews/:id  (own or staff)
  if (route.match(/^\/reviews\/[^/]+$/) && method === 'PATCH') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const id = route.split('/')[2]
    if (id === 'contractor') return handleCORS(NextResponse.json({ error: 'Use POST' }, { status: 405 }))
    const r = await db.collection('reviews').findOne({ id })
    if (!r) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    if (r.authorId !== auth.id && !isStaff(auth.role)) {
      return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }
    const body = await request.json().catch(() => ({}))
    const update = { updatedAt: new Date() }
    if (body.rating !== undefined) update.rating = Math.max(1, Math.min(5, parseInt(body.rating)))
    if (body.text !== undefined) update.text = (body.text || '').slice(0, 2000)
    if (Array.isArray(body.photos)) update.photos = body.photos.slice(0, 4)
    await db.collection('reviews').updateOne({ id }, { $set: update })
    const fresh = await db.collection('reviews').findOne({ id })
    if (fresh.facilityId) {
      const all = await db.collection('reviews').find({ facilityId: fresh.facilityId }).toArray()
      const avg = all.length ? all.reduce((s, x) => s + (x.rating || 0), 0) / all.length : 0
      await db.collection('facilities').updateOne({ id: fresh.facilityId }, { $set: { rating: avg, reviewsCount: all.length } })
    } else if (fresh.contractorUserId) {
      const all = await db.collection('reviews').find({ contractorUserId: fresh.contractorUserId }).toArray()
      const avg = all.length ? all.reduce((s, x) => s + (x.rating || 0), 0) / all.length : 0
      await db.collection('users').updateOne({ id: fresh.contractorUserId }, { $set: { contractorRating: Math.round(avg * 10) / 10, contractorReviewCount: all.length } })
    }
    return handleCORS(NextResponse.json({ review: clean(fresh) }))
  }

  // DELETE /api/reviews/:id  (own or staff)
  if (route.match(/^\/reviews\/[^/]+$/) && method === 'DELETE') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const id = route.split('/')[2]
    const r = await db.collection('reviews').findOne({ id })
    if (!r) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    if (r.authorId !== auth.id && !isStaff(auth.role)) {
      return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }
    await db.collection('reviews').deleteOne({ id })
    if (r.facilityId) {
      const all = await db.collection('reviews').find({ facilityId: r.facilityId }).toArray()
      const avg = all.length ? all.reduce((s, x) => s + (x.rating || 0), 0) / all.length : 0
      await db.collection('facilities').updateOne({ id: r.facilityId }, { $set: { rating: avg, reviewsCount: all.length } })
    }
    if (r.contractorUserId) {
      const all = await db.collection('reviews').find({ contractorUserId: r.contractorUserId }).toArray()
      const avg = all.length ? all.reduce((s, x) => s + (x.rating || 0), 0) / all.length : 0
      await db.collection('users').updateOne({ id: r.contractorUserId }, { $set: { contractorRating: Math.round(avg * 10) / 10, contractorReviewCount: all.length } })
    }
    return handleCORS(NextResponse.json({ ok: true }))
  }

  // GET /api/recommendations/contractors
  if (route === '/recommendations/contractors' && method === 'GET') {
    const url = new URL(request.url)
    const city = url.searchParams.get('city')
    const q = (url.searchParams.get('q') || '').toLowerCase()
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const filter = {
      $or: [
        { primaryProfile: 'contractor' },
        { communityProfileType: 'contractor' },
        { accountType: 'contractor' },
      ],
      accountStatus: { $ne: 'banned' },
    }
    if (city) filter.city = { $regex: `^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    const users = await db.collection('users').find(filter).limit(500).toArray()
    let list = users.map(u => ({
      id: u.id,
      name: u.name || 'Contractor',
      avatarUrl: u.avatarUrl || null,
      city: u.city || '',
      state: u.state || '',
      bio: u.bio || u.about || '',
      services: u.contractorServices || u.services || [],
      primaryProfile: u.primaryProfile || u.accountType || 'contractor',
      verificationLevel: u.verificationLevel || 'normal_user',
      contractorRating: u.contractorRating || 0,
      contractorReviewCount: u.contractorReviewCount || 0,
      karma: u.karma || 0,
      completedJobs: u.completedJobs || 0,
    }))
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        (c.bio || '').toLowerCase().includes(q) ||
        (c.services || []).some(s => String(s).toLowerCase().includes(q)),
      )
    }
    list.sort((a, b) => {
      if ((b.contractorRating || 0) !== (a.contractorRating || 0)) return (b.contractorRating || 0) - (a.contractorRating || 0)
      return (b.contractorReviewCount || 0) - (a.contractorReviewCount || 0)
    })
    return handleCORS(NextResponse.json({ contractors: list.slice(0, limit) }))
  }

  // GET /api/recommendations/contractors/:id
  if (route.match(/^\/recommendations\/contractors\/[^/]+$/) && method === 'GET') {
    const id = route.split('/')[3]
    const u = await db.collection('users').findOne({ id })
    if (!u) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const reviews = await db.collection('reviews').find({ contractorUserId: id }).sort({ createdAt: -1 }).limit(200).toArray()
    const userIds = Array.from(new Set(reviews.map(r => r.authorId).filter(Boolean)))
    const authors = await db.collection('users').find({ id: { $in: userIds } }).toArray()
    const aMap = new Map(authors.map(a => [a.id, a]))
    const enriched = reviews.map(r => ({
      ...clean(r),
      author: aMap.has(r.authorId)
        ? { id: r.authorId, name: aMap.get(r.authorId).name || r.authorName, avatarUrl: aMap.get(r.authorId).avatarUrl || null }
        : { id: 'guest', name: r.authorName || 'Guest' },
    }))
    const count = reviews.length
    const avg = count ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count : 0
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const r of reviews) {
      const k = Math.max(1, Math.min(5, parseInt(r.rating) || 0))
      if (dist[k] !== undefined) dist[k] += 1
    }
    return handleCORS(NextResponse.json({
      contractor: {
        id: u.id,
        name: u.name || 'Contractor',
        avatarUrl: u.avatarUrl || null,
        city: u.city || '',
        state: u.state || '',
        bio: u.bio || u.about || '',
        services: u.contractorServices || u.services || [],
        primaryProfile: u.primaryProfile || u.accountType || 'contractor',
        verificationLevel: u.verificationLevel || 'normal_user',
        contractorRating: Math.round(avg * 10) / 10,
        contractorReviewCount: count,
        karma: u.karma || 0,
        completedJobs: u.completedJobs || 0,
      },
      reviews: enriched,
      aggregate: { count, average: Math.round(avg * 10) / 10, distribution: dist },
    }))
  }

  // GET /api/recommendations/facilities
  if (route === '/recommendations/facilities' && method === 'GET') {
    const url = new URL(request.url)
    const city = url.searchParams.get('city')
    const typeKey = url.searchParams.get('typeKey')
    const minRating = parseFloat(url.searchParams.get('minRating') || '3.5')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const filter = { status: 'active' }
    if (city) filter.city = { $regex: `^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    if (typeKey) filter.typeKey = typeKey
    const facs = await db.collection('facilities').find(filter).limit(500).toArray()
    let list = facs
      .filter(f => (f.reviewsCount || 0) > 0 && (f.rating || 0) >= minRating)
      .map(f => ({
        id: f.id,
        name: f.name,
        address: f.address,
        city: f.city,
        state: f.state,
        typeKey: f.typeKey,
        type: f.type,
        rating: f.rating || 0,
        reviewsCount: f.reviewsCount || 0,
        accepted: f.accepted || [],
        photos: f.photos || [],
        claimed: !!f.claimed,
      }))
    list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewsCount || 0) - (a.reviewsCount || 0))
    return handleCORS(NextResponse.json({ facilities: list.slice(0, limit) }))
  }

  return null
}
