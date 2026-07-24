import Stripe from 'stripe'

/**
 * Centralized Stripe client + config resolver.
 * DB-stored keys (payment_settings) take precedence over env vars so admins
 * can rotate without redeploying. Mode is inferred from the secret key
 * prefix (sk_test_ vs sk_live_).
 */

const STRIPE_API_VERSION = '2024-12-18.acacia'

function inferMode(secretKey) {
  if (!secretKey) return null
  if (secretKey.startsWith('sk_test_')) return 'test'
  if (secretKey.startsWith('sk_live_')) return 'live'
  return null
}

function sanitizeStatementDescriptor(value) {
  const fallback = 'DUMPMAPS'
  if (!value) return fallback
  let d = String(value).trim().toUpperCase().replace(/[^A-Z0-9 .'-]/g, '')
  if (d.length < 5 || d.length > 22) return fallback
  return d
}

/**
 * Build a StripeConfig object from a fresh getPaymentSettings(db) result.
 * Pass the settings doc in directly so this module has no MongoDB coupling.
 */
export function buildStripeConfig(settings) {
  const secretKey = (settings?.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '').trim() || null
  const publishableKey = (settings?.stripePublishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim() || null
  const webhookSecret = (settings?.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '').trim() || null
  const mode = inferMode(secretKey) || settings?.mode || 'test'
  const currency = (settings?.currency || 'usd').toLowerCase()
  const statementDescriptor = sanitizeStatementDescriptor(settings?.statementDescriptor)
  const isConfigured = !!(secretKey && /^sk_(test|live)_/.test(secretKey))
  let stripe = null
  if (isConfigured) {
    try { stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION }) }
    catch (e) { /* leave stripe null on init failure */ }
  }
  return { stripe, secretKey, publishableKey, webhookSecret, mode, currency, statementDescriptor, isConfigured }
}
