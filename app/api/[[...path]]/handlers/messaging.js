// PR-2b: Direct Messages handler module
// Extracted from app/api/[[...path]]/route.js for modularity.
// Endpoints: GET/POST /api/dm/threads, GET/POST /api/dm/threads/:tid/messages, PATCH /api/dm/threads/:tid/read

const makeDmThreadId = (a, b) => {
  const [u1, u2] = [a, b].sort()
  return `dm_${u1}_${u2}`
}

export async function handle(ctx) {
  const { route, method, request, db, getAuth, clean, uuidv4, NextResponse, handleCORS } = ctx

  // GET /api/dm/threads  → list user's DM threads with last message + unread
  if (route === '/dm/threads' && method === 'GET') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const msgs = await db.collection('dm_messages')
      .find(
        { $or: [{ fromUserId: auth.id }, { toUserId: auth.id }] },
        { projection: { threadId: 1, fromUserId: 1, toUserId: 1, body: 1, createdAt: 1, read: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(800)
      .toArray()
    // Batch-fetch users in one query (was N+1: one findOne per thread).
    const otherIds = [...new Set(msgs.map((m) => (m.fromUserId === auth.id ? m.toUserId : m.fromUserId)).filter(Boolean))]
    const users = otherIds.length
      ? await db.collection('users').find(
          { id: { $in: otherIds } },
          { projection: { id: 1, name: 1, avatarUrl: 1, profilePhotoUrl: 1, verificationLevel: 1 } },
        ).toArray()
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))
    const map = new Map()
    for (const m of msgs) {
      const otherId = m.fromUserId === auth.id ? m.toUserId : m.fromUserId
      const tid = m.threadId || makeDmThreadId(auth.id, otherId)
      if (!map.has(tid)) {
        const other = userMap.get(otherId)
        map.set(tid, {
          threadId: tid,
          otherUserId: otherId,
          otherUserName: other?.name || 'User',
          otherUserAvatar: other?.profilePhotoUrl || other?.avatarUrl || null,
          otherUserVerification: other?.verificationLevel || 'normal_user',
          lastMessage: m.body || '',
          lastMessageAt: m.createdAt,
          lastSenderId: m.fromUserId,
          unread: 0,
        })
      }
      if (m.toUserId === auth.id && !m.read) {
        const t = map.get(tid)
        t.unread += 1
      }
    }
    const threads = Array.from(map.values()).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
    const totalUnread = threads.reduce((s, t) => s + t.unread, 0)
    return handleCORS(NextResponse.json({ threads, totalUnread }))
  }

  // POST /api/dm/threads  → ensure/open thread with target userId; returns thread + other user
  if (route === '/dm/threads' && method === 'POST') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const body = await request.json().catch(() => ({}))
    const otherId = body.userId
    if (!otherId) return handleCORS(NextResponse.json({ error: 'userId required' }, { status: 400 }))
    if (otherId === auth.id) return handleCORS(NextResponse.json({ error: 'Cannot DM yourself' }, { status: 400 }))
    const other = await db.collection('users').findOne({ id: otherId })
    if (!other) return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    const tid = makeDmThreadId(auth.id, otherId)
    return handleCORS(NextResponse.json({
      thread: {
        threadId: tid,
        otherUserId: otherId,
        otherUserName: other.name || 'User',
        otherUserAvatar: other.avatarUrl || null,
        otherUserVerification: other.verificationLevel || 'normal_user',
      },
    }))
  }

  // GET /api/dm/threads/:threadId/messages
  if (route.match(/^\/dm\/threads\/[^/]+\/messages$/) && method === 'GET') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const tid = route.split('/')[3]
    if (!tid.startsWith('dm_') || !tid.includes(auth.id)) {
      return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }
    const msgs = await db.collection('dm_messages').find({ threadId: tid }).sort({ createdAt: 1 }).limit(500).toArray()
    // auto mark received messages read
    await db.collection('dm_messages').updateMany(
      { threadId: tid, toUserId: auth.id, read: false },
      { $set: { read: true, readAt: new Date() } },
    )
    return handleCORS(NextResponse.json({ messages: msgs.map(clean) }))
  }

  // POST /api/dm/threads/:threadId/messages
  if (route.match(/^\/dm\/threads\/[^/]+\/messages$/) && method === 'POST') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const tid = route.split('/')[3]
    if (!tid.startsWith('dm_') || !tid.includes(auth.id)) {
      return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }
    const body = await request.json().catch(() => ({}))
    const text = (body.body || '').trim()
    if (!text && (!Array.isArray(body.photos) || body.photos.length === 0)) {
      return handleCORS(NextResponse.json({ error: 'Message body or photos required' }, { status: 400 }))
    }
    // derive other id from threadId pattern dm_<a>_<b>
    const parts = tid.slice(3).split('_')
    const otherId = parts[0] === auth.id ? parts[1] : parts[0]
    const msg = {
      id: uuidv4(),
      threadId: tid,
      fromUserId: auth.id,
      toUserId: otherId,
      body: text,
      photos: Array.isArray(body.photos) ? body.photos.slice(0, 6) : [],
      read: false,
      createdAt: new Date(),
    }
    await db.collection('dm_messages').insertOne(msg)
    return handleCORS(NextResponse.json({ message: clean(msg) }))
  }

  // PATCH /api/dm/threads/:threadId/read  → mark all incoming messages read
  if (route.match(/^\/dm\/threads\/[^/]+\/read$/) && method === 'PATCH') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const tid = route.split('/')[3]
    await db.collection('dm_messages').updateMany(
      { threadId: tid, toUserId: auth.id, read: false },
      { $set: { read: true, readAt: new Date() } },
    )
    return handleCORS(NextResponse.json({ ok: true }))
  }

  return null
}
