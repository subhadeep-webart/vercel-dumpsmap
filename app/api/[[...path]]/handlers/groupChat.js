// PR-2b: Community Group Chat handler module
// Endpoints: GET/POST /api/community/groups/:id/chat, DELETE /api/community/groups/chat/:msgId

export async function handle(ctx) {
  const { route, method, request, db, getAuth, isStaff, clean, uuidv4, NextResponse, handleCORS } = ctx

  // GET /api/community/groups/:id/chat  (members only)
  if (route.match(/^\/community\/groups\/[^/]+\/chat$/) && method === 'GET') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const groupId = route.split('/')[3]
    const group = await db.collection('community_groups').findOne({ id: groupId })
    if (!group || group.status === 'removed') return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const member = await db.collection('community_group_members').findOne({ groupId, userId: auth.id })
    if (!member && !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Join the group to access chat' }, { status: 403 }))
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 200)
    const msgs = await db.collection('community_group_messages')
      .find({ groupId, deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
    msgs.reverse()
    // enrich authors
    const userIds = Array.from(new Set(msgs.map(m => m.userId)))
    const users = await db.collection('users').find({ id: { $in: userIds } }).toArray()
    const userMap = new Map(users.map(u => [u.id, u]))
    const enriched = msgs.map(m => ({
      ...clean(m),
      author: userMap.has(m.userId) ? {
        id: m.userId,
        name: userMap.get(m.userId).name || 'User',
        avatarUrl: userMap.get(m.userId).avatarUrl || null,
        verificationLevel: userMap.get(m.userId).verificationLevel || 'normal_user',
      } : { id: m.userId, name: 'User' },
    }))
    // update lastReadAt for this member (best effort)
    if (member) {
      await db.collection('community_group_members').updateOne(
        { groupId, userId: auth.id },
        { $set: { lastReadAt: new Date() } },
      )
    }
    return handleCORS(NextResponse.json({ messages: enriched }))
  }

  // POST /api/community/groups/:id/chat  (members only)
  if (route.match(/^\/community\/groups\/[^/]+\/chat$/) && method === 'POST') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const groupId = route.split('/')[3]
    const group = await db.collection('community_groups').findOne({ id: groupId })
    if (!group || group.status === 'removed') return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const member = await db.collection('community_group_members').findOne({ groupId, userId: auth.id })
    if (!member && !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Join the group to post in chat' }, { status: 403 }))
    const body = await request.json().catch(() => ({}))
    const text = (body.body || '').trim()
    if (!text && (!Array.isArray(body.photos) || body.photos.length === 0)) {
      return handleCORS(NextResponse.json({ error: 'Message body or photos required' }, { status: 400 }))
    }
    const u = await db.collection('users').findOne({ id: auth.id })
    const msg = {
      id: uuidv4(),
      groupId,
      userId: auth.id,
      body: text,
      photos: Array.isArray(body.photos) ? body.photos.slice(0, 4) : [],
      createdAt: new Date(),
    }
    await db.collection('community_group_messages').insertOne(msg)
    return handleCORS(NextResponse.json({
      message: {
        ...clean(msg),
        author: {
          id: auth.id,
          name: u?.name || 'User',
          avatarUrl: u?.avatarUrl || null,
          verificationLevel: u?.verificationLevel || 'normal_user',
        },
      },
    }))
  }

  // DELETE /api/community/groups/chat/:msgId  (own or staff)
  if (route.match(/^\/community\/groups\/chat\/[^/]+$/) && method === 'DELETE') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const msgId = route.split('/')[4]
    const msg = await db.collection('community_group_messages').findOne({ id: msgId })
    if (!msg) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    if (msg.userId !== auth.id && !isStaff(auth.role)) {
      return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }
    await db.collection('community_group_messages').updateOne({ id: msgId }, { $set: { deleted: true, deletedAt: new Date() } })
    return handleCORS(NextResponse.json({ ok: true }))
  }

  return null
}
