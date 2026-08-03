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
