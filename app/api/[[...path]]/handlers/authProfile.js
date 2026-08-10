// handlers/authProfile.js
// ----------------------------------------------------------------------------
// Phase 1: Auth Audit + Profile Redesign
//
// Endpoints (all under /api):
//
//   AUTH
//     POST  /auth/forgot-password    — mocked email (logs reset link to console)
//     POST  /auth/reset-password     — consume reset token + set new password
//     POST  /auth/change-password    — for logged-in user (current + new pw)
//     POST  /auth/logout             — record logout (optional audit trail)
//
//   PROFILE
//     GET   /users/me/profile        — full profile object (richer than /auth/me)
//     PATCH /users/me/profile        — update any subset of editable fields
//
// All editable profile fields:
//
//   PERSONAL
//     name, email, phone, addressLine1, addressLine2, city, state, zip
//
//   PROFILE
//     avatarUrl, coverImageUrl, bio, companyName, website, serviceAreaRadiusMi
//
//   AVAILABILITY
//     availabilityStatus: 'available'|'busy'|'offline'|'not_accepting'
//
//   PAYMENT PREFERENCES
//     paymentMethodsAccepted: string[] (subset of allowed types)
//
//   VISIBILITY
//     profileVisibility: 'public'|'private'
//
// Email change requires uniqueness validation + lowers verification state.
// ----------------------------------------------------------------------------

const bcrypt = require('bcryptjs')

const AVAILABILITY_STATUSES = ['available', 'busy', 'offline', 'not_accepting']
const PROFILE_VISIBILITY = ['public', 'private']
const PAYMENT_TYPES = ['stripe', 'paypal', 'cashapp', 'zelle', 'venmo', 'check', 'cash', 'ach', 'other']

// 10 profile types from the architecture mockup
const PROFILE_TYPES = [
  'resident', 'contractor', 'facility', 'recycler', 'donation_center',
  'vendor', 'property_manager', 'government', 'enterprise', 'super_admin',
]

// Business sub-type per profile (independent vs company representative)
const BUSINESS_REPRESENTATION = ['independent', 'company_representative']

// Document categories users can upload
const DOCUMENT_CATEGORIES = [
  'drivers_license', 'contractor_license', 'insurance_certificate',
  'w9', 'business_logo', 'certification', 'other',
]

const PERSONAL_FIELDS = ['name', 'phone', 'addressLine1', 'addressLine2', 'city', 'state', 'zip']
// `profilePhotoUrl` is the new canonical photo field — mirrored to avatarUrl
// for backward compat with legacy reads across the app.
const PROFILE_FIELDS  = ['avatarUrl', 'profilePhotoUrl', 'coverImageUrl', 'bio', 'companyName', 'website', 'businessType', 'ein']
const NUMERIC_FIELDS  = ['serviceAreaRadiusMi']

function clean(doc) {
  if (!doc) return doc
  const { _id, passwordHash, resetToken, resetTokenExpires, ...rest } = doc
  return rest
}

// Public profile projection — the ONLY fields a public/anonymous viewer may
// see. This is an allowlist by construction (we build a fresh object rather than
// deleting from the user record), so a new sensitive field added to `users`
// later can never leak here by accident. Explicitly excluded: email, phone,
// address*, zip, ein, documents, paymentMethodsAccepted, notifications,
// resetToken, passwordHash, profileVisibility internals.
function publicProfileProjection(u) {
  if (!u) return null
  const photo = u.profilePhotoUrl || u.avatarUrl || ''
  return {
    id: u.id,
    name: u.name || u.email?.split('@')[0] || 'DumpMaps member',
    profilePhotoUrl: photo,
    avatarUrl: photo,
    coverImageUrl: u.coverImageUrl || '',
    bio: u.bio || '',
    companyName: u.companyName || '',
    website: u.website || '',
    city: u.city || '',
    state: u.state || '',
    role: u.role || 'user',
    profileType: u.profileType || '',
    verified: !!u.verified,
    verificationLevel: u.verificationLevel || null,
    availabilityStatus: u.availabilityStatus || 'available',
    createdAt: u.createdAt || null,
  }
}

function cryptoRandomToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).slice(2, 10)
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function normaliseString(v, max = 200) {
  if (v == null) return v
  return String(v).trim().slice(0, max)
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim())
}

function isValidUrl(s) {
  if (!s) return true
  try { new URL(s); return true } catch { return false }
}

export async function handle(ctx) {
  const { route, method, request, db, NextResponse, handleCORS, getAuth } = ctx

  // --------------------------------------------------------------------------
  // AUTH — change-password + logout (forgot/reset live in passwordReset.js)
  // --------------------------------------------------------------------------

  // POST /auth/change-password { currentPassword, newPassword } — auth required
  if (route === '/auth/change-password' && method === 'POST') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const body = await request.json().catch(() => ({}))
    const currentPassword = String(body.currentPassword || '')
    const newPassword = String(body.newPassword || '')
    if (newPassword.length < 8) {
      return handleCORS(NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 }))
    }
    const user = await db.collection('users').findOne({ id: auth.id })
    if (!user) return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    const ok = await bcrypt.compare(currentPassword, user.passwordHash || '')
    if (!ok) return handleCORS(NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 }))
    const hash = await bcrypt.hash(newPassword, 10)
    await db.collection('users').updateOne({ id: auth.id }, { $set: {
      passwordHash: hash, passwordChangedAt: new Date(),
    } })
    return handleCORS(NextResponse.json({ ok: true }))
  }

  // POST /auth/logout — records the event and expires the auth cookies. Bearer
  // clients additionally drop their own stored token client-side.
  if (route === '/auth/logout' && method === 'POST') {
    const auth = getAuth(request)
    if (auth?.id) {
      await db.collection('users').updateOne({ id: auth.id }, { $set: { lastLogoutAt: new Date() } }).catch(() => {})
    }
    const res = handleCORS(NextResponse.json({ ok: true }))
    // Expire both the httpOnly session cookie and the readable CSRF cookie.
    const secure = process.env.NODE_ENV === 'production'
    res.cookies.set('dm_token', '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 })
    res.cookies.set('dm_csrf', '', { httpOnly: false, secure, sameSite: 'lax', path: '/', maxAge: 0 })
    return res
  }

  // --------------------------------------------------------------------------
  // PROFILE — extended editable profile
  // --------------------------------------------------------------------------

  if (route === '/users/me/profile' && method === 'GET') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const user = await db.collection('users').findOne({ id: auth.id })
    if (!user) return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    return handleCORS(NextResponse.json({ user: clean(user) }))
  }

  // --------------------------------------------------------------------------
  // PUBLIC PROFILE — a FB-mobile-style, viewable-by-anyone profile page.
  //
  //   GET /users/:id/profile-public         — whitelisted public projection
  //   GET /users/:id/profile-public/posts   — that user's community posts
  //   GET /users/:id/profile-public/listings— that user's B2B marketplace items
  //
  // These are intentionally NOT auth-gated: a public profile is browsable
  // signed-out. But they respect profileVisibility ('private' → minimal stub)
  // and only ever expose a hand-picked whitelist — never email, phone, address,
  // EIN, documents, payment methods, or notification settings. The private-field
  // audit is enforced by publicProfileProjection(), not by trusting clean().
  // --------------------------------------------------------------------------

  // Match /users/:id/profile-public with optional /posts | /listings suffix.
  // `me` resolves to the caller's own id so the page can offer an Edit shortcut.
  const publicMatch = route.match(/^\/users\/([^/]+)\/profile-public(?:\/(posts|listings))?$/)
  if (publicMatch && method === 'GET') {
    const rawId = decodeURIComponent(publicMatch[1])
    const sub = publicMatch[2] || null
    const viewer = getAuth(request)
    // Resolve 'me' so /users/me/profile-public works for the signed-in user.
    const targetId = rawId === 'me' ? viewer?.id : rawId
    if (!targetId) return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }))

    const user = await db.collection('users').findOne({ id: targetId })
    if (!user) return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }))

    const isOwner = !!viewer && viewer.id === user.id
    const isPrivate = String(user.profileVisibility || 'public') === 'private'

    // A private profile hides everything but a name + avatar stub — UNLESS the
    // owner is viewing their own page (they always see their full profile).
    if (isPrivate && !isOwner) {
      // Sub-resource requests on a private profile return empty, not the stub.
      if (sub) return handleCORS(NextResponse.json({ items: [], total: 0, private: true }))
      return handleCORS(NextResponse.json({
        user: {
          id: user.id,
          name: user.name || 'DumpMaps member',
          profilePhotoUrl: user.profilePhotoUrl || user.avatarUrl || '',
          avatarUrl: user.profilePhotoUrl || user.avatarUrl || '',
        },
        private: true,
        isOwner: false,
      }))
    }

    // ---- Sub-resource: community posts authored by this user ----
    if (sub === 'posts') {
      const url = new URL(request.url)
      const limit = Math.min(30, Math.max(1, Number(url.searchParams.get('limit') || 12)))
      const posts = await db.collection('community_posts')
        .find({ authorId: user.id, status: { $ne: 'removed' } })
        .sort({ createdAt: -1 }).limit(limit).toArray()
      const items = posts.map((p) => ({
        id: p.id,
        title: p.title || '',
        body: (p.body || '').slice(0, 280),
        category: p.category || 'general',
        photos: Array.isArray(p.photos) ? p.photos.slice(0, 1) : [],
        city: p.city || '',
        state: p.state || '',
        likes: p.reactionCount || 0,
        comments: p.commentCount || 0,
        createdAt: p.createdAt,
        href: `/community/posts/${p.id}`,
      }))
      return handleCORS(NextResponse.json({ items, total: items.length }))
    }

    // ---- Sub-resource: B2B marketplace listings sold by this user ----
    if (sub === 'listings') {
      const url = new URL(request.url)
      const limit = Math.min(30, Math.max(1, Number(url.searchParams.get('limit') || 12)))
      const rows = await db.collection('marketplace_listings')
        .find({ sellerId: user.id, status: { $ne: 'removed' }, sold: { $ne: true } })
        .sort({ createdAt: -1 }).limit(limit).toArray()
      const items = rows.map((l) => ({
        id: l.id,
        title: l.title || '',
        price: typeof l.price === 'number' ? l.price : null,
        condition: l.condition || null,
        category: l.b2bCategory || l.category || null,
        photo: (Array.isArray(l.photos) && l.photos[0]) || (Array.isArray(l.images) && l.images[0]) || null,
        city: l.city || '',
        state: l.state || '',
        createdAt: l.createdAt,
        href: `/marketplace?listing=${l.id}`,
      }))
      return handleCORS(NextResponse.json({ items, total: items.length }))
    }

    // ---- Main public profile projection (whitelist only) ----
    const [postCount, listingCount] = await Promise.all([
      db.collection('community_posts').countDocuments({ authorId: user.id, status: { $ne: 'removed' } }).catch(() => 0),
      db.collection('marketplace_listings').countDocuments({ sellerId: user.id, status: { $ne: 'removed' }, sold: { $ne: true } }).catch(() => 0),
    ])

    return handleCORS(NextResponse.json({
      user: publicProfileProjection(user),
      isOwner,
      private: false,
      stats: { posts: postCount, listings: listingCount },
    }))
  }

  if (route === '/users/me/profile' && method === 'PATCH') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const body = await request.json().catch(() => ({}))
    const update = {}

    // -- Profile type (one of 10) --
    if (body.profileType !== undefined) {
      const t = String(body.profileType || '').toLowerCase()
      if (!PROFILE_TYPES.includes(t)) {
        return handleCORS(NextResponse.json({ error: `profileType must be one of: ${PROFILE_TYPES.join(', ')}` }, { status: 400 }))
      }
      update.profileType = t
      update.profileTypeSetAt = new Date()
    }

    // -- Business representation --
    if (body.isRepresentative !== undefined) {
      const v = String(body.isRepresentative || '').toLowerCase()
      if (!BUSINESS_REPRESENTATION.includes(v)) {
        return handleCORS(NextResponse.json({ error: `isRepresentative must be one of: ${BUSINESS_REPRESENTATION.join(', ')}` }, { status: 400 }))
      }
      update.isRepresentative = v
    }

    // -- Service Area: zipCodes + preferredZones (arrays of short strings) --
    if (body.zipCodes !== undefined) {
      const arr = Array.isArray(body.zipCodes) ? body.zipCodes : []
      update.zipCodes = [...new Set(arr.map((x) => String(x || '').trim()).filter((x) => /^[0-9-]{1,10}$/.test(x)))].slice(0, 50)
    }
    if (body.preferredZones !== undefined) {
      const arr = Array.isArray(body.preferredZones) ? body.preferredZones : []
      update.preferredZones = [...new Set(arr.map((x) => normaliseString(x, 100)).filter(Boolean))].slice(0, 20)
    }

    // -- Notifications: simple flags --
    if (body.notifications !== undefined && typeof body.notifications === 'object') {
      const FLAGS = ['email', 'sms', 'push', 'newJobs', 'newBounties', 'rewardsEarned', 'workOrderUpdates']
      const next = {}
      for (const k of FLAGS) if (typeof body.notifications[k] === 'boolean') next[k] = body.notifications[k]
      if (Object.keys(next).length) update.notifications = { ...(body.notifications._existing || {}), ...next }
    }

    // -- Documents: array of { id, category, url, label, uploadedAt } --
    if (Array.isArray(body.documents)) {
      const cleaned = body.documents
        .filter((d) => d && typeof d === 'object' && d.url)
        .map((d) => ({
          id: d.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
          category: DOCUMENT_CATEGORIES.includes(d.category) ? d.category : 'other',
          url: normaliseString(d.url, 500),
          label: normaliseString(d.label || '', 200),
          uploadedAt: d.uploadedAt ? new Date(d.uploadedAt) : new Date(),
        }))
        .slice(0, 50)
      update.documents = cleaned
    }

    // -- Personal string fields --
    for (const k of PERSONAL_FIELDS) {
      if (body[k] !== undefined) update[k] = normaliseString(body[k], 200)
    }
    for (const k of PROFILE_FIELDS) {
      if (body[k] !== undefined) update[k] = normaliseString(body[k], k === 'bio' ? 1000 : 500)
    }

    // Mirror profilePhotoUrl ↔ avatarUrl so both legacy and canonical reads
    // pick up the new photo immediately (Activity Hub, Marketplace, Community,
    // ProfileDialog, etc. all still read avatarUrl).
    if (update.profilePhotoUrl !== undefined && update.avatarUrl === undefined) {
      update.avatarUrl = update.profilePhotoUrl
    }
    if (update.avatarUrl !== undefined && update.profilePhotoUrl === undefined) {
      update.profilePhotoUrl = update.avatarUrl
    }

    // -- Email change (validate format + uniqueness) --
    if (body.email !== undefined) {
      const newEmail = normaliseString(body.email, 200).toLowerCase()
      if (!isValidEmail(newEmail)) {
        return handleCORS(NextResponse.json({ error: 'Invalid email' }, { status: 400 }))
      }
      const existing = await db.collection('users').findOne({ email: newEmail, id: { $ne: auth.id } })
      if (existing) {
        return handleCORS(NextResponse.json({ error: 'Email already in use' }, { status: 409 }))
      }
      update.email = newEmail
      // Resetting email-verification gates re-verification; phone is independent.
      update.emailVerified = false
    }

    // -- Website URL validation --
    if (body.website !== undefined) {
      const w = normaliseString(body.website, 500)
      if (w && !isValidUrl(w.startsWith('http') ? w : `https://${w}`)) {
        return handleCORS(NextResponse.json({ error: 'Invalid website URL' }, { status: 400 }))
      }
      update.website = w ? (w.startsWith('http') ? w : `https://${w}`) : ''
    }

    // -- Numeric fields --
    for (const k of NUMERIC_FIELDS) {
      if (body[k] !== undefined) {
        const n = Number(body[k])
        if (!Number.isFinite(n) || n < 0 || n > 500) {
          return handleCORS(NextResponse.json({ error: `${k} must be a number 0-500` }, { status: 400 }))
        }
        update[k] = n
      }
    }

    // -- Availability status (enum) --
    if (body.availabilityStatus !== undefined) {
      const s = String(body.availabilityStatus || '').toLowerCase()
      if (!AVAILABILITY_STATUSES.includes(s)) {
        return handleCORS(NextResponse.json({ error: `availabilityStatus must be one of: ${AVAILABILITY_STATUSES.join(', ')}` }, { status: 400 }))
      }
      update.availabilityStatus = s
      update.availabilityStatusUpdatedAt = new Date()
    }

    // -- Profile visibility --
    if (body.profileVisibility !== undefined) {
      const v = String(body.profileVisibility || '').toLowerCase()
      if (!PROFILE_VISIBILITY.includes(v)) {
        return handleCORS(NextResponse.json({ error: `profileVisibility must be one of: ${PROFILE_VISIBILITY.join(', ')}` }, { status: 400 }))
      }
      update.profileVisibility = v
    }

    // -- Payment methods accepted (array) --
    if (body.paymentMethodsAccepted !== undefined) {
      const arr = Array.isArray(body.paymentMethodsAccepted) ? body.paymentMethodsAccepted : []
      const cleaned = arr
        .map((x) => String(x || '').toLowerCase().trim())
        .filter((x) => PAYMENT_TYPES.includes(x))
      update.paymentMethodsAccepted = [...new Set(cleaned)]
    }

    // -- Bio also length-validated --
    if (update.bio !== undefined && update.bio.length > 1000) {
      update.bio = update.bio.slice(0, 1000)
    }

    // Anything to update?
    if (Object.keys(update).length === 0) {
      const user = await db.collection('users').findOne({ id: auth.id })
      return handleCORS(NextResponse.json({ user: clean(user), changed: 0 }))
    }

    update.profileUpdatedAt = new Date()
    await db.collection('users').updateOne({ id: auth.id }, { $set: update })
    const user = await db.collection('users').findOne({ id: auth.id })
    return handleCORS(NextResponse.json({ user: clean(user), changed: Object.keys(update).length }))
  }

  return null
}
