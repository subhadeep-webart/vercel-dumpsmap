// Field Mode + general user preferences handler module.
// Endpoints:
//   PATCH /api/users/me/preferences   { viewMode?, fieldModeOnboarded?, viewPreference?, ... }
//   GET   /api/users/me/preferences   → { viewMode, fieldModeOnboarded, viewPreference, locale }

const ALLOWED_VIEW_MODES = new Set(['standard', 'field'])
const ALLOWED_VIEW_PREFS = new Set(['auto', 'mobile', 'desktop'])

export async function handle(ctx) {
  const { route, method, request, db, getAuth, clean, NextResponse, handleCORS } = ctx

  if (route !== '/users/me/preferences') return null

  const auth = getAuth(request)
  if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))

  if (method === 'GET') {
    const u = await db.collection('users').findOne({ id: auth.id })
    if (!u) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    return handleCORS(NextResponse.json({
      preferences: {
        viewMode: u.viewMode || null,
        fieldModeOnboarded: !!u.fieldModeOnboarded,
        viewPreference: u.viewPreference || 'auto',
        locale: u.locale || 'en',
      },
    }))
  }

  if (method === 'PATCH') {
    const body = await request.json().catch(() => ({}))
    const update = { updatedAt: new Date() }
    if (body.viewMode !== undefined) {
      if (!ALLOWED_VIEW_MODES.has(body.viewMode)) {
        return handleCORS(NextResponse.json({ error: 'viewMode must be "standard" or "field"' }, { status: 400 }))
      }
      update.viewMode = body.viewMode
    }
    if (body.viewPreference !== undefined) {
      if (!ALLOWED_VIEW_PREFS.has(body.viewPreference)) {
        return handleCORS(NextResponse.json({ error: 'viewPreference must be "auto", "mobile", or "desktop"' }, { status: 400 }))
      }
      update.viewPreference = body.viewPreference
    }
    if (body.fieldModeOnboarded !== undefined) update.fieldModeOnboarded = !!body.fieldModeOnboarded
    if (body.locale !== undefined && typeof body.locale === 'string') update.locale = body.locale.slice(0, 8)
    if (Object.keys(update).length === 1) {
      return handleCORS(NextResponse.json({ error: 'No supported preferences provided' }, { status: 400 }))
    }
    await db.collection('users').updateOne({ id: auth.id }, { $set: update })
    const fresh = await db.collection('users').findOne({ id: auth.id })
    return handleCORS(NextResponse.json({
      preferences: {
        viewMode: fresh.viewMode || null,
        fieldModeOnboarded: !!fresh.fieldModeOnboarded,
        viewPreference: fresh.viewPreference || 'auto',
        locale: fresh.locale || 'en',
      },
      user: clean(fresh),
    }))
  }

  return handleCORS(NextResponse.json({ error: 'Method not allowed' }, { status: 405 }))
}
