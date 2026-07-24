// PR-2d: Admin User Management V2
//
// Adds bulk operations, advanced filters, CSV export, soft-delete /
// archive / suspend tiers, tag management, trial tracking, and the
// /admin/memberships analytics dashboard.
//
// Status lifecycle (final spec, locked):
//   active     → normal
//   suspended  → temporarily blocked (auth refused, can be restored)
//   archived   → restorable soft-hide (excluded from default lists)
//   deleted    → tombstone (only Super Admin can purge)
//   purge      → SUPER ADMIN ONLY hard-delete, cascades to user's content
//
// Membership values (final spec, locked):
//   free | verified_commercial | pro_commercial | enterprise
//
// A one-shot migration endpoint maps legacy values (verified→verified_commercial,
// pro→pro_commercial) and is idempotent.

const { v4: uuidv4 } = require('uuid')

const STAFF_ROLES = ['admin', 'moderator', 'superadmin', 'super_admin', 'superAdmin']
const isStaff = (role) => STAFF_ROLES.includes(String(role || '').toLowerCase())
const isSuperAdmin = (role) => ['super_admin', 'superadmin', 'superAdmin'].includes(String(role || '').toLowerCase()) ||
  String(role || '').toLowerCase() === 'super_admin'

const VALID_STATUSES = ['active', 'suspended', 'archived', 'deleted']
const VALID_MEMBERSHIPS = ['free', 'verified_commercial', 'pro_commercial', 'enterprise']
const VALID_TAGS = ['test-account', 'vendor', 'reseller', 'contractor', 'facility-owner', 'property-manager', 'recycler']
const VALID_ROLES = ['user', 'moderator', 'admin', 'super_admin', 'contractor']
const VALID_VERIFICATION_LEVELS = ['none', 'email_verified', 'verified_contractor', 'verified_recycler', 'verified_facility']

function clean(u) {
  if (!u) return null
  const { _id, password, passwordHash, ...rest } = u
  return rest
}
function csvEscape(v) {
  if (v == null) return ''
  const s = Array.isArray(v) ? v.join('|') : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
function fmtDate(d) { try { return d ? new Date(d).toISOString() : '' } catch { return '' } }

// Build the MongoDB query from URL search params.
function buildUserFilter(url) {
  const filter = {}
  const q = (url.searchParams.get('q') || '').trim()
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { email:       { $regex: safe, $options: 'i' } },
      { name:        { $regex: safe, $options: 'i' } },
      { companyName: { $regex: safe, $options: 'i' } },
      { commercialCompanyName: { $regex: safe, $options: 'i' } },
    ]
  }
  const role = url.searchParams.get('role')
  if (role && VALID_ROLES.includes(role)) filter.role = role
  const verification = url.searchParams.get('verification')
  if (verification && VALID_VERIFICATION_LEVELS.includes(verification)) filter.verificationLevel = verification
  const membership = url.searchParams.get('membership')
  if (membership && VALID_MEMBERSHIPS.includes(membership)) filter.commercialMembership = membership
  const status = url.searchParams.get('status')
  if (status && VALID_STATUSES.includes(status)) filter.accountStatus = status
  const company = (url.searchParams.get('company') || '').trim()
  if (company) {
    const safe = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$and = (filter.$and || []).concat([{ $or: [
      { companyName:           { $regex: safe, $options: 'i' } },
      { commercialCompanyName: { $regex: safe, $options: 'i' } },
    ] }])
  }
  const tag = url.searchParams.get('tag')
  if (tag && VALID_TAGS.includes(tag)) filter.tags = tag
  const createdFrom = url.searchParams.get('createdFrom')
  const createdTo   = url.searchParams.get('createdTo')
  if (createdFrom || createdTo) {
    filter.createdAt = {}
    if (createdFrom) filter.createdAt.$gte = new Date(createdFrom)
    if (createdTo)   filter.createdAt.$lte = new Date(createdTo)
  }
  const lastLoginFrom = url.searchParams.get('lastLoginFrom')
  const lastLoginTo   = url.searchParams.get('lastLoginTo')
  if (lastLoginFrom || lastLoginTo) {
    filter.lastLoginAt = {}
    if (lastLoginFrom) filter.lastLoginAt.$gte = new Date(lastLoginFrom)
    if (lastLoginTo)   filter.lastLoginAt.$lte = new Date(lastLoginTo)
  }
  const onTrial = url.searchParams.get('onTrial')
  if (onTrial === 'true') {
    const now = new Date()
    filter.$and = (filter.$and || []).concat([{ commercialTrialEndsAt: { $gt: now } }, { commercialMembership: 'free' }])
  }
  const includeArchived = url.searchParams.get('includeArchived') === 'true'
  const includeDeleted  = url.searchParams.get('includeDeleted')  === 'true'
  if (!includeArchived && !filter.accountStatus) {
    filter.accountStatus = { $nin: ['archived', ...(includeDeleted ? [] : ['deleted'])] }
  } else if (!includeDeleted && !filter.accountStatus) {
    filter.accountStatus = { $ne: 'deleted' }
  }
  return filter
}

async function fetchUserIds(db, userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) return []
  return db.collection('users').find({ id: { $in: userIds } }).toArray()
}

async function logAdminBulkAction(db, admin, action, targetIds, details) {
  try {
    await db.collection('admin_audit_log').insertOne({
      id: uuidv4(),
      adminId: admin?.id || null,
      adminEmail: admin?.email || null,
      action,
      targetType: 'user_bulk',
      targetIds: Array.isArray(targetIds) ? targetIds.slice(0, 1000) : [],
      targetCount: Array.isArray(targetIds) ? targetIds.length : 0,
      details: details || {},
      createdAt: new Date(),
    })
  } catch (_) { /* noop */ }
}

export async function handle(ctx) {
  const { route, method, request, db, NextResponse, handleCORS, requireStaff } = ctx
  const url = new URL(request.url)

  // ====================================================================
  // GET /admin/users/v2 — extended list with all filters + tags + trial
  // ====================================================================
  if (route === '/admin/users/v2' && method === 'GET') {
    const guard = await requireStaff(request, db, 'moderator')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))

    const filter = buildUserFilter(url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 500)
    const skip  = parseInt(url.searchParams.get('skip')  || '0', 10)
    const sortField = url.searchParams.get('sort') || 'createdAt'
    const sortDir   = url.searchParams.get('order') === 'asc' ? 1 : -1
    const sort = { [sortField]: sortDir }

    const [users, total, byStatus, byRole, byMembership] = await Promise.all([
      db.collection('users').find(filter).sort(sort).skip(skip).limit(limit).toArray(),
      db.collection('users').countDocuments(filter),
      db.collection('users').aggregate([{ $group: { _id: '$accountStatus', count: { $sum: 1 } } }]).toArray().catch(() => []),
      db.collection('users').aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]).toArray().catch(() => []),
      db.collection('users').aggregate([{ $group: { _id: '$commercialMembership', count: { $sum: 1 } } }]).toArray().catch(() => []),
    ])
    return handleCORS(NextResponse.json({
      users: users.map(clean),
      total,
      facets: {
        status:     Object.fromEntries(byStatus.map((r) => [r._id || 'active', r.count])),
        role:       Object.fromEntries(byRole.map((r) => [r._id || 'user', r.count])),
        membership: Object.fromEntries(byMembership.map((r) => [r._id || 'free', r.count])),
      },
      filterMeta: {
        statuses:           VALID_STATUSES,
        roles:              VALID_ROLES,
        memberships:        VALID_MEMBERSHIPS,
        tags:               VALID_TAGS,
        verificationLevels: VALID_VERIFICATION_LEVELS,
      },
    }))
  }

  // ====================================================================
  // GET /admin/users/export — CSV export of users matching filters
  // ====================================================================
  if (route === '/admin/users/export' && method === 'GET') {
    const guard = await requireStaff(request, db, 'admin')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    const filter = buildUserFilter(url)
    const users = await db.collection('users').find(filter).sort({ createdAt: -1 }).limit(10000).toArray()
    const columns = [
      'email','name','accountStatus','role','verificationLevel','commercialMembership',
      'tags','companyName','contractorRoles','commercialRoles',
      'city','state','createdAt','lastLoginAt','suspendedAt','archivedAt',
    ]
    const lines = [columns.join(',')]
    for (const u of users) {
      lines.push(columns.map((col) => {
        switch (col) {
          case 'companyName':       return csvEscape(u.companyName || u.commercialCompanyName || '')
          case 'createdAt':
          case 'lastLoginAt':
          case 'suspendedAt':
          case 'archivedAt':        return csvEscape(fmtDate(u[col]))
          case 'tags':              return csvEscape(u.tags || [])
          case 'contractorRoles':   return csvEscape(u.contractorRoles || [])
          case 'commercialRoles':   return csvEscape(u.commercialRoles || [])
          case 'accountStatus':     return csvEscape(u.accountStatus || 'active')
          case 'commercialMembership': return csvEscape(u.commercialMembership || 'free')
          default:                  return csvEscape(u[col])
        }
      }).join(','))
    }
    const csv = lines.join('\n')
    await logAdminBulkAction(db, guard.user, 'users.export', users.map((u) => u.id), { count: users.length })
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dumpmaps_users_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  // ====================================================================
  // POST /admin/users/bulk/role
  // ====================================================================
  if (route === '/admin/users/bulk/role' && method === 'POST') {
    const guard = await requireStaff(request, db, 'admin')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    const body = await request.json().catch(() => ({}))
    const { userIds, role } = body
    if (!VALID_ROLES.includes(role)) return handleCORS(NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 }))
    if (!Array.isArray(userIds) || userIds.length === 0) return handleCORS(NextResponse.json({ error: 'userIds[] required' }, { status: 400 }))
    // Only super_admin can grant super_admin
    if (role === 'super_admin' && !isSuperAdmin(guard.user.role)) {
      return handleCORS(NextResponse.json({ error: 'Only super admins can grant super_admin role' }, { status: 403 }))
    }
    const result = await db.collection('users').updateMany(
      { id: { $in: userIds } },
      { $set: { role, updatedAt: new Date() } }
    )
    await logAdminBulkAction(db, guard.user, 'users.bulk.role', userIds, { role })
    return handleCORS(NextResponse.json({ ok: true, modified: result.modifiedCount }))
  }

  // ====================================================================
  // POST /admin/users/bulk/verification
  // ====================================================================
  if (route === '/admin/users/bulk/verification' && method === 'POST') {
    const guard = await requireStaff(request, db, 'admin')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    const { userIds, verificationLevel } = await request.json().catch(() => ({}))
    if (!VALID_VERIFICATION_LEVELS.includes(verificationLevel)) return handleCORS(NextResponse.json({ error: `verificationLevel invalid` }, { status: 400 }))
    if (!Array.isArray(userIds) || userIds.length === 0) return handleCORS(NextResponse.json({ error: 'userIds[] required' }, { status: 400 }))
    const result = await db.collection('users').updateMany(
      { id: { $in: userIds } },
      { $set: { verificationLevel, verifiedAt: verificationLevel !== 'none' ? new Date() : null, updatedAt: new Date() } }
    )
    await logAdminBulkAction(db, guard.user, 'users.bulk.verification', userIds, { verificationLevel })
    return handleCORS(NextResponse.json({ ok: true, modified: result.modifiedCount }))
  }

  // ====================================================================
  // POST /admin/users/bulk/membership
  // ====================================================================
  if (route === '/admin/users/bulk/membership' && method === 'POST') {
    const guard = await requireStaff(request, db, 'admin')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    const { userIds, membership } = await request.json().catch(() => ({}))
    if (!VALID_MEMBERSHIPS.includes(membership)) return handleCORS(NextResponse.json({ error: `membership invalid` }, { status: 400 }))
    if (!Array.isArray(userIds) || userIds.length === 0) return handleCORS(NextResponse.json({ error: 'userIds[] required' }, { status: 400 }))
    const result = await db.collection('users').updateMany(
      { id: { $in: userIds } },
      { $set: { commercialMembership: membership, commercialMembershipChangedAt: new Date(), updatedAt: new Date() } }
    )
    await logAdminBulkAction(db, guard.user, 'users.bulk.membership', userIds, { membership })
    return handleCORS(NextResponse.json({ ok: true, modified: result.modifiedCount }))
  }

  // ====================================================================
  // POST /admin/users/bulk/suspend  ({ suspend: bool, reason? })
  // ====================================================================
  if (route === '/admin/users/bulk/suspend' && method === 'POST') {
    const guard = await requireStaff(request, db, 'moderator')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    const { userIds, suspend, reason } = await request.json().catch(() => ({}))
    if (!Array.isArray(userIds) || userIds.length === 0) return handleCORS(NextResponse.json({ error: 'userIds[] required' }, { status: 400 }))
    const now = new Date()
    let result
    if (suspend) {
      result = await db.collection('users').updateMany(
        { id: { $in: userIds }, accountStatus: { $ne: 'deleted' } },
        { $set: { accountStatus: 'suspended', suspendedAt: now, suspendedBy: guard.user.email || guard.user.id, suspensionReason: reason || null, updatedAt: now } }
      )
    } else {
      result = await db.collection('users').updateMany(
        { id: { $in: userIds }, accountStatus: 'suspended' },
        { $set: { accountStatus: 'active', updatedAt: now }, $unset: { suspendedAt: '', suspendedBy: '', suspensionReason: '' } }
      )
    }
    await logAdminBulkAction(db, guard.user, suspend ? 'users.bulk.suspend' : 'users.bulk.unsuspend', userIds, { reason })
    return handleCORS(NextResponse.json({ ok: true, modified: result.modifiedCount }))
  }

  // ====================================================================
  // POST /admin/users/bulk/archive  ({ archive: bool })
  // ====================================================================
  if (route === '/admin/users/bulk/archive' && method === 'POST') {
    const guard = await requireStaff(request, db, 'admin')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    const { userIds, archive } = await request.json().catch(() => ({}))
    if (!Array.isArray(userIds) || userIds.length === 0) return handleCORS(NextResponse.json({ error: 'userIds[] required' }, { status: 400 }))
    const now = new Date()
    let result
    if (archive) {
      result = await db.collection('users').updateMany(
        { id: { $in: userIds }, accountStatus: { $ne: 'deleted' } },
        { $set: { accountStatus: 'archived', archivedAt: now, archivedBy: guard.user.email || guard.user.id, updatedAt: now } }
      )
    } else {
      result = await db.collection('users').updateMany(
        { id: { $in: userIds }, accountStatus: 'archived' },
        { $set: { accountStatus: 'active', updatedAt: now }, $unset: { archivedAt: '', archivedBy: '' } }
      )
    }
    await logAdminBulkAction(db, guard.user, archive ? 'users.bulk.archive' : 'users.bulk.restore', userIds, {})
    return handleCORS(NextResponse.json({ ok: true, modified: result.modifiedCount }))
  }

  // ====================================================================
  // POST /admin/users/bulk/delete — soft delete (tombstone)
  // ====================================================================
  if (route === '/admin/users/bulk/delete' && method === 'POST') {
    const guard = await requireStaff(request, db, 'admin')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    const { userIds } = await request.json().catch(() => ({}))
    if (!Array.isArray(userIds) || userIds.length === 0) return handleCORS(NextResponse.json({ error: 'userIds[] required' }, { status: 400 }))
    const now = new Date()
    const result = await db.collection('users').updateMany(
      { id: { $in: userIds } },
      { $set: { accountStatus: 'deleted', deletedAt: now, deletedBy: guard.user.email || guard.user.id, updatedAt: now } }
    )
    await logAdminBulkAction(db, guard.user, 'users.bulk.softDelete', userIds, {})
    return handleCORS(NextResponse.json({ ok: true, modified: result.modifiedCount }))
  }

  // ====================================================================
  // POST /admin/users/:id/purge — SUPER ADMIN ONLY hard delete + cascade
  // ====================================================================
  const purgeMatch = route.match(/^\/admin\/users\/([^/]+)\/purge$/)
  if (purgeMatch && method === 'POST') {
    const guard = await requireStaff(request, db, 'admin')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    if (!isSuperAdmin(guard.user.role)) {
      return handleCORS(NextResponse.json({ error: 'Only super admins can purge users' }, { status: 403 }))
    }
    const id = purgeMatch[1]
    const body = await request.json().catch(() => ({}))
    const target = await db.collection('users').findOne({ id })
    if (!target) return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    if (target.id === guard.user.id) return handleCORS(NextResponse.json({ error: 'Cannot purge yourself' }, { status: 400 }))
    if (!body.confirmEmail || String(body.confirmEmail).toLowerCase() !== String(target.email || '').toLowerCase()) {
      return handleCORS(NextResponse.json({ error: 'confirmEmail must match target user email exactly' }, { status: 400 }))
    }
    if (body.iUnderstandIrreversible !== true) {
      return handleCORS(NextResponse.json({ error: 'iUnderstandIrreversible must be true' }, { status: 400 }))
    }
    const now = new Date()
    // Cascade: mark user's listings/inspections/receipts/applications as deleted but DON'T hard-delete content
    // (preserves audit trail). Only the user document itself is hard-deleted.
    const cascadeUpdates = await Promise.all([
      db.collection('marketplace_listings').updateMany({ sellerId: id },         { $set: { status: 'removed', removedAt: now, removedReason: 'user_purged' } }).catch(() => ({ modifiedCount: 0 })),
      db.collection('jobs').updateMany({ postedByUserId: id },                   { $set: { status: 'closed', closedAt: now, closedReason: 'user_purged' } }).catch(() => ({ modifiedCount: 0 })),
      db.collection('alerts').updateMany({ userId: id },                         { $set: { status: 'removed', removedAt: now, removedReason: 'user_purged' } }).catch(() => ({ modifiedCount: 0 })),
      db.collection('vehicle_inspections').updateMany({ userId: id },            { $set: { status: 'removed', removedAt: now, removedReason: 'user_purged' } }).catch(() => ({ modifiedCount: 0 })),
      db.collection('dump_receipts').updateMany({ userId: id },                  { $set: { status: 'removed', removedAt: now, removedReason: 'user_purged' } }).catch(() => ({ modifiedCount: 0 })),
      db.collection('commercial_access_applications').updateMany({ userId: id }, { $set: { status: 'denied', purgedAt: now } }).catch(() => ({ modifiedCount: 0 })),
    ])
    await db.collection('users').deleteOne({ id })
    await logAdminBulkAction(db, guard.user, 'users.purge', [id], { cascade: cascadeUpdates.map((r) => r.modifiedCount || 0), email: target.email })
    return handleCORS(NextResponse.json({
      ok: true,
      purgedUserId: id,
      purgedEmail: target.email,
      cascade: {
        listings:        cascadeUpdates[0].modifiedCount || 0,
        jobs:            cascadeUpdates[1].modifiedCount || 0,
        alerts:          cascadeUpdates[2].modifiedCount || 0,
        inspections:     cascadeUpdates[3].modifiedCount || 0,
        receipts:        cascadeUpdates[4].modifiedCount || 0,
        commercialApps:  cascadeUpdates[5].modifiedCount || 0,
      },
    }))
  }

  // ====================================================================
  // POST /admin/users/bulk/tags  ({ addTags?: [], removeTags?: [] })
  // ====================================================================
  if (route === '/admin/users/bulk/tags' && method === 'POST') {
    const guard = await requireStaff(request, db, 'moderator')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    const { userIds, addTags, removeTags } = await request.json().catch(() => ({}))
    if (!Array.isArray(userIds) || userIds.length === 0) return handleCORS(NextResponse.json({ error: 'userIds[] required' }, { status: 400 }))
    const addOk = Array.isArray(addTags) ? addTags.filter((t) => VALID_TAGS.includes(t)) : []
    const removeOk = Array.isArray(removeTags) ? removeTags.filter((t) => VALID_TAGS.includes(t)) : []
    if (addOk.length === 0 && removeOk.length === 0) {
      return handleCORS(NextResponse.json({ error: 'Provide addTags or removeTags from the allowed list' }, { status: 400 }))
    }
    let modified = 0
    if (addOk.length > 0) {
      const r = await db.collection('users').updateMany({ id: { $in: userIds } }, { $addToSet: { tags: { $each: addOk } }, $set: { updatedAt: new Date() } })
      modified = r.modifiedCount
    }
    if (removeOk.length > 0) {
      const r = await db.collection('users').updateMany({ id: { $in: userIds } }, { $pullAll: { tags: removeOk }, $set: { updatedAt: new Date() } })
      modified = Math.max(modified, r.modifiedCount)
    }
    await logAdminBulkAction(db, guard.user, 'users.bulk.tags', userIds, { addTags: addOk, removeTags: removeOk })
    return handleCORS(NextResponse.json({ ok: true, modified }))
  }

  // ====================================================================
  // POST /admin/users/bulk/trial  ({ days?: number | revoke?: true })
  // ====================================================================
  if (route === '/admin/users/bulk/trial' && method === 'POST') {
    const guard = await requireStaff(request, db, 'admin')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    const { userIds, days, revoke } = await request.json().catch(() => ({}))
    if (!Array.isArray(userIds) || userIds.length === 0) return handleCORS(NextResponse.json({ error: 'userIds[] required' }, { status: 400 }))
    let result
    if (revoke) {
      result = await db.collection('users').updateMany({ id: { $in: userIds } }, { $set: { commercialTrialEndsAt: null, updatedAt: new Date() } })
    } else {
      const d = Math.min(Math.max(Number(days) || 14, 1), 365)
      const endsAt = new Date(Date.now() + d * 24 * 60 * 60 * 1000)
      result = await db.collection('users').updateMany({ id: { $in: userIds } }, { $set: { commercialTrialEndsAt: endsAt, commercialTrialDays: d, updatedAt: new Date() } })
    }
    await logAdminBulkAction(db, guard.user, revoke ? 'users.bulk.trial.revoke' : 'users.bulk.trial.grant', userIds, { days, revoke: !!revoke })
    return handleCORS(NextResponse.json({ ok: true, modified: result.modifiedCount }))
  }

  // ====================================================================
  // POST /admin/users/bulk/email  ({ subject, body })
  //   MOCKED — writes payloads to bulk_emails_sent. Real sending will
  //   activate when SendGrid/Resend keys are configured.
  // ====================================================================
  if (route === '/admin/users/bulk/email' && method === 'POST') {
    const guard = await requireStaff(request, db, 'admin')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    const { userIds, subject, body, dryRun } = await request.json().catch(() => ({}))
    if (!Array.isArray(userIds) || userIds.length === 0) return handleCORS(NextResponse.json({ error: 'userIds[] required' }, { status: 400 }))
    if (!subject || !body) return handleCORS(NextResponse.json({ error: 'subject and body required' }, { status: 400 }))
    const users = await fetchUserIds(db, userIds)
    const recipients = users.filter((u) => u.email).map((u) => ({ userId: u.id, email: u.email, name: u.name || u.email }))
    if (dryRun) {
      return handleCORS(NextResponse.json({ ok: true, dryRun: true, recipientCount: recipients.length, sample: recipients.slice(0, 5) }))
    }
    const batchId = uuidv4()
    const now = new Date()
    const records = recipients.map((r) => ({
      id: uuidv4(),
      batchId,
      sentBy: guard.user.email || guard.user.id,
      userId: r.userId,
      to: r.email,
      name: r.name,
      subject: String(subject).slice(0, 400),
      body: String(body).slice(0, 20000),
      status: 'mocked',                              // becomes 'sent' once email provider wired
      provider: null,
      providerMessageId: null,
      createdAt: now,
    }))
    if (records.length > 0) await db.collection('bulk_emails_sent').insertMany(records)
    await logAdminBulkAction(db, guard.user, 'users.bulk.email', userIds, { batchId, recipientCount: recipients.length, subject: String(subject).slice(0, 200) })
    return handleCORS(NextResponse.json({ ok: true, batchId, recipientCount: recipients.length, status: 'mocked', note: 'Real email send will activate when SendGrid/Resend keys are configured.' }))
  }

  // ====================================================================
  // POST /admin/users/migrate-memberships — one-shot, idempotent
  //   verified → verified_commercial
  //   pro      → pro_commercial
  // ====================================================================
  if (route === '/admin/users/migrate-memberships' && method === 'POST') {
    const guard = await requireStaff(request, db, 'admin')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    const r1 = await db.collection('users').updateMany({ commercialMembership: 'verified' }, { $set: { commercialMembership: 'verified_commercial', commercialMembershipMigratedAt: new Date() } })
    const r2 = await db.collection('users').updateMany({ commercialMembership: 'pro' },      { $set: { commercialMembership: 'pro_commercial',      commercialMembershipMigratedAt: new Date() } })
    await logAdminBulkAction(db, guard.user, 'users.migrate.memberships', [], { verifiedToCommercial: r1.modifiedCount, proToCommercial: r2.modifiedCount })
    return handleCORS(NextResponse.json({ ok: true, verifiedToCommercial: r1.modifiedCount, proToCommercial: r2.modifiedCount }))
  }

  // ====================================================================
  // GET /admin/memberships — dashboard aggregates
  // ====================================================================
  if (route === '/admin/memberships' && method === 'GET') {
    const guard = await requireStaff(request, db, 'admin')
    if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    const [
      byMembership, byRole, byCommercialRole, byVerification, byStatus,
      onTrial, recentSignups, commercialSignups30d, commercialSignups90d,
      conversions30d, conversionsAllTime,
    ] = await Promise.all([
      db.collection('users').aggregate([{ $group: { _id: '$commercialMembership', count: { $sum: 1 } } }]).toArray().catch(() => []),
      db.collection('users').aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]).toArray().catch(() => []),
      db.collection('users').aggregate([{ $unwind: '$commercialRoles' }, { $group: { _id: '$commercialRoles', count: { $sum: 1 } } }]).toArray().catch(() => []),
      db.collection('users').aggregate([{ $group: { _id: '$verificationLevel', count: { $sum: 1 } } }]).toArray().catch(() => []),
      db.collection('users').aggregate([{ $group: { _id: '$accountStatus', count: { $sum: 1 } } }]).toArray().catch(() => []),
      db.collection('users').countDocuments({ commercialTrialEndsAt: { $gt: now }, commercialMembership: 'free' }),
      db.collection('users').countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      db.collection('users').countDocuments({ commercialApprovedAt: { $gte: thirtyDaysAgo } }),
      db.collection('users').countDocuments({ commercialApprovedAt: { $gte: ninetyDaysAgo } }),
      db.collection('users').countDocuments({ commercialMembership: { $in: ['verified_commercial', 'pro_commercial', 'enterprise'] }, commercialMembershipChangedAt: { $gte: thirtyDaysAgo } }),
      db.collection('users').countDocuments({ commercialMembership: { $in: ['verified_commercial', 'pro_commercial', 'enterprise'] } }),
    ])

    // Membership pricing assumptions (placeholder ARPU until Stripe products wired)
    const PRICING = { free: 0, verified_commercial: 29, pro_commercial: 99, enterprise: 499 }
    let monthlyRecurring = 0
    const membershipMap = Object.fromEntries(byMembership.map((r) => [r._id || 'free', r.count]))
    for (const tier of Object.keys(PRICING)) {
      monthlyRecurring += (membershipMap[tier] || 0) * PRICING[tier]
    }

    return handleCORS(NextResponse.json({
      asOf: now,
      totalUsers:           Object.values(membershipMap).reduce((a, b) => a + b, 0),
      byMembership:         membershipMap,
      byRole:               Object.fromEntries(byRole.map((r) => [r._id || 'user', r.count])),
      byCommercialRole:     Object.fromEntries(byCommercialRole.map((r) => [r._id, r.count])),
      byVerificationLevel:  Object.fromEntries(byVerification.map((r) => [r._id || 'none', r.count])),
      byAccountStatus:      Object.fromEntries(byStatus.map((r) => [r._id || 'active', r.count])),
      onTrial,
      recentSignups,
      commercialGrowth: {
        new30d: commercialSignups30d,
        new90d: commercialSignups90d,
      },
      conversions: {
        last30d:   conversions30d,
        allTime:   conversionsAllTime,
      },
      revenue: {
        pricingAssumption: PRICING,
        estimatedMonthlyRecurring: monthlyRecurring,
        currency: 'USD',
        note: 'Estimated ARPU — replace with real Stripe MRR once paid memberships ship.',
      },
    }))
  }

  return null
}
