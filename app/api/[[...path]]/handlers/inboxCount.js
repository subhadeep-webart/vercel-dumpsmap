// PR-2b: Unified Inbox unread-count handler module
// Endpoint: GET /api/inbox/unread-count

export async function handle(ctx) {
  const { route, method, request, db, getAuth, NextResponse, handleCORS } = ctx

  if (route === '/inbox/unread-count' && method === 'GET') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ count: 0, dm: 0, marketplace: 0, jobs: 0, groups: 0 }))
    const [dmUnread, marketUnread, jobUnread] = await Promise.all([
      db.collection('dm_messages').countDocuments({ toUserId: auth.id, read: false }),
      db.collection('marketplace_messages').countDocuments({ receiverId: auth.id, read: false }),
      db.collection('job_messages').countDocuments({ receiverId: auth.id, read: false }),
    ])
    // group chat: unread = messages newer than member.lastReadAt
    const memberships = await db.collection('community_group_members').find({ userId: auth.id }).toArray()
    let groupUnread = 0
    const groupBreakdown = []
    for (const m of memberships) {
      const cutoff = m.lastReadAt || m.joinedAt || new Date(0)
      const c = await db.collection('community_group_messages').countDocuments({
        groupId: m.groupId,
        userId: { $ne: auth.id },
        deleted: { $ne: true },
        createdAt: { $gt: cutoff },
      })
      if (c > 0) {
        groupUnread += c
        groupBreakdown.push({ groupId: m.groupId, unread: c })
      }
    }
    const total = dmUnread + marketUnread + jobUnread + groupUnread
    return handleCORS(NextResponse.json({
      count: total,
      dm: dmUnread,
      marketplace: marketUnread,
      jobs: jobUnread,
      groups: groupUnread,
      groupBreakdown,
    }))
  }

  return null
}
