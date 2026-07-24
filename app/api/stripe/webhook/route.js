import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { buildStripeConfig } from '@/lib/stripe'

// Stripe requires the raw body to verify the signature. The App Router
// route handler can return the raw bytes via request.arrayBuffer(). We
// pin this route to the Node runtime so the Stripe SDK can run.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let _client = null
async function getDb() {
  if (!_client) {
    _client = new MongoClient(process.env.MONGO_URL)
    await _client.connect()
  }
  return _client.db(process.env.DB_NAME || _client.db().databaseName)
}

async function getPaymentSettings(db) {
  const s = await db.collection('payment_settings').findOne({ id: 'singleton' })
  return s || {}
}

// Lowercase, trim, return null when blank — so dashboard de-dupes correctly.
function normEmail(e) {
  if (!e || typeof e !== 'string') return null
  const t = e.trim().toLowerCase()
  return t || null
}

function dollarsFromCents(cents) {
  const n = Number(cents)
  if (!Number.isFinite(n)) return 0
  return Math.round(n) / 100
}

/**
 * Upsert a finalized donation record from a Stripe Checkout Session.
 * Idempotent on stripeCheckoutSessionId — safe to call multiple times
 * for the same session (Stripe retries / replays).
 */
async function upsertDonationFromSession(db, { session, livemode, intentDoc }) {
  const email =
    normEmail(session.customer_details?.email) ||
    normEmail(session.customer_email) ||
    normEmail(session.metadata?.email) ||
    normEmail(intentDoc?.email) ||
    null

  const name =
    session.metadata?.name ||
    session.customer_details?.name ||
    intentDoc?.name ||
    ''

  // Prefer the canonical amount from the session itself (in cents),
  // fall back to the intent's stored dollar amount only if session lacks it.
  const amount =
    session.amount_total != null
      ? dollarsFromCents(session.amount_total)
      : Number(intentDoc?.amount) || 0

  const currency = (session.currency || intentDoc?.currency || 'usd').toLowerCase()
  const isSubscription = session.mode === 'subscription'
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id || null

  const update = {
    $setOnInsert: {
      id: uuidv4(),
      createdAt: new Date(),
      provider: 'stripe',
    },
    $set: {
      email,
      name,
      amount,
      currency,
      tier: session.metadata?.tier || intentDoc?.tier || '',
      message: session.metadata?.message || intentDoc?.message || '',
      recurring: isSubscription,
      userId: session.metadata?.userId || intentDoc?.userId || null,
      donationIntentId: intentDoc?.id || session.metadata?.donation_intent_id || session.client_reference_id || null,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      stripeSubscriptionId: session.subscription || null,
      stripeCustomerId: customerId,
      status: 'succeeded',
      livemode: !!livemode,
      updatedAt: new Date(),
    },
  }

  await db.collection('donations').updateOne(
    { stripeCheckoutSessionId: session.id },
    update,
    { upsert: true }
  )
}

export async function POST(request) {
  let bodyText = ''
  try {
    const buf = Buffer.from(await request.arrayBuffer())
    bodyText = buf.toString('utf8')
    const sig = request.headers.get('stripe-signature')
    if (!sig) return new NextResponse('Missing Stripe-Signature header', { status: 400 })

    const db = await getDb()
    const settings = await getPaymentSettings(db)
    const cfg = buildStripeConfig(settings)
    if (!cfg.stripe || !cfg.webhookSecret) {
      return new NextResponse('Stripe not configured', { status: 503 })
    }

    let event
    try {
      event = cfg.stripe.webhooks.constructEvent(buf, sig, cfg.webhookSecret)
    } catch (err) {
      console.error('[stripe-webhook] signature verification failed:', err.message)
      // Log the failed verification so it's visible in Payment Health
      try {
        await db.collection('stripe_webhook_events').insertOne({
          id: uuidv4(),
          eventId: null,
          type: 'signature_verification_failed',
          receivedAt: new Date(),
          processedAt: new Date(),
          status: 'failed',
          processingError: err?.message || 'signature verification failed',
        })
      } catch (_) { /* noop */ }
      return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
    }

    const webhookEvents = db.collection('stripe_webhook_events')
    const donationIntents = db.collection('donation_intents')
    const donations = db.collection('donations')

    // Idempotency: skip if already processed successfully.
    const existing = await webhookEvents.findOne({ eventId: event.id })
    if (existing && existing.processedAt && existing.status === 'processed') {
      return new NextResponse('Event already processed', { status: 200 })
    }

    let relatedIntentId = null
    let processingError = null
    let recordedDonationAmount = null

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object
          const intentIdStr =
            session.metadata?.donation_intent_id ||
            session.metadata?.intentId ||
            session.client_reference_id ||
            null
          relatedIntentId = intentIdStr

          // Look up the originating intent IF one exists. If not, we still
          // record the donation from the session data so Stripe Dashboard
          // test events, Payment Links, and out-of-band checkouts all show
          // up correctly in the DumpMaps Admin dashboard.
          const intentDoc = intentIdStr
            ? await donationIntents.findOne({ id: intentIdStr })
            : null

          await upsertDonationFromSession(db, {
            session,
            livemode: !!event.livemode,
            intentDoc,
          })

          // Mark the originating intent as converted (if one exists)
          if (intentDoc) {
            const paymentIntentId =
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id || null
            await donationIntents.updateOne(
              { id: intentDoc.id },
              {
                $set: {
                  status: 'succeeded',
                  convertedStatus: 'paid',
                  stripeCheckoutSessionId: session.id,
                  stripePaymentIntentId: paymentIntentId,
                  stripeSubscriptionId: session.subscription || null,
                  convertedAt: new Date(),
                  updatedAt: new Date(),
                },
              }
            )
          }

          // For the webhook event log
          recordedDonationAmount =
            session.amount_total != null ? dollarsFromCents(session.amount_total) : null
          break
        }

        case 'payment_intent.succeeded': {
          const pi = event.data.object
          const intentIdStr =
            pi.metadata?.donation_intent_id || pi.metadata?.intentId || null
          relatedIntentId = intentIdStr
          if (intentIdStr) {
            await donationIntents.updateOne(
              { id: intentIdStr, status: { $ne: 'succeeded' } },
              {
                $set: {
                  status: 'succeeded',
                  stripePaymentIntentId: pi.id,
                  updatedAt: new Date(),
                },
              }
            )
          }
          break
        }

        case 'payment_intent.payment_failed': {
          const pi = event.data.object
          const intentIdStr =
            pi.metadata?.donation_intent_id || pi.metadata?.intentId || null
          relatedIntentId = intentIdStr
          const failureReason = pi.last_payment_error?.message || 'Payment failed'
          if (intentIdStr) {
            await donationIntents.updateOne(
              { id: intentIdStr },
              {
                $set: {
                  status: 'failed',
                  failureReason,
                  stripePaymentIntentId: pi.id,
                  updatedAt: new Date(),
                },
              }
            )
          }
          break
        }

        case 'checkout.session.expired': {
          const session = event.data.object
          const intentIdStr =
            session.metadata?.donation_intent_id ||
            session.metadata?.intentId ||
            session.client_reference_id ||
            null
          relatedIntentId = intentIdStr
          if (intentIdStr) {
            await donationIntents.updateOne(
              { id: intentIdStr, status: 'pending' },
              { $set: { status: 'cancelled', updatedAt: new Date() } }
            )
          }
          // Mark any half-recorded donation as expired (best-effort)
          await donations.updateOne(
            { stripeCheckoutSessionId: session.id },
            { $set: { status: 'expired', updatedAt: new Date() } }
          )
          break
        }

        case 'invoice.payment_succeeded': {
          // Recurring renewal — record a fresh donation entry.
          const invoice = event.data.object
          const subId = invoice.subscription
          const linkedDonation = subId
            ? await donations.findOne({ stripeSubscriptionId: subId })
            : null
          const amount = dollarsFromCents(invoice.amount_paid)
          await donations.updateOne(
            { stripeInvoiceId: invoice.id },
            {
              $setOnInsert: {
                id: uuidv4(),
                createdAt: new Date(),
                provider: 'stripe',
              },
              $set: {
                email: normEmail(invoice.customer_email) || linkedDonation?.email || null,
                name: linkedDonation?.name || '',
                amount,
                currency: (invoice.currency || 'usd').toLowerCase(),
                tier: linkedDonation?.tier || '',
                recurring: true,
                stripeInvoiceId: invoice.id,
                stripeSubscriptionId: subId || null,
                stripeCustomerId: invoice.customer || null,
                stripePaymentIntentId: invoice.payment_intent || null,
                status: 'succeeded',
                livemode: !!event.livemode,
                updatedAt: new Date(),
              },
            },
            { upsert: true }
          )
          recordedDonationAmount = amount
          break
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object
          await donations.updateOne(
            { stripeInvoiceId: invoice.id },
            { $set: { status: 'failed', updatedAt: new Date() } }
          )
          break
        }

        default:
          // Unhandled event types are fine — log + ack so Stripe doesn't retry.
          break
      }
    } catch (err) {
      console.error('[stripe-webhook] processing error:', err)
      processingError = err?.message || 'unknown'
    }

    await webhookEvents.updateOne(
      { eventId: event.id },
      {
        $setOnInsert: { id: uuidv4(), receivedAt: new Date() },
        $set: {
          eventId: event.id,
          type: event.type,
          payloadSummary: {
            object: event.data?.object?.object || null,
            mode: event.data?.object?.mode || null,
            status: event.data?.object?.status || null,
            amount_total: event.data?.object?.amount_total ?? null,
            amount_paid: event.data?.object?.amount_paid ?? null,
            customer_email:
              event.data?.object?.customer_email ||
              event.data?.object?.customer_details?.email ||
              null,
          },
          relatedDonationIntentId: relatedIntentId,
          recordedDonationAmount,
          processedAt: new Date(),
          processingError,
          status: processingError ? 'failed' : 'processed',
          livemode: !!event.livemode,
        },
      },
      { upsert: true }
    )

    if (processingError) return new NextResponse('Handler error', { status: 500 })
    return new NextResponse('Webhook received', { status: 200 })
  } catch (err) {
    console.error('[stripe-webhook] fatal:', err)
    return new NextResponse('Webhook error', { status: 500 })
  }
}
