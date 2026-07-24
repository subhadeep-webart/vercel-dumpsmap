// Phase A: Super Admin Feature Control System — backend.
//
// Endpoints (all super-admin gated except /me/feature-access):
//   GET    /api/admin/feature-flags                     → list all (seeded if missing)
//   GET    /api/admin/feature-flags/:key                → single flag
//   PATCH  /api/admin/feature-flags/:key                → update global config
//   GET    /api/admin/feature-flags/:key/audit          → audit log for this feature
//   GET    /api/admin/feature-flags/audit               → audit log across all features
//
//   GET    /api/admin/feature-grants?scope=&scopeId=&featureKey=
//                                                       → list grants (filterable)
//   POST   /api/admin/feature-grants                    → upsert one grant
//   PATCH  /api/admin/feature-grants/:id                → update status / notes
//   DELETE /api/admin/feature-grants/:id                → soft revoke (status=revoked)
//
//   GET    /api/me/feature-access                       → effective access map for current user
//                                                          (used by UI to gate routes/CTAs)
//
// Storage:
//   • feature_flags         — global per-feature config
//   • feature_grants        — { id, featureKey, scope: 'user'|'facility', scopeId,
//                                status: 'active'|'trial'|'paused'|'expired'|'revoked',
//                                trialStartAt?, trialEndAt?,
//                                grantedBy, grantedByEmail, grantedAt,
//                                revokedBy?, revokedByEmail?, revokedAt?,
//                                notes, createdAt, updatedAt }
//   • feature_audit_log     — every change recorded (global + per-account)
//
// Audit log entries are written for every PATCH. The audit log is also the
// destination for Phase B per-account grant changes (already accounted for
// in the schema via `scope` + `scopeId` fields).

const { v4: uuidv4 } = require('uuid')
const {
  FEATURES, FEATURES_BY_KEY, FEATURE_KEYS, FEATURE_STATUSES,
  MEMBERSHIP_TIERS, canAccessFeature, isSuperAdmin, isStaff,
} = require('../../../../lib/feature-control')

const VALID_ROLES = ['user', 'contractor', 'moderator', 'admin', 'super_admin']

function s(v, max = 800) { return v == null ? '' : String(v).slice(0, max) }
function pickEnum(v, allowed, fallback) { return allowed.includes(String(v)) ? String(v) : fallback }
function clean(o) {
  if (!o) return null
  const { _id, ...rest } = o
  return rest
}

// Ensure all built-in features have a feature_flags row. Idempotent.
async function ensureSeeded(db) {
  const col = db.collection('feature_flags')
  const existing = await col.find({}, { projection: { key: 1 } }).toArray()
  const have = new Set(existing.map((r) => r.key))
  const now = new Date()
  const missing = FEATURES.filter((f) => !have.has(f.key))
  if (missing.length === 0) return
  const docs = missing.map((f) => ({
    key: f.key,
    name: f.name,
    description: f.description,
    category: f.category,
    ...f.seedDefaults,
    updatedBy: null,
    updatedByEmail: 'system_seed',
    updatedAt: now,
    createdAt: now,
  }))
  await col.insertMany(docs)
}

async function writeAudit(db, admin, payload) {
  try {
    await db.collection('feature_audit_log').insertOne({
      id: uuidv4(),
      adminId: admin?.id || null,
      adminEmail: admin?.email || null,
      createdAt: new Date(),
      ...payload,
    })
  } catch (_) { /* noop */ }
}

// Compute the diff between oldRow and patch (only fields in patch).
function diffPatch(oldRow, patch) {
  const before = {}
  const after = {}
  for (const k of Object.keys(patch)) {
    before[k] = oldRow ? oldRow[k] : undefined
    after[k]  = patch[k]
  }
  return { before, after }
}

export async function handle(ctx) {
  const { route, method, request, db, NextResponse, handleCORS, requireStaff, getAuth } = ctx
  if (!route.startsWith('/admin/feature-flags') && !route.startsWith('/admin/feature-grants') && route !== '/me/feature-access') return null
  const url = new URL(request.url)

  // ====================================================================
  // GET /me/feature-access — effective access map for current user
  // ====================================================================
  if (route === '/me/feature-access' && method === 'GET') {
    const auth = getAuth(request)
    const user = auth ? await db.collection('users').findOne({ id: auth.id }) : null

    await ensureSeeded(db)
    const flags = await db.collection('feature_flags').find({}).toArray()
    const flagByKey = Object.fromEntries(flags.map((f) => [f.key, f]))
    const grants = user
      ? await db.collection('feature_grants').find({ scope: 'user', scopeId: user.id }).toArray()
      : []
    const grantByKey = Object.fromEntries(grants.map((g) => [g.featureKey, g]))

    const access = {}
    for (const f of FEATURES) {
      const flag = flagByKey[f.key]
      const grant = grantByKey[f.key] || null
      const result = canAccessFeature(user, f.key, {}, flag, grant)
      access[f.key] = {
        ...result,
        feature: {
          key: f.key,
          name: f.name,
          category: f.category,
          status: result.status,
          visibleToUsers: flag?.visibleToUsers ?? f.seedDefaults.visibleToUsers,
        },
      }
    }
    return handleCORS(NextResponse.json({ access, authenticated: !!user }))
  }

  // All admin/feature-flags routes require super_admin
  const guard = await requireStaff(request, db, 'super_admin')
  if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
  const admin = guard.user

  // ====================================================================
  // GET /admin/feature-flags
  // ====================================================================
  if (route === '/admin/feature-flags' && method === 'GET') {
    await ensureSeeded(db)
    const rows = await db.collection('feature_flags').find({}).toArray()
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
    // Merge with registry order
    const flags = FEATURES.map((f) => {
      const row = byKey[f.key]
      return {
        ...f.seedDefaults,
        key: f.key,
        name: f.name,
        description: f.description,
        category: f.category,
        ...(row ? clean(row) : {}),
      }
    })
    return handleCORS(NextResponse.json({
      flags,
      featureStatuses: FEATURE_STATUSES,
      membershipTiers: MEMBERSHIP_TIERS,
      validRoles: VALID_ROLES,
    }))
  }

  // ====================================================================
  // GET /admin/feature-flags/audit
  // ====================================================================
  if (route === '/admin/feature-flags/audit' && method === 'GET') {
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)))
    const featureKey = url.searchParams.get('featureKey')
    const q = {}
    if (featureKey && FEATURE_KEYS.includes(featureKey)) q.featureKey = featureKey
    const rows = await db.collection('feature_audit_log').find(q).sort({ createdAt: -1 }).limit(limit).toArray()
    return handleCORS(NextResponse.json({ entries: rows.map(clean) }))
  }

  // ====================================================================
  // /admin/feature-flags/:key  and  /admin/feature-flags/:key/audit
  // ====================================================================
  if (route.startsWith('/admin/feature-flags/')) {
    const tail = route.slice('/admin/feature-flags/'.length)
    const segs = tail.split('/').filter(Boolean)
    const key = segs[0]
    if (!FEATURE_KEYS.includes(key)) {
      return handleCORS(NextResponse.json({ error: 'Unknown feature key' }, { status: 404 }))
    }

    // GET /admin/feature-flags/:key/audit
    if (segs[1] === 'audit' && method === 'GET') {
      const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)))
      const rows = await db.collection('feature_audit_log').find({ featureKey: key }).sort({ createdAt: -1 }).limit(limit).toArray()
      return handleCORS(NextResponse.json({ entries: rows.map(clean) }))
    }

    if (segs.length === 1) {
      await ensureSeeded(db)
      const def = FEATURES_BY_KEY[key]
      const existing = await db.collection('feature_flags').findOne({ key })

      // GET single
      if (method === 'GET') {
        const merged = { ...def.seedDefaults, key: def.key, name: def.name, description: def.description, category: def.category, ...(existing ? clean(existing) : {}) }
        return handleCORS(NextResponse.json({ flag: merged }))
      }

      // PATCH single
      if (method === 'PATCH') {
        const body = await request.json().catch(() => ({}))
        const patch = {}
        if (body.globalStatus !== undefined) {
          if (!FEATURE_STATUSES.includes(body.globalStatus)) {
            return handleCORS(NextResponse.json({ error: `globalStatus must be one of ${FEATURE_STATUSES.join(', ')}` }, { status: 400 }))
          }
          patch.globalStatus = body.globalStatus
        }
        if (body.visibleToUsers !== undefined) patch.visibleToUsers = !!body.visibleToUsers
        if (body.allowedRoles !== undefined) {
          if (!Array.isArray(body.allowedRoles)) {
            return handleCORS(NextResponse.json({ error: 'allowedRoles must be an array' }, { status: 400 }))
          }
          const filtered = body.allowedRoles.map((r) => String(r)).filter((r) => VALID_ROLES.includes(r))
          patch.allowedRoles = filtered
        }
        if (body.requiredMembershipTier !== undefined) {
          if (!MEMBERSHIP_TIERS.includes(body.requiredMembershipTier)) {
            return handleCORS(NextResponse.json({ error: `requiredMembershipTier must be one of ${MEMBERSHIP_TIERS.join(', ')}` }, { status: 400 }))
          }
          patch.requiredMembershipTier = body.requiredMembershipTier
        }
        if (body.trialEligible !== undefined) patch.trialEligible = !!body.trialEligible
        if (body.defaultTrialDays !== undefined) {
          const n = Number(body.defaultTrialDays)
          if (!Number.isFinite(n) || n < 0 || n > 365) {
            return handleCORS(NextResponse.json({ error: 'defaultTrialDays must be 0-365' }, { status: 400 }))
          }
          patch.defaultTrialDays = Math.round(n)
        }
        if (body.notes !== undefined) patch.notes = s(body.notes, 2000)

        if (Object.keys(patch).length === 0) {
          return handleCORS(NextResponse.json({ error: 'No supported fields to update' }, { status: 400 }))
        }

        const { before, after } = diffPatch(existing || def.seedDefaults, patch)
        patch.updatedBy = admin.id
        patch.updatedByEmail = admin.email
        patch.updatedAt = new Date()

        // ensureSeeded above guarantees the row exists; use plain update (no upsert)
        await db.collection('feature_flags').updateOne({ key }, { $set: patch })

        await writeAudit(db, admin, {
          action: 'feature.flag.updated',
          featureKey: key,
          scope: 'global',
          scopeId: null,
          oldValue: before,
          newValue: after,
          notes: body.auditNotes ? s(body.auditNotes, 500) : null,
        })

        const fresh = await db.collection('feature_flags').findOne({ key })
        return handleCORS(NextResponse.json({ flag: clean(fresh) }))
      }
    }
  }

  // ====================================================================
  // /admin/feature-grants — per-account grants (Phase B)
  // ====================================================================
  const VALID_SCOPES = ['user', 'facility']
  const VALID_GRANT_STATUSES = ['active', 'trial', 'paused', 'expired', 'revoked']
  const VALID_FLAG_KEYS = new Set(FEATURE_KEYS)

  // Look up the entity being granted to (for nicer audit notes + denormalized
  // display fields on the grant row).
  async function lookupScope(scope, scopeId) {
    if (scope === 'user') {
      const u = await db.collection('users').findOne({ id: scopeId }, { projection: { id: 1, email: 1, name: 1 } })
      return u ? { ok: true, label: u.email || u.name || u.id } : { ok: false }
    }
    if (scope === 'facility') {
      const f = await db.collection('facilities').findOne({ id: scopeId }, { projection: { id: 1, name: 1, address: 1 } })
      return f ? { ok: true, label: f.name || f.id } : { ok: false }
    }
    return { ok: false }
  }

  // GET /admin/feature-grants
  if (route === '/admin/feature-grants' && method === 'GET') {
    const scope = url.searchParams.get('scope')
    const scopeId = url.searchParams.get('scopeId')
    const featureKey = url.searchParams.get('featureKey')
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '200', 10)))
    const q = {}
    if (scope && VALID_SCOPES.includes(scope)) q.scope = scope
    if (scopeId) q.scopeId = scopeId
    if (featureKey && VALID_FLAG_KEYS.has(featureKey)) q.featureKey = featureKey
    const rows = await db.collection('feature_grants').find(q).sort({ createdAt: -1 }).limit(limit).toArray()
    return handleCORS(NextResponse.json({ grants: rows.map(clean) }))
  }

  // POST /admin/feature-grants
  if (route === '/admin/feature-grants' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const scope = body.scope
    const scopeId = s(body.scopeId, 80)
    const featureKey = s(body.featureKey, 60)
    const status = body.status || 'active'
    const trialDays = body.trialDays != null ? Number(body.trialDays) : 0

    if (!VALID_SCOPES.includes(scope)) {
      return handleCORS(NextResponse.json({ error: `scope must be one of ${VALID_SCOPES.join(', ')}` }, { status: 400 }))
    }
    if (!scopeId) return handleCORS(NextResponse.json({ error: 'scopeId is required' }, { status: 400 }))
    if (!VALID_FLAG_KEYS.has(featureKey)) {
      return handleCORS(NextResponse.json({ error: 'Unknown featureKey' }, { status: 400 }))
    }
    if (!VALID_GRANT_STATUSES.includes(status)) {
      return handleCORS(NextResponse.json({ error: `status must be one of ${VALID_GRANT_STATUSES.join(', ')}` }, { status: 400 }))
    }
    if (trialDays && (!Number.isFinite(trialDays) || trialDays < 0 || trialDays > 365)) {
      return handleCORS(NextResponse.json({ error: 'trialDays must be 0-365' }, { status: 400 }))
    }

    // Resolve scope label
    const target = await lookupScope(scope, scopeId)
    if (!target.ok) return handleCORS(NextResponse.json({ error: `No ${scope} found with that scopeId` }, { status: 404 }))

    const now = new Date()
    const grantId = uuidv4()
    const trialStartAt = (status === 'trial' && trialDays > 0) ? now : null
    const trialEndAt = (status === 'trial' && trialDays > 0)
      ? new Date(now.getTime() + trialDays * 86400000)
      : null

    // Upsert: one active grant per (scope, scopeId, featureKey).
    // If one already exists, update it; otherwise create.
    const existing = await db.collection('feature_grants').findOne({ scope, scopeId, featureKey })
    let savedId = grantId

    if (existing) {
      const before = { status: existing.status, trialEndAt: existing.trialEndAt }
      const patch = {
        status,
        trialStartAt,
        trialEndAt,
        notes: body.notes !== undefined ? s(body.notes, 1000) : existing.notes,
        updatedAt: now,
        grantedBy: admin.id,
        grantedByEmail: admin.email,
      }
      if (status !== 'revoked') {
        patch.revokedAt = null
        patch.revokedBy = null
        patch.revokedByEmail = null
      }
      await db.collection('feature_grants').updateOne({ id: existing.id }, { $set: patch })
      savedId = existing.id
      await writeAudit(db, admin, {
        action: 'feature.grant.updated',
        featureKey,
        scope,
        scopeId,
        oldValue: before,
        newValue: { status, trialEndAt },
        notes: body.auditNotes ? s(body.auditNotes, 500) : `Granted to ${scope} ${target.label}`,
      })
    } else {
      const doc = {
        id: grantId,
        featureKey,
        scope,
        scopeId,
        scopeLabel: target.label,
        status,
        trialStartAt,
        trialEndAt,
        grantedBy: admin.id,
        grantedByEmail: admin.email,
        grantedAt: now,
        revokedBy: null,
        revokedByEmail: null,
        revokedAt: null,
        notes: s(body.notes || '', 1000),
        createdAt: now,
        updatedAt: now,
      }
      await db.collection('feature_grants').insertOne(doc)
      await writeAudit(db, admin, {
        action: 'feature.grant.created',
        featureKey,
        scope,
        scopeId,
        oldValue: null,
        newValue: { status, trialEndAt },
        notes: body.auditNotes ? s(body.auditNotes, 500) : `Granted ${featureKey} to ${scope} ${target.label}`,
      })
    }

    const fresh = await db.collection('feature_grants').findOne({ id: savedId })
    return handleCORS(NextResponse.json({ grant: clean(fresh) }, { status: existing ? 200 : 201 }))
  }

  // /admin/feature-grants/:id  (PATCH, DELETE)
  if (route.startsWith('/admin/feature-grants/')) {
    const id = route.slice('/admin/feature-grants/'.length).split('/')[0]
    if (!id) return handleCORS(NextResponse.json({ error: 'id required' }, { status: 400 }))
    const existing = await db.collection('feature_grants').findOne({ id })
    if (!existing) return handleCORS(NextResponse.json({ error: 'Grant not found' }, { status: 404 }))

    if (method === 'PATCH') {
      const body = await request.json().catch(() => ({}))
      const patch = { updatedAt: new Date() }
      if (body.status !== undefined) {
        if (!VALID_GRANT_STATUSES.includes(body.status)) {
          return handleCORS(NextResponse.json({ error: `status must be one of ${VALID_GRANT_STATUSES.join(', ')}` }, { status: 400 }))
        }
        patch.status = body.status
      }
      if (body.notes !== undefined) patch.notes = s(body.notes, 1000)
      if (body.trialDays !== undefined && body.trialDays > 0) {
        const td = Number(body.trialDays)
        if (!Number.isFinite(td) || td < 0 || td > 365) {
          return handleCORS(NextResponse.json({ error: 'trialDays must be 0-365' }, { status: 400 }))
        }
        patch.trialStartAt = new Date()
        patch.trialEndAt = new Date(Date.now() + td * 86400000)
      }
      if (Object.keys(patch).length === 1) {
        return handleCORS(NextResponse.json({ error: 'No editable fields provided' }, { status: 400 }))
      }
      await db.collection('feature_grants').updateOne({ id }, { $set: patch })
      const fresh = await db.collection('feature_grants').findOne({ id })
      await writeAudit(db, admin, {
        action: 'feature.grant.patched',
        featureKey: existing.featureKey,
        scope: existing.scope,
        scopeId: existing.scopeId,
        oldValue: { status: existing.status, trialEndAt: existing.trialEndAt },
        newValue: { status: fresh.status, trialEndAt: fresh.trialEndAt },
        notes: body.auditNotes ? s(body.auditNotes, 500) : null,
      })
      return handleCORS(NextResponse.json({ grant: clean(fresh) }))
    }

    if (method === 'DELETE') {
      // Soft-revoke: keep the row, status='revoked', record revokedBy.
      const now = new Date()
      await db.collection('feature_grants').updateOne(
        { id },
        { $set: { status: 'revoked', revokedAt: now, revokedBy: admin.id, revokedByEmail: admin.email, updatedAt: now } },
      )
      await writeAudit(db, admin, {
        action: 'feature.grant.revoked',
        featureKey: existing.featureKey,
        scope: existing.scope,
        scopeId: existing.scopeId,
        oldValue: { status: existing.status },
        newValue: { status: 'revoked' },
        notes: `Revoked grant ${id}`,
      })
      const fresh = await db.collection('feature_grants').findOne({ id })
      return handleCORS(NextResponse.json({ grant: clean(fresh) }))
    }
  }



  return handleCORS(NextResponse.json({ error: 'Method not allowed' }, { status: 405 }))
}
