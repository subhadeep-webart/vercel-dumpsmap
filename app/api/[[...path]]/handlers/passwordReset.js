// PR-2c: Password reset (forgot-password + admin-initiated reset)
//
// Endpoints:
//   POST /api/auth/forgot-password
//     Body: { email }
//     Always returns the same safe message regardless of whether the email
//     exists (defense against enumeration). When the email DOES exist, a
//     reset link is generated, logged to the server console, and recorded in
//     the activity_log (auth.forgot_password event).
//
//   POST /api/auth/reset-password
//     Body: { token, password }
//     Validates the token (must exist, not used, not expired). On success:
//     updates user.passwordHash via bcrypt and marks the token used.
//
//   POST /api/admin/users/:id/send-password-reset (admin/super_admin only)
//     Generates a reset token for the given user and returns the reset URL
//     in the response body so the admin UI can display/copy it (this is the
//     "no email infrastructure yet — surface link in modal" path).
//
// Token storage: collection `password_reset_tokens` with shape
//   { id, token (raw uuid), userId, email, createdAt, expiresAt, used,
//     usedAt, issuedBy ('user' | adminUserId) }
//
// Tokens expire after 1 hour and are single-use.

const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour
const STAFF_ROLES_LOCAL = ['super_admin', 'admin', 'moderator']

function makeToken() {
  // Hex token is URL-safe and easy to copy/paste. 32 bytes = 64 hex chars.
  return crypto.randomBytes(32).toString('hex')
}

function baseUrl(request) {
  // Build a "{protocol}://{host}" base for the reset link. Falls back to
  // NEXT_PUBLIC_BASE_URL or relative root.
  try {
    const u = new URL(request.url)
    return `${u.protocol}//${u.host}`
  } catch {
    return process.env.NEXT_PUBLIC_BASE_URL || ''
  }
}

function safeEmail(email) {
  return String(email || '').trim().toLowerCase().slice(0, 200)
}

async function issueResetToken(db, user, issuedBy = 'user') {
  const token = makeToken()
  const now = new Date()
  await db.collection('password_reset_tokens').insertOne({
    id: token, // we just use the token as the id
    token,
    userId: user.id,
    email: user.email,
    createdAt: now,
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
    used: false,
    usedAt: null,
    issuedBy,
  })
  return token
}

export async function handle(ctx) {
  const { route, method, request, db, getAuth, NextResponse, handleCORS, logActivity } = ctx

  // ----- POST /auth/forgot-password (PUBLIC) ------------------------------
  if (route === '/auth/forgot-password' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const email = safeEmail(body.email)
    const safeMsg = { ok: true, message: 'If an account exists for that email, a reset link has been sent.' }
    if (!email) return handleCORS(NextResponse.json(safeMsg))
    const user = await db.collection('users').findOne({ email })
    if (!user) {
      // Always return safe message — never reveal whether the email exists.
      return handleCORS(NextResponse.json(safeMsg))
    }
    const token = await issueResetToken(db, user, 'user')
    const link = `${baseUrl(request)}/reset-password?token=${token}`
    // Log the link to the server console (replaces real email infra for now).
    console.warn(`[PASSWORD RESET] Reset link for ${email} — ${link}`)
    try {
      await logActivity(db, { id: user.id, email: user.email }, 'auth.forgot_password', { kind: 'user', id: user.id, label: user.email }, { issuedBy: 'user' })
    } catch {}
    return handleCORS(NextResponse.json(safeMsg))
  }

  // ----- POST /auth/reset-password (PUBLIC) -------------------------------
  if (route === '/auth/reset-password' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const token = String(body.token || '').trim()
    const password = String(body.password || '')
    if (!token || !password) {
      return handleCORS(NextResponse.json({ error: 'token and password required' }, { status: 400 }))
    }
    if (password.length < 8) {
      return handleCORS(NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 }))
    }
    const rec = await db.collection('password_reset_tokens').findOne({ token })
    if (!rec) {
      return handleCORS(NextResponse.json({ error: 'Invalid or expired reset link. Please request a new one.' }, { status: 400 }))
    }
    if (rec.used) {
      return handleCORS(NextResponse.json({ error: 'This reset link has already been used. Please request a new one.' }, { status: 400 }))
    }
    if (rec.expiresAt && new Date(rec.expiresAt) < new Date()) {
      return handleCORS(NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 }))
    }
    const user = await db.collection('users').findOne({ id: rec.userId })
    if (!user) {
      return handleCORS(NextResponse.json({ error: 'Account no longer exists' }, { status: 400 }))
    }
    const hash = await bcrypt.hash(password, 10)
    await db.collection('users').updateOne({ id: user.id }, { $set: { passwordHash: hash, updatedAt: new Date() } })
    await db.collection('password_reset_tokens').updateOne({ token }, { $set: { used: true, usedAt: new Date() } })
    try {
      await logActivity(db, { id: user.id, email: user.email }, 'auth.password_reset', { kind: 'user', id: user.id, label: user.email }, { via: rec.issuedBy === 'user' ? 'self' : 'admin' })
    } catch {}
    return handleCORS(NextResponse.json({ ok: true, message: 'Password updated. You can now log in with your new password.' }))
  }

  // ----- POST /admin/users/:id/send-password-reset (ADMIN) ----------------
  if (route.match(/^\/admin\/users\/[^/]+\/send-password-reset$/) && method === 'POST') {
    const auth = getAuth(request)
    if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
    const admin = await db.collection('users').findOne({ id: auth.id })
    if (!admin || !STAFF_ROLES_LOCAL.includes(admin.role)) {
      return handleCORS(NextResponse.json({ error: 'Admin access required' }, { status: 403 }))
    }
    const targetId = route.split('/')[3]
    const user = await db.collection('users').findOne({ id: targetId })
    if (!user) return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    const token = await issueResetToken(db, user, admin.id)
    const link = `${baseUrl(request)}/reset-password?token=${token}`
    console.warn(`[PASSWORD RESET — ADMIN ${admin.email}] Reset link for ${user.email} — ${link}`)
    try {
      await logActivity(db, admin, 'admin.send_password_reset', { kind: 'user', id: user.id, label: user.email }, { issuedBy: admin.id })
    } catch {}
    return handleCORS(NextResponse.json({
      ok: true,
      resetLink: link,
      token,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
      message: `Reset link generated for ${user.email}. Copy and share with the user (link expires in 1 hour).`,
    }))
  }

  return null
}
