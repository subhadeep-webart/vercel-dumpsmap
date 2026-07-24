// P6: Payment Method Profiles — Stripe SetupIntents flow.
//
// Endpoints (all require an authenticated user):
//   GET    /api/stripe/config                        → publishable key + mode (safe)
//   POST   /api/users/me/payment-methods/setup       → lazy-create Stripe Customer, return SetupIntent client_secret
//   POST   /api/users/me/payment-methods             → confirm + persist pm_xxx
//   GET    /api/users/me/payment-methods             → list user's saved cards
//   PATCH  /api/users/me/payment-methods/:id/default → set as Stripe invoice_settings.default_payment_method
//   DELETE /api/users/me/payment-methods/:id         → detach from Stripe + remove from DB
//
// MongoDB collection: `payment_methods`
//
// Schema (no raw card data ever):
// {
//   id, userId,
//   stripeCustomerId, stripePaymentMethodId,
//   brand, last4, expMonth, expYear,
//   isDefault: bool, status: 'active'|'detached',
//   createdAt, updatedAt
// }
//
// Stripe customer is lazy-created on first card save and persisted on the
// `users` doc as `stripeCustomerId`. We never read raw card data.

const { canAccessFeature } = require('../../../../lib/feature-control')

function pickCardSummary(pm) {
  const card = pm?.card || {}
  return {
    brand: card.brand || 'card',
    last4: card.last4 || '',
    expMonth: card.exp_month || null,
    expYear: card.exp_year || null,
    fingerprint: card.fingerprint || null,
    wallet: card.wallet?.type || null,
  }
}

function publicRow(row) {
  if (!row) return row
  const { _id, ...rest } = row
  return rest
}

async function ensureStripeCustomer(stripe, db, userRow) {
  if (userRow.stripeCustomerId) {
    // Verify customer still exists (rare drift); if missing, recreate.
    try {
      const c = await stripe.customers.retrieve(userRow.stripeCustomerId)
      if (c && !c.deleted) return userRow.stripeCustomerId
    } catch (_) {
      // fall through and create a new one
    }
  }
  const created = await stripe.customers.create({
    email: userRow.email || undefined,
    name: userRow.name || undefined,
    metadata: { dumpmapsUserId: String(userRow.id) },
  })
  await db.collection('users').updateOne(
    { id: userRow.id },
    { $set: { stripeCustomerId: created.id, updatedAt: new Date() } }
  )
  return created.id
}

// Make sure exactly one payment method is marked default for the user. If
// `targetId` is passed, that one becomes default; otherwise leave existing
// defaults alone. Also syncs Stripe customer.invoice_settings.
async function syncDefault(stripe, db, userId, customerId, targetId) {
  if (targetId) {
    await db.collection('payment_methods').updateMany(
      { userId, status: 'active' },
      { $set: { isDefault: false, updatedAt: new Date() } }
    )
    await db.collection('payment_methods').updateOne(
      { id: targetId, userId },
      { $set: { isDefault: true, updatedAt: new Date() } }
    )
    const row = await db.collection('payment_methods').findOne({ id: targetId, userId })
    if (row && customerId) {
      try {
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: row.stripePaymentMethodId },
        })
      } catch (e) {
        // non-fatal — DB default still recorded
        console.error('Stripe default sync failed:', e?.message)
      }
    }
  }
}

export async function handle(ctx) {
  const { route, method, request, db, getAuth, clean, uuidv4, NextResponse, handleCORS, getStripeConfig } = ctx

  // -------- /api/stripe/config (public) --------
  if (route === '/stripe/config' && method === 'GET') {
    const cfg = await getStripeConfig(db)
    return handleCORS(NextResponse.json({
      configured: !!cfg.ready,
      publishableKey: cfg.publishable || '',
      mode: cfg.publishable?.startsWith('pk_live_') ? 'live'
          : cfg.publishable?.startsWith('pk_test_') ? 'test'
          : null,
    }))
  }

  // Everything below this point is /users/me/payment-methods*
  if (!route.startsWith('/users/me/payment-methods')) return null

  const auth = getAuth(request)
  if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
  const userRow = await db.collection('users').findOne({ id: auth.id })
  if (!userRow) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))

  // Feature gate (additive — must pass on top of auth check)
  const flag = await db.collection('feature_flags').findOne({ key: 'paymentMethods' })
  const grant = await db.collection('feature_grants').findOne({
    key: 'paymentMethods', scope: 'user', scopeId: userRow.id,
  })
  const access = canAccessFeature(userRow, 'paymentMethods', {}, flag, grant)
  if (!access.allowed) {
    return handleCORS(NextResponse.json({
      error: 'Payment methods not available for this account',
      reason: access.reason,
      lockedState: access.lockedState,
    }, { status: 403 }))
  }

  const cfg = await getStripeConfig(db)
  if (!cfg.ready) {
    return handleCORS(NextResponse.json({
      error: 'Stripe is not configured. Add Stripe keys in Admin → Payments before saving cards.',
      stripeConfigured: false,
    }, { status: 503 }))
  }
  const stripe = cfg.client
  const pmCol = db.collection('payment_methods')

  // -------- POST /setup — lazy create customer + return SetupIntent --------
  if (route === '/users/me/payment-methods/setup' && method === 'POST') {
    try {
      const customerId = await ensureStripeCustomer(stripe, db, userRow)
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: { dumpmapsUserId: String(userRow.id) },
      })
      return handleCORS(NextResponse.json({
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
        customerId,
        publishableKey: cfg.publishable || '',
        mode: cfg.publishable?.startsWith('pk_live_') ? 'live' : 'test',
      }))
    } catch (e) {
      console.error('setupIntent.create failed:', e?.message)
      return handleCORS(NextResponse.json({ error: 'Failed to create setup intent', detail: String(e?.message || e) }, { status: 500 }))
    }
  }

  // -------- POST /users/me/payment-methods — confirm & persist --------
  if (route === '/users/me/payment-methods' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const paymentMethodId = String(body.paymentMethodId || '').trim()
    const setupIntentId = String(body.setupIntentId || '').trim()
    if (!paymentMethodId || !paymentMethodId.startsWith('pm_')) {
      return handleCORS(NextResponse.json({ error: 'paymentMethodId is required' }, { status: 400 }))
    }
    try {
      // Verify on Stripe — pulls real card metadata. If client passed a
      // setupIntentId we also confirm it succeeded and that the PM belongs
      // to our customer.
      const customerId = userRow.stripeCustomerId || (await ensureStripeCustomer(stripe, db, userRow))
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
      if (!pm || pm.type !== 'card') {
        return handleCORS(NextResponse.json({ error: 'Only card payment methods are supported' }, { status: 400 }))
      }
      // Ensure attached to our customer (Elements usually attaches via SetupIntent already,
      // but attach defensively if it's still loose).
      if (!pm.customer) {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
      } else if (pm.customer !== customerId) {
        return handleCORS(NextResponse.json({ error: 'Payment method belongs to a different customer' }, { status: 400 }))
      }
      // Optional SetupIntent verification
      if (setupIntentId) {
        try {
          const si = await stripe.setupIntents.retrieve(setupIntentId)
          if (si.status !== 'succeeded') {
            return handleCORS(NextResponse.json({ error: `Setup intent not complete (status=${si.status})`, status: si.status }, { status: 400 }))
          }
        } catch (_) { /* non-fatal */ }
      }
      // Idempotency: if we already have this PM for this user, return it.
      const existing = await pmCol.findOne({ userId: userRow.id, stripePaymentMethodId: paymentMethodId, status: 'active' })
      if (existing) {
        return handleCORS(NextResponse.json({ paymentMethod: publicRow(existing), duplicate: true }))
      }
      const isFirst = (await pmCol.countDocuments({ userId: userRow.id, status: 'active' })) === 0
      const card = pickCardSummary(pm)
      const now = new Date()
      const doc = {
        id: uuidv4(),
        userId: userRow.id,
        stripeCustomerId: customerId,
        stripePaymentMethodId: paymentMethodId,
        brand: card.brand,
        last4: card.last4,
        expMonth: card.expMonth,
        expYear: card.expYear,
        fingerprint: card.fingerprint,
        wallet: card.wallet,
        isDefault: isFirst, // first card auto-default
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }
      await pmCol.insertOne(doc)
      if (isFirst) {
        try {
          await stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: paymentMethodId },
          })
        } catch (e) { console.error('Stripe default sync (first card) failed:', e?.message) }
      }
      return handleCORS(NextResponse.json({ paymentMethod: publicRow(doc) }, { status: 201 }))
    } catch (e) {
      console.error('payment-methods POST failed:', e?.message)
      return handleCORS(NextResponse.json({ error: 'Failed to save payment method', detail: String(e?.message || e) }, { status: 500 }))
    }
  }

  // -------- GET /users/me/payment-methods — list --------
  if (route === '/users/me/payment-methods' && method === 'GET') {
    const rows = await pmCol
      .find({ userId: userRow.id, status: 'active' })
      .sort({ isDefault: -1, createdAt: -1 })
      .toArray()
    return handleCORS(NextResponse.json({ paymentMethods: rows.map(publicRow) }))
  }

  // -------- /users/me/payment-methods/:id[/default] --------
  if (route.startsWith('/users/me/payment-methods/')) {
    const tail = route.slice('/users/me/payment-methods/'.length)
    const segs = tail.split('/').filter(Boolean)
    const id = segs[0]
    const action = segs[1] || null

    const row = await pmCol.findOne({ id, userId: userRow.id })
    if (!row) return handleCORS(NextResponse.json({ error: 'Payment method not found' }, { status: 404 }))

    // PATCH /:id/default — set as default
    if (action === 'default' && method === 'PATCH') {
      try {
        await syncDefault(stripe, db, userRow.id, row.stripeCustomerId, row.id)
        const fresh = await pmCol.findOne({ id: row.id, userId: userRow.id })
        return handleCORS(NextResponse.json({ paymentMethod: publicRow(fresh) }))
      } catch (e) {
        console.error('set default failed:', e?.message)
        return handleCORS(NextResponse.json({ error: 'Failed to set default', detail: String(e?.message || e) }, { status: 500 }))
      }
    }

    // DELETE /:id — detach + soft delete
    if (segs.length === 1 && method === 'DELETE') {
      try {
        try { await stripe.paymentMethods.detach(row.stripePaymentMethodId) } catch (_) {
          // already detached / unknown → keep going
        }
        await pmCol.updateOne({ id: row.id }, { $set: { status: 'detached', isDefault: false, updatedAt: new Date() } })
        // If we just deleted the default, promote the most recent active card.
        if (row.isDefault) {
          const next = await pmCol.findOne(
            { userId: userRow.id, status: 'active', id: { $ne: row.id } },
            { sort: { createdAt: -1 } }
          )
          if (next) {
            await syncDefault(stripe, db, userRow.id, row.stripeCustomerId, next.id)
          } else {
            // No remaining cards — clear Stripe default
            try {
              await stripe.customers.update(row.stripeCustomerId, {
                invoice_settings: { default_payment_method: '' },
              })
            } catch (_) {}
          }
        }
        return handleCORS(NextResponse.json({ ok: true, id: row.id }))
      } catch (e) {
        console.error('delete payment method failed:', e?.message)
        return handleCORS(NextResponse.json({ error: 'Failed to delete', detail: String(e?.message || e) }, { status: 500 }))
      }
    }
  }

  return null
}
