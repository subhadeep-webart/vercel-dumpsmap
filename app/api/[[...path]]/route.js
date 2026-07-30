import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { promises as fs } from 'fs'
import nodePath from 'path'
import Stripe from 'stripe'
import { dispatchPr2b } from './handlers'
import { allowedStatusesForUser, isStatusAllowed, resolveMarketplaceRole } from '@/lib/marketplace-roles'
import { hasCommercialAccess as _hasCommercialAccess } from '@/lib/commercial-access'

// Persistent upload directory.
//
// CRITICAL: /data/uploads (used in the previous build) lives on the ephemeral
// overlay filesystem and gets wiped on every container restart / redeploy.
// /data/db IS persistent (it's where MongoDB stores its data). Storing
// uploads under /data/db/uploads guarantees the same persistence guarantee
// as the user database itself \u2014 if Mongo data survives a deploy, uploads will
// too. Served by /app/app/api/files/[name]/route.js with a graceful fallback
// to the legacy paths so already-existing files keep loading.
const PERSIST_UPLOAD_DIR = nodePath.join('/data', 'db', 'uploads')

// ---------- Stripe (lazy, graceful) ----------
// Stripe keys are pulled from env vars first, then from MongoDB `payment_settings`
// (set via Admin → Payments UI). If neither is available the donation flow falls
// back to the existing donation-intent queue so the platform never hard-fails.
let _stripeClient = null
let _stripeKeyUsed = null
async function getStripeConfig(db) {
  let secret = (process.env.STRIPE_SECRET_KEY || '').trim()
  let publishable = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim()
  let webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  if (!secret) {
    try {
      const s = await db.collection('payment_settings').findOne({ id: 'singleton' })
      if (s) {
        secret = (s.stripeSecretKey || '').trim()
        publishable = publishable || (s.stripePublishableKey || '').trim()
        webhookSecret = webhookSecret || (s.stripeWebhookSecret || '').trim()
      }
    } catch (e) {
      // ignore — graceful degradation
    }
  }
  const shapeOk = /^sk_(test|live)_/.test(secret)
  if (!secret || !shapeOk) {
    return { ready: false, secret: '', publishable, webhookSecret, client: null }
  }
  if (!_stripeClient || _stripeKeyUsed !== secret) {
    try {
      _stripeClient = new Stripe(secret)
      _stripeKeyUsed = secret
    } catch (e) {
      console.error('Stripe init failed:', e?.message)
      return { ready: false, secret: '', publishable, webhookSecret, client: null }
    }
  }
  return { ready: true, secret, publishable, webhookSecret, client: _stripeClient }
}

// Load curated seed data (multi-batch)
const _seedCache = {}
async function loadSeed(batchKey, fileName) {
  if (_seedCache[batchKey]) return _seedCache[batchKey]
  try {
    const p = nodePath.join(process.cwd(), 'lib', 'seed', fileName)
    const raw = await fs.readFile(p, 'utf-8')
    _seedCache[batchKey] = JSON.parse(raw)
    return _seedCache[batchKey]
  } catch (e) {
    console.error(`Failed to load seed ${batchKey}`, e?.message)
    return { facilities: [] }
  }
}
async function loadCalrecycleSeed() { return loadSeed('norcal', 'calrecycle-norcal.json') }
async function loadSocalSeed() { return loadSeed('socal', 'calrecycle-socal.json') }
async function loadPacificNorthwestSeed() { return loadSeed('pacific-northwest', 'pacific-northwest.json') }
async function loadNevadaSeed() { return loadSeed('nevada', 'nevada.json') }

// MongoDB connection.
//
// Cached on globalThis so the client SURVIVES Next.js dev hot-reloads. Without
// this, every edit re-evaluates the module, leaks the previous MongoClient, and
// eventually one of those orphaned clients closes its topology — after which any
// module still holding that reference throws `MongoTopologyClosedError:
// Topology is closed` on the next query (seen at login → requireStaff).
const globalForMongo = globalThis
let client = globalForMongo.__dmClient || null
let db = globalForMongo.__dmDb || null

// ensureSeed is a one-time bootstrap/migration (loads every facility into
// memory, runs user backfills, and imports four regional seed files with a
// findOne per record — ~15-17s). It must NOT run on the request path.
//
// Strategy:
//   • A `system_meta` marker records the seed version already applied.
//   • Common case (marker is current): connect does a single cheap findOne and
//     returns immediately — zero seed work, zero cold-start penalty.
//   • Brand-new DB (no facilities at all): we seed BLOCKING once, because the
//     very first read genuinely needs data to exist.
//   • Seeded-but-stale marker (a migration is pending): we run the seed in the
//     BACKGROUND and let requests through immediately; the marker is stamped
//     when it finishes.
//
// Bump SEED_VERSION whenever ensureSeed's logic changes so it re-runs once.
const SEED_VERSION = 1
let seedChecked = false      // this process already resolved the seed decision
let seedPromise = null       // in-flight background seed, if any

// True when the cached client's topology is closed/dead and can no longer serve
// queries. The driver exposes topology state privately, so we probe defensively
// and fall back to treating an errored/absent topology as "not connected".
function isClientAlive(c) {
  if (!c) return false
  try {
    const topology = c.topology
    if (!topology) return false                 // never connected
    if (typeof topology.isConnected === 'function') return topology.isConnected()
    // Newer drivers expose an `s.state` string; anything but 'closed' is usable.
    return topology.s?.state !== 'closed'
  } catch {
    return false
  }
}

async function connectToMongo() {
  // Reconnect if we have no client OR the cached client's topology has closed
  // (idle timeout, network blip, or a hot-reload-orphaned client). Reusing a
  // closed client is exactly what throws `Topology is closed`.
  if (!isClientAlive(client)) {
    // Best-effort close of any dead client so we don't leak sockets.
    if (client) { try { await client.close() } catch {} }
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
    globalForMongo.__dmClient = client
    globalForMongo.__dmDb = db
  }
  if (!db) {
    db = client.db(process.env.DB_NAME)
    globalForMongo.__dmDb = db
  }

  if (!seedChecked) {
    seedChecked = true
    try {
      const marker = await db.collection('system_meta').findOne({ id: 'seed' })
      if (marker?.version >= SEED_VERSION) {
        // Already seeded at the current version — nothing to do, ever.
      } else {
        const empty = (await db.collection('facilities').estimatedDocumentCount()) === 0
        if (empty) {
          // No data yet: the first read needs it, so seed before returning.
          await runSeedOnce(db)
        } else {
          // Data exists; a migration is pending. Run it in the background so we
          // don't block this (or any) request on the ~17s routine.
          runSeedOnce(db)
        }
      }
    } catch (e) {
      // Never let a seed-check failure take down the connection; a later
      // process can retry.
      seedChecked = false
      console.error('seed check failed', e)
    }
  }

  return db
}

// Runs ensureSeed at most once per process; stamps the version marker on
// success so future processes skip it. Errors reset the guard for a retry.
function runSeedOnce(database) {
  if (!seedPromise) {
    seedPromise = ensureSeed(database)
      .then(() =>
        database.collection('system_meta').updateOne(
          { id: 'seed' },
          { $set: { id: 'seed', version: SEED_VERSION, seededAt: new Date() } },
          { upsert: true }
        )
      )
      .catch((e) => {
        seedChecked = false
        console.error('seed run failed', e)
      })
      .finally(() => { seedPromise = null })
  }
  return seedPromise
}

// JWT_SECRET MUST come from the environment (set by Emergent deploy or /app/.env).
// The old hardcoded fallback `'dumpmaps-pilot-secret'` was a critical security
// risk — anyone who read the source could forge admin tokens. We now fail fast
// if the variable is missing so misconfigured deploys surface immediately.
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required — set it in /app/.env or your deployment environment.')
}

// ---------- Alert constants ----------
const ALERT_TYPES = {
  WAIT_TIME:      { label: 'Wait Time',       severity: 'warn', expiryHours: 2 },
  LONG_LINE:      { label: 'Long Line',       severity: 'warn', expiryHours: 6 },
  FAST_MOVING:    { label: 'Fast Moving',     severity: 'good', expiryHours: 6 },
  CLOSED:         { label: 'Facility Closed', severity: 'bad',  expiryHours: 24 },
  NOT_ACCEPTING:  { label: 'Not Accepting',   severity: 'warn', expiryHours: 12 },
  ACCEPTING_NOW:  { label: 'Accepting Now',   severity: 'good', expiryHours: 12 },
  YARD_FULL:      { label: 'Yard Full',       severity: 'bad',  expiryHours: 6 },
  SCALE_ISSUE:    { label: 'Scale Issue',     severity: 'bad',  expiryHours: 6 },
  PRICE_UPDATE:   { label: 'Price Update',    severity: 'info', expiryHours: 12 },
  DONATION_NEED:  { label: 'Donation Need',   severity: 'info', expiryHours: 12 },
  EVENT:          { label: 'Event',           severity: 'good', expiryHours: 24 },
  GENERAL_NOTE:   { label: 'General Note',    severity: 'info', expiryHours: 6 },
}

const SEVERITY_RANK = { bad: 3, warn: 2, info: 1, good: 0 }

async function attachActiveAlerts(db, facilities) {
  if (!facilities.length) return facilities
  const ids = facilities.map((f) => f.id)
  const now = new Date()
  // sweep: mark expired alerts whose expiresAt has passed
  await db.collection('alerts').updateMany(
    { facilityId: { $in: ids }, status: 'active', expiresAt: { $lte: now } },
    { $set: { status: 'expired' } }
  )
  const alerts = await db
    .collection('alerts')
    .find({ facilityId: { $in: ids }, status: 'active', expiresAt: { $gt: now } })
    .toArray()
  const byFac = {}
  for (const a of alerts) {
    if (!byFac[a.facilityId]) byFac[a.facilityId] = []
    byFac[a.facilityId].push(clean(a))
  }
  return facilities.map((f) => {
    const list = (byFac[f.id] || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const topSeverity = list.reduce((m, a) => {
      const r = SEVERITY_RANK[a.severity || 'info'] || 0
      return r > m.r ? { r, sev: a.severity } : m
    }, { r: -1, sev: null })
    return {
      ...f,
      activeAlerts: list.slice(0, 5),
      activeAlertCount: list.length,
      topAlertSeverity: topSeverity.sev,
      lastAlertAt: list[0]?.createdAt || null,
    }
  })
}

// ---------- Seed data (Bay Area pilot) ----------
const SEED_FACILITIES = [
  {
    name: 'Mission Trail Waste Systems',
    type: 'Transfer Station',
    address: '1080 Walsh Ave, Santa Clara, CA 95050',
    lat: 37.3791, lng: -121.9758,
    phone: '(408) 727-5060',
    website: 'https://missiontrail.com',
    hours: 'Mon-Fri 6am-5pm, Sat 7am-3pm',
    accepted: ['Construction debris', 'Wood', 'Concrete', 'Dirt', 'Green waste', 'Furniture', 'Mattresses', 'Appliances'],
    restricted: ['Hazardous waste', 'E-waste'],
    pricing: 'Paid disposal. Approx $65-$110/ton.',
    flags: { freeDropOff: false, paidDisposal: true, donation: false, contractorFriendly: true },
    images: ['https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=600'],
    verified: true,
    rating: 4.2,
    reviewsCount: 47,
  },
  {
    name: 'Zanker Recycling',
    type: 'Construction Debris Facility',
    address: '675 Los Esteros Rd, San Jose, CA 95134',
    lat: 37.4391, lng: -121.9410,
    phone: '(408) 263-2384',
    website: 'https://zankerrecycling.com',
    hours: 'Mon-Fri 6am-5pm, Sat 7am-3pm',
    accepted: ['Construction debris', 'Concrete', 'Dirt', 'Wood', 'Metal', 'Pallets', 'Cardboard'],
    restricted: ['Hazardous waste', 'Mattresses'],
    pricing: '$58/ton mixed C&D, $32/ton clean concrete, $48/ton wood.',
    flags: { freeDropOff: false, paidDisposal: true, donation: false, contractorFriendly: true },
    images: ['https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=600'],
    verified: true,
    rating: 4.5,
    reviewsCount: 132,
  },
  {
    name: 'GreenWaste of San Jose',
    type: 'Recycling Center',
    address: '625 Charles St, San Jose, CA 95112',
    lat: 37.3508, lng: -121.9079,
    phone: '(408) 938-4900',
    website: 'https://greenwaste.com',
    hours: 'Mon-Sat 7am-4pm',
    accepted: ['Cardboard', 'Plastic', 'Metal', 'Aluminum', 'Wood', 'Green waste', 'E-waste'],
    restricted: ['Construction debris', 'Hazardous waste'],
    pricing: 'Residential free. Commercial rates vary.',
    flags: { freeDropOff: true, paidDisposal: false, donation: false, contractorFriendly: true },
    images: ['https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600'],
    verified: true,
    rating: 4.3,
    reviewsCount: 89,
  },
  {
    name: 'Second Harvest Donation Drop-Off',
    type: 'Donation Center',
    address: '4001 N 1st St, San Jose, CA 95134',
    lat: 37.4099, lng: -121.9462,
    phone: '(408) 266-8866',
    website: 'https://www.shfb.org',
    hours: 'Mon-Fri 8am-5pm, Sat 9am-1pm',
    accepted: ['Household goods', 'Clothing', 'Furniture'],
    restricted: ['Construction debris', 'Mattresses', 'E-waste'],
    pricing: 'Free drop-off. Tax receipt available.',
    flags: { freeDropOff: true, paidDisposal: false, donation: true, contractorFriendly: false },
    images: ['https://images.unsplash.com/photo-1567113463300-102a7eb3cb26?w=600'],
    verified: true,
    rating: 4.8,
    reviewsCount: 203,
  },
  {
    name: 'Sims Metal Management - San Jose',
    type: 'Scrap Yard',
    address: '1602 Old Bayshore Hwy, San Jose, CA 95112',
    lat: 37.3673, lng: -121.9032,
    phone: '(408) 437-1414',
    website: 'https://www.simsmm.com',
    hours: 'Mon-Fri 7am-4:30pm, Sat 7am-12pm',
    accepted: ['Metal', 'Aluminum', 'Copper', 'Appliances'],
    restricted: ['E-waste', 'Furniture', 'Clothing'],
    pricing: 'Pays for metals. Copper ~$3.40/lb, Aluminum ~$0.65/lb.',
    flags: { freeDropOff: false, paidDisposal: false, donation: false, contractorFriendly: true },
    images: ['https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=600'],
    verified: true,
    rating: 4.1,
    reviewsCount: 76,
  },
  {
    name: 'Goodwill Donation Center - San Jose',
    type: 'Donation Center',
    address: '1080 N 7th St, San Jose, CA 95112',
    lat: 37.3540, lng: -121.8967,
    phone: '(408) 869-9777',
    website: 'https://goodwillsv.org',
    hours: 'Daily 9am-7pm',
    accepted: ['Furniture', 'Clothing', 'Household goods', 'Appliances', 'Fixtures', 'E-waste'],
    restricted: ['Construction debris', 'Mattresses'],
    pricing: 'Free drop-off. Tax receipt available.',
    flags: { freeDropOff: true, paidDisposal: false, donation: true, contractorFriendly: false },
    images: ['https://images.unsplash.com/photo-1607082352121-fa243f3dde32?w=600'],
    verified: true,
    rating: 4.6,
    reviewsCount: 311,
  },
  {
    name: 'Recology South Bay',
    type: 'Recycling Center',
    address: '1601 Dixon Landing Rd, Milpitas, CA 95035',
    lat: 37.4596, lng: -121.9123,
    phone: '(408) 432-1234',
    website: 'https://www.recology.com/recology-south-bay',
    hours: 'Mon-Sat 6am-5pm',
    accepted: ['Cardboard', 'Plastic', 'Metal', 'Aluminum', 'Green waste', 'Wood', 'E-waste', 'Mattresses'],
    restricted: ['Hazardous waste'],
    pricing: 'Residential free. Commercial $95/ton mixed.',
    flags: { freeDropOff: true, paidDisposal: true, donation: false, contractorFriendly: true },
    images: ['https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600'],
    verified: true,
    rating: 4.4,
    reviewsCount: 154,
  },
  {
    name: 'Guadalupe Recycling & Disposal',
    type: 'Landfill',
    address: '15999 Guadalupe Mines Rd, San Jose, CA 95120',
    lat: 37.2056, lng: -121.8967,
    phone: '(408) 268-8536',
    website: 'https://www.sanjoseca.gov',
    hours: 'Mon-Sat 6am-4:30pm',
    accepted: ['Construction debris', 'Dirt', 'Concrete', 'Mattresses', 'Wood', 'Green waste', 'Appliances'],
    restricted: ['Hazardous waste', 'E-waste'],
    pricing: 'Paid disposal. Approx $62/ton.',
    flags: { freeDropOff: false, paidDisposal: true, donation: false, contractorFriendly: true },
    images: ['https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=600'],
    verified: true,
    rating: 3.9,
    reviewsCount: 68,
  },
]

async function ensureSeed(database) {
  try {
    const count = await database.collection('facilities').countDocuments()
    if (count === 0) {
      const docs = SEED_FACILITIES.map((f) => ({
        id: uuidv4(),
        ...f,
        pricing: f.pricing || defaultPricing(f),
        status: 'approved',
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
      await database.collection('facilities').insertMany(docs)
    } else {
      // Backfill pricing for facilities with old-format (string) or missing pricing
      const all = await database.collection('facilities').find({}).toArray()
      for (const f of all) {
        if (!f.pricing || typeof f.pricing === 'string') {
          await database.collection('facilities').updateOne(
            { id: f.id },
            { $set: { pricing: pricingFor(f.name) || defaultPricing(f), legacyPricingNote: typeof f.pricing === 'string' ? f.pricing : '' } }
          )
        }
      }
    }
    // ===== Role system: ensure jamal (super_admin) + aj (admin) =====
    const SEED_ADMINS = [
      { email: 'jamal@dumpmaps.org', password: '@@Jefferson2180', name: 'Jamal · DumpMaps Owner', role: 'super_admin' },
      { email: 'aj@bisonjunk.com',   password: 'admin123',        name: 'AJ · Bison Junk',          role: 'admin' },
    ]
    for (const a of SEED_ADMINS) {
      const existing = await database.collection('users').findOne({ email: a.email })
      if (!existing) {
        const hash = await bcrypt.hash(a.password, 10)
        await database.collection('users').insertOne({
          id: uuidv4(),
          email: a.email,
          passwordHash: hash,
          name: a.name,
          role: a.role,
          accountStatus: 'active',
          verificationLevel: 'verified_user',
          profileTypes: ['general'],
          primaryProfile: 'general',
          karma: 0,
          ownedFacilities: [],
          reportsAgainst: 0,
          createdAt: new Date(),
        })
      } else if (!['super_admin', 'admin'].includes(existing.role) || existing.role !== a.role) {
        await database.collection('users').updateOne(
          { id: existing.id },
          { $set: { role: a.role, accountStatus: existing.accountStatus || 'active', verificationLevel: existing.verificationLevel || 'verified_user' } }
        )
      }
    }
    // Legacy admin@dumpmaps.com: demote (not delete) so old tokens still resolve as a normal user
    const legacy = await database.collection('users').findOne({ email: 'admin@dumpmaps.com' })
    if (legacy && legacy.role === 'admin') {
      await database.collection('users').updateOne(
        { id: legacy.id },
        { $set: { role: 'normal_user', accountStatus: legacy.accountStatus || 'active' } }
      )
    }
    // Backfill: every user gets accountStatus + verificationLevel + reportsAgainst
    await database.collection('users').updateMany(
      { accountStatus: { $exists: false } },
      { $set: { accountStatus: 'active' } }
    )
    await database.collection('users').updateMany(
      { verificationLevel: { $exists: false } },
      { $set: { verificationLevel: 'normal_user' } }
    )
    await database.collection('users').updateMany(
      { reportsAgainst: { $exists: false } },
      { $set: { reportsAgainst: 0 } }
    )
    // Normalize legacy role 'user' → 'normal_user'
    await database.collection('users').updateMany(
      { role: 'user' },
      { $set: { role: 'normal_user' } }
    )
  } catch (e) {
    console.error('seed error', e)
  }
  // === CalRecycle NorCal pending imports — idempotent ===
  await seedPendingImportsBatch(database, await loadCalrecycleSeed(), 'calrecycle-norcal-v1').catch((e) => console.error('calrecycle norcal seed error', e))
  // === SoCal pending imports — idempotent ===
  await seedPendingImportsBatch(database, await loadSocalSeed(), 'calrecycle-socal-v1').catch((e) => console.error('socal seed error', e))
  // === Pacific Northwest (OR + WA) pending imports — idempotent ===
  await seedPendingImportsBatch(database, await loadPacificNorthwestSeed(), 'pacific-northwest-v1').catch((e) => console.error('pacnw seed error', e))
  // === Nevada (Las Vegas / Reno / Carson City) pending imports — idempotent ===
  await seedPendingImportsBatch(database, await loadNevadaSeed(), 'nevada-v1').catch((e) => console.error('nevada seed error', e))
}

async function seedCalrecyclePendingImports(database) {
  // legacy alias preserved for /api/admin/facility-imports/seed endpoint
  await seedPendingImportsBatch(database, await loadCalrecycleSeed(), 'calrecycle-norcal-v1')
  await seedPendingImportsBatch(database, await loadSocalSeed(), 'calrecycle-socal-v1')
  await seedPendingImportsBatch(database, await loadPacificNorthwestSeed(), 'pacific-northwest-v1')
  await seedPendingImportsBatch(database, await loadNevadaSeed(), 'nevada-v1')
}

async function seedPendingImportsBatch(database, seed, importBatch) {
  if (!seed?.facilities?.length) return
  // Ensure a unique index on sourceRecordKey so concurrent runs don't dup
  try {
    await database.collection('facility_imports').createIndex(
      { sourceRecordKey: 1 },
      { unique: true, partialFilterExpression: { sourceRecordKey: { $exists: true } } }
    )
  } catch {}
  for (const f of seed.facilities) {
    const sourceRecordKey = `seed:${importBatch}:${(f.name || '').toLowerCase().replace(/\s+/g, '-')}:${(f.address || '').toLowerCase().replace(/\s+/g, '-')}`
    // also skip if a facility with this exact name+address already exists in facilities (don't re-queue what's already approved)
    const existingFacility = await database.collection('facilities').findOne({ name: f.name, address: f.address })
    if (existingFacility) { continue }
    const normalized = {
      name: f.name,
      typeKey: f.typeKey || 'transfer_station',
      address: f.address,
      city: f.city || '',
      county: f.county || '',
      state: f.state || 'CA',
      zip: f.zip || '',
      lat: f.lat || null,
      lng: f.lng || null,
      phone: f.phone || '',
      website: f.website || '',
      hours: f.hours || '',
      accepted: Array.isArray(f.accepted) ? f.accepted : [],
      notAccepted: Array.isArray(f.notAccepted) ? f.notAccepted : [],
      pricingNotes: f.pricing || '',
      paymentMethods: Array.isArray(f.paymentMethods) ? f.paymentMethods : [],
      scaleRequired: !!f.scaleRequired,
      contractorFriendly: !!f.contractorFriendly,
      sourceUrl: f.sourceUrl || '',
      sourceType: f.sourceType || 'calrecycle',
      notes: f.notes || (f.operator ? `Operator: ${f.operator}` : ''),
      operator: f.operator || '',
    }
    // Compute confidence inline (mirrors computeConfidence helper)
    let s = 30
    if (normalized.sourceUrl) s += 15
    if (normalized.sourceType === 'calrecycle' || normalized.sourceType === 'gov_official') s += 20
    else if (normalized.sourceType === 'official_website') s += 12
    else if (normalized.sourceType === 'csv_curated') s += 10
    if (normalized.lat && normalized.lng) s += 8
    if (normalized.phone) s += 5
    if (normalized.website) s += 5
    if (normalized.accepted.length > 0) s += 5
    if (normalized.hours) s += 5
    s += 7 // lastVerifiedAt always set
    const confidenceScore = Math.min(100, s)
    try {
      await database.collection('facility_imports').insertOne({
        id: uuidv4(),
        sourceRecordKey,
        sourceType: normalized.sourceType,
        sourceUrl: normalized.sourceUrl,
        rawData: f,
        normalizedData: normalized,
        confidenceScore,
        status: 'pending',
        duplicateMatches: [],
        duplicateOfId: null,
        lastVerifiedAt: new Date(seed.generatedAt || Date.now()),
        importedBy: 'system_seed',
        importBatch,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } catch (e) {
      // duplicate key → already seeded, safe to skip
      if (e?.code === 11000) { /* ignore */ } else { console.error(`[seed ${importBatch}] insert error:`, e?.message) }
    }
  }
}

function defaultPricing(f) {
  const isFree = f.flags?.freeDropOff
  const isDonation = f.type === 'Donation Center' || f.type === 'Reuse Center'
  return {
    pricingType: isDonation ? 'donation_only' : isFree ? 'free' : 'per_ton',
    pricePerTon: isDonation || isFree ? null : 65,
    minimumCharge: isDonation || isFree ? null : 25,
    materialPricing: [],
    surgeFeeNotes: '',
    sortingFeeNotes: '',
    scaleInRequired: !isDonation && !isFree,
    scaleOutRequired: !isDonation && !isFree,
    paymentMethods: { cash: true, card: true, accountBilling: false, online: false },
    lastUpdated: new Date().toISOString(),
    verifiedBy: 'admin',
  }
}

function pricingFor(name) {
  const map = {
    'Mission Trail Waste Systems': {
      pricingType: 'per_ton', pricePerTon: 78, minimumCharge: 35,
      materialPricing: [
        { material: 'Mixed debris', price: 95, unit: 'ton' },
        { material: 'Wood', price: 78, unit: 'ton' },
        { material: 'Green waste', price: 55, unit: 'ton' },
        { material: 'Concrete', price: 42, unit: 'ton' },
        { material: 'Dirt', price: 38, unit: 'ton' },
        { material: 'Mattresses', price: 45, unit: 'each' },
        { material: 'Appliances', price: 25, unit: 'each' },
      ],
      surgeFeeNotes: 'Surcharge on weekends $10/ton',
      sortingFeeNotes: '+$15/ton if loads not separated',
      scaleInRequired: true, scaleOutRequired: true,
      paymentMethods: { cash: true, card: true, accountBilling: true, online: false },
      lastUpdated: new Date().toISOString(), verifiedBy: 'admin',
    },
    'Zanker Recycling': {
      pricingType: 'per_ton', pricePerTon: 58, minimumCharge: 25,
      materialPricing: [
        { material: 'Mixed C&D', price: 58, unit: 'ton' },
        { material: 'Concrete (clean)', price: 32, unit: 'ton' },
        { material: 'Wood', price: 48, unit: 'ton' },
        { material: 'Metal', price: 0, unit: 'ton' },
        { material: 'Cardboard', price: 0, unit: 'ton' },
        { material: 'Pallets', price: 5, unit: 'each' },
      ],
      surgeFeeNotes: '', sortingFeeNotes: 'Pre-sorted loads get 15% discount',
      scaleInRequired: true, scaleOutRequired: true,
      paymentMethods: { cash: true, card: true, accountBilling: true, online: false },
      lastUpdated: new Date().toISOString(), verifiedBy: 'facility',
    },
    'GreenWaste of San Jose': {
      pricingType: 'per_ton', pricePerTon: 0, minimumCharge: 0,
      materialPricing: [
        { material: 'Cardboard', price: 0, unit: 'ton' },
        { material: 'Plastic', price: 0, unit: 'ton' },
        { material: 'Metal', price: 0, unit: 'ton' },
        { material: 'Green waste', price: 0, unit: 'ton' },
        { material: 'E-waste', price: 0, unit: 'item' },
      ],
      surgeFeeNotes: '', sortingFeeNotes: '',
      scaleInRequired: false, scaleOutRequired: false,
      paymentMethods: { cash: false, card: false, accountBilling: false, online: false },
      lastUpdated: new Date().toISOString(), verifiedBy: 'admin',
    },
    'Second Harvest Donation Drop-Off': {
      pricingType: 'donation_only', pricePerTon: null, minimumCharge: null,
      materialPricing: [],
      surgeFeeNotes: '', sortingFeeNotes: 'Sorted donations preferred',
      scaleInRequired: false, scaleOutRequired: false,
      paymentMethods: { cash: false, card: false, accountBilling: false, online: false },
      lastUpdated: new Date().toISOString(), verifiedBy: 'facility',
    },
    'Sims Metal Management - San Jose': {
      pricingType: 'per_item', pricePerTon: null, minimumCharge: 0,
      materialPricing: [
        { material: 'Copper #1', price: 3.40, unit: 'lb' },
        { material: 'Copper #2', price: 3.10, unit: 'lb' },
        { material: 'Aluminum cans', price: 0.65, unit: 'lb' },
        { material: 'Aluminum sheet', price: 0.50, unit: 'lb' },
        { material: 'Iron/steel', price: 0.12, unit: 'lb' },
        { material: 'Brass', price: 2.20, unit: 'lb' },
      ],
      surgeFeeNotes: 'Prices change daily — check before driving',
      sortingFeeNotes: '',
      scaleInRequired: true, scaleOutRequired: true,
      paymentMethods: { cash: true, card: false, accountBilling: false, online: false },
      lastUpdated: new Date().toISOString(), verifiedBy: 'facility',
    },
    'Goodwill Donation Center - San Jose': {
      pricingType: 'free', pricePerTon: 0, minimumCharge: 0,
      materialPricing: [],
      surgeFeeNotes: '', sortingFeeNotes: '',
      scaleInRequired: false, scaleOutRequired: false,
      paymentMethods: { cash: false, card: false, accountBilling: false, online: false },
      lastUpdated: new Date().toISOString(), verifiedBy: 'facility',
    },
    'Recology South Bay': {
      pricingType: 'per_ton', pricePerTon: 95, minimumCharge: 50,
      materialPricing: [
        { material: 'Mixed debris', price: 95, unit: 'ton' },
        { material: 'Wood', price: 85, unit: 'ton' },
        { material: 'Green waste', price: 65, unit: 'ton' },
        { material: 'Mattresses', price: 50, unit: 'each' },
        { material: 'Appliances', price: 35, unit: 'each' },
      ],
      surgeFeeNotes: '', sortingFeeNotes: 'Mixed loads pay top rate',
      scaleInRequired: true, scaleOutRequired: true,
      paymentMethods: { cash: true, card: true, accountBilling: true, online: false },
      lastUpdated: new Date().toISOString(), verifiedBy: 'admin',
    },
    'Guadalupe Recycling & Disposal': {
      pricingType: 'per_ton', pricePerTon: 62, minimumCharge: 30,
      materialPricing: [
        { material: 'Mixed debris', price: 62, unit: 'ton' },
        { material: 'Concrete', price: 38, unit: 'ton' },
        { material: 'Dirt', price: 35, unit: 'ton' },
        { material: 'Green waste', price: 55, unit: 'ton' },
        { material: 'Mattresses', price: 40, unit: 'each' },
      ],
      surgeFeeNotes: '', sortingFeeNotes: '',
      scaleInRequired: true, scaleOutRequired: true,
      paymentMethods: { cash: true, card: true, accountBilling: false, online: false },
      lastUpdated: new Date().toISOString(), verifiedBy: 'admin',
    },
  }
  return map[name] || null
}

// ---------- helpers ----------
function clean(doc) {
  if (!doc) return doc
  const { _id, passwordHash, ...rest } = doc
  return rest
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getAuth(request) {
  try {
    const h = request.headers.get('authorization') || ''
    const token = h.startsWith('Bearer ') ? h.slice(7) : null
    if (!token) return null
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

// ---------- Role / Staff helpers ----------
const STAFF_ROLES = ['super_admin', 'admin', 'moderator']
// Legacy 'admin' tokens (issued before role expansion) still work as 'admin'
function isStaff(role) { return STAFF_ROLES.includes(role) }
function isSuperAdmin(role) { return role === 'super_admin' }

async function requireStaff(request, db, minLevel = 'moderator') {
  const auth = getAuth(request)
  if (!auth) return { error: 'Unauthorized', status: 401 }
  // resolve fresh user (role may have changed after token issue)
  const user = await db.collection('users').findOne({ id: auth.id })
  if (!user) return { error: 'Unauthorized', status: 401 }
  if (user.accountStatus === 'banned' || user.accountStatus === 'suspended') {
    return { error: `Account ${user.accountStatus}`, status: 403 }
  }
  const role = user.role
  const order = { moderator: 1, admin: 2, super_admin: 3 }
  const need = order[minLevel] || 1
  const have = order[role] || 0
  if (have < need) return { error: 'Forbidden', status: 403 }
  return { user, auth }
}

async function logActivity(db, actorUser, action, target = {}, payload = {}) {
  try {
    await db.collection('activity_logs').insertOne({
      id: uuidv4(),
      actorId: actorUser?.id || null,
      actorEmail: actorUser?.email || null,
      actorRole: actorUser?.role || null,
      action,                                 // e.g. 'facility.approve', 'user.ban'
      targetKind: target.kind || null,        // 'facility' | 'user' | 'marketplace' | ...
      targetId: target.id || null,
      targetLabel: target.label || null,
      payload,                                // arbitrary detail
      createdAt: new Date(),
    })
  } catch (e) {
    console.error('activity_log error', e)
  }
}

// ---------- PLATFORM SETTINGS / INTEGRATIONS / EMAIL — singletons ----------
const DEFAULT_PLATFORM_SETTINGS = {
  id: 'singleton',
  maintenanceMode: false,
  maintenanceMessage: '',
  modules: {
    marketplaceEnabled: true,
    jobsEnabled: true,
    chatEnabled: true,
    paymentsEnabled: false,        // off until Stripe wired
    facilitySubmissionsEnabled: true,
    mapEnabled: true,
    communityEnabled: true,
  },
  facilityOwnerFeatures: {
    claimListing: true,
    updatePricing: true,
    postClosures: true,
    manageMessages: true,
    paymentPilot: false,
    uploadDocs: true,
  },
  // "How it works" video shown in the Business page banner. CMS-managed.
  businessVideo: {
    enabled: false,
    videoUrl: '',        // uploaded /api/files/... mp4 OR external (YouTube/Vimeo/mp4) URL
    posterUrl: '',       // optional thumbnail shown before play
    title: 'See how it works',
    subtitle: '',
  },
  updatedAt: new Date(),
}
async function getPlatformSettings(db) {
  const existing = await db.collection('platform_settings').findOne({ id: 'singleton' })
  if (existing) {
    // merge defaults so newly added keys are present
    return clean({
      ...DEFAULT_PLATFORM_SETTINGS,
      ...existing,
      modules: { ...DEFAULT_PLATFORM_SETTINGS.modules, ...(existing.modules || {}) },
      facilityOwnerFeatures: { ...DEFAULT_PLATFORM_SETTINGS.facilityOwnerFeatures, ...(existing.facilityOwnerFeatures || {}) },
      businessVideo: { ...DEFAULT_PLATFORM_SETTINGS.businessVideo, ...(existing.businessVideo || {}) },
    })
  }
  await db.collection('platform_settings').insertOne({ ...DEFAULT_PLATFORM_SETTINGS })
  return { ...DEFAULT_PLATFORM_SETTINGS }
}

const DEFAULT_INTEGRATIONS = [
  { key: 'stripe',        name: 'Stripe',         category: 'Payments',     status: 'coming_soon', envVars: ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'], notes: 'Test-mode infrastructure ready. Awaiting test keys.' },
  { key: 'google_maps',   name: 'Google Maps',    category: 'Maps',         status: 'not_connected', envVars: ['GOOGLE_MAPS_API_KEY'], notes: 'Required for live geocoding + Places ingestion.' },
  { key: 'cloudinary',    name: 'Cloudinary',     category: 'Storage',      status: 'not_connected', envVars: ['CLOUDINARY_URL'], notes: 'Replace local /public/uploads with CDN.' },
  { key: 'aws_s3',        name: 'AWS S3',         category: 'Storage',      status: 'not_connected', envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET'], notes: 'Alt cloud storage.' },
  { key: 'sendgrid',      name: 'SendGrid',       category: 'Email',        status: 'not_connected', envVars: ['SENDGRID_API_KEY'], notes: 'Transactional email provider.' },
  { key: 'resend',        name: 'Resend',         category: 'Email',        status: 'not_connected', envVars: ['RESEND_API_KEY'], notes: 'Alt transactional email provider.' },
  { key: 'twilio',        name: 'Twilio SMS',     category: 'SMS',          status: 'not_connected', envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'], notes: 'SMS notifications.' },
  { key: 'scale_software',name: 'Facility Scale Software', category: 'Operations', status: 'not_connected', envVars: [], notes: 'Future tie-in for live wait/scale-in data.' },
  { key: 'zapier',        name: 'Zapier',         category: 'Automation',   status: 'not_connected', envVars: ['ZAPIER_WEBHOOK_URL'], notes: 'Triggers on key platform events.' },
  { key: 'webhooks',      name: 'Generic Webhooks', category: 'Automation', status: 'not_connected', envVars: [], notes: 'Outbound webhook subscriptions per event type.' },
]
async function getIntegrations(db) {
  const existing = await db.collection('integrations').find({}).toArray()
  const byKey = Object.fromEntries(existing.map((x) => [x.key, x]))
  const merged = DEFAULT_INTEGRATIONS.map((def) => {
    const ex = byKey[def.key] || {}
    return { ...def, ...ex, key: def.key, envVars: def.envVars }
  })
  // detect env-presence for live status badge
  return merged.map((m) => {
    const envSet = m.envVars.length > 0 && m.envVars.every((v) => !!process.env[v])
    const liveStatus = envSet ? 'connected' : (m.status || 'not_connected')
    return { ...clean(m), envPresent: envSet, status: liveStatus }
  })
}

const DEFAULT_EMAIL_SETTINGS = {
  id: 'singleton',
  provider: 'none',     // none | sendgrid | resend
  from: 'no-reply@dumpmaps.org',
  triggers: {
    newFacility:      { enabled: true,  recipients: 'admin', custom: '' },
    newListing:       { enabled: false, recipients: 'admin', custom: '' },
    newJob:           { enabled: false, recipients: 'admin', custom: '' },
    reportedContent:  { enabled: true,  recipients: 'admin', custom: '' },
    paymentEvent:     { enabled: false, recipients: 'admin', custom: '' },
    claimRequest:     { enabled: true,  recipients: 'admin', custom: '' },
  },
}
async function getEmailSettings(db) {
  const existing = await db.collection('email_settings').findOne({ id: 'singleton' })
  if (existing) {
    return clean({
      ...DEFAULT_EMAIL_SETTINGS,
      ...existing,
      triggers: { ...DEFAULT_EMAIL_SETTINGS.triggers, ...(existing.triggers || {}) },
    })
  }
  await db.collection('email_settings').insertOne({ ...DEFAULT_EMAIL_SETTINGS })
  return { ...DEFAULT_EMAIL_SETTINGS }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

async function handleRoute(request, context) {
  // Next 15: route context `params` is now a Promise and must be awaited.
  const { path = [] } = await context.params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()
    const url = new URL(request.url)

    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({ message: 'DumpMaps API ok' }))
    }

    // ---------- AUTH ----------
    if (route === '/auth/signup' && method === 'POST') {
      const body = await request.json()
      if (!body.email || !body.password) {
        return handleCORS(NextResponse.json({ error: 'email and password required' }, { status: 400 }))
      }
      const existing = await db.collection('users').findOne({ email: body.email.toLowerCase() })
      if (existing) return handleCORS(NextResponse.json({ error: 'Email already in use' }, { status: 400 }))
      const hash = await bcrypt.hash(body.password, 10)
      const profileTypes = Array.isArray(body.profileTypes) && body.profileTypes.length
        ? body.profileTypes
        : (body.userRole ? [body.userRole] : ['general'])
      const user = {
        id: uuidv4(),
        email: body.email.toLowerCase(),
        passwordHash: hash,
        name: body.name || body.email.split('@')[0],
        role: 'user',
        profileTypes,
        primaryProfile: body.primaryProfile || profileTypes[0],
        userRole: body.userRole || profileTypes[0], // legacy
        bio: '',
        karma: 0,
        ownedFacilities: [],
        createdAt: new Date(),
      }
      await db.collection('users').insertOne(user)
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' })
      return handleCORS(NextResponse.json({ token, user: clean(user) }))
    }

    if (route === '/auth/login' && method === 'POST') {
      const body = await request.json()
      const user = await db.collection('users').findOne({ email: (body.email || '').toLowerCase() })
      if (!user) return handleCORS(NextResponse.json({ error: 'Invalid credentials' }, { status: 401 }))
      const ok = await bcrypt.compare(body.password || '', user.passwordHash)
      if (!ok) return handleCORS(NextResponse.json({ error: 'Invalid credentials' }, { status: 401 }))
      if (user.accountStatus === 'banned') {
        return handleCORS(NextResponse.json({ error: 'Account banned' + (user.banReason ? ` — ${user.banReason}` : '') }, { status: 403 }))
      }
      if (user.accountStatus === 'suspended') {
        const until = user.suspendedUntil ? ` until ${new Date(user.suspendedUntil).toLocaleDateString()}` : ''
        return handleCORS(NextResponse.json({ error: 'Account suspended' + until }, { status: 403 }))
      }
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' })
      // Stamp lastLoginAt so admins can see when each user last signed in. Fire-and-forget.
      db.collection('users').updateOne({ id: user.id }, { $set: { lastLoginAt: new Date() } }).catch(() => {})
      return handleCORS(NextResponse.json({ token, user: clean(user) }))
    }

    if (route === '/auth/me' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ user: null }))
      const user = await db.collection('users').findOne({ id: auth.id })
      return handleCORS(NextResponse.json({ user: clean(user) }))
    }

    // ---------- FACILITIES ----------
    if (route === '/facilities' && method === 'GET') {
      const status = url.searchParams.get('status') || 'approved'
      const lat = parseFloat(url.searchParams.get('lat'))
      const lng = parseFloat(url.searchParams.get('lng'))
      const maxKm = parseFloat(url.searchParams.get('maxKm')) || null
      const types = (url.searchParams.get('types') || '').split(',').filter(Boolean)
      const materials = (url.searchParams.get('materials') || '').split(',').filter(Boolean)
      const verified = url.searchParams.get('verified') === 'true'
      const q = (url.searchParams.get('q') || '').toLowerCase().trim()

      // Keyword → category shortcuts (so users searching "CRV" / "scrap yard" / "e-waste" / "donation" find the right buckets)
      const KEYWORD_TYPES = {
        'dump':            ['transfer_station', 'landfill'],
        'recycling':       ['recycling_center', 'transfer_station'],
        'recycle':         ['recycling_center', 'transfer_station'],
        'transfer':        ['transfer_station'],
        'transfer station':['transfer_station'],
        'landfill':        ['landfill'],
        'construction':    ['construction_debris', 'transfer_station'],
        'cnd':             ['construction_debris'],
        'c&d':             ['construction_debris'],
        'crv':             ['recycling_center'],
        'scrap':           ['scrap_metal'],
        'scrap metal':     ['scrap_metal'],
        'scrap yard':      ['scrap_metal'],
        'metal':           ['scrap_metal', 'recycling_center'],
        'e-waste':         ['e_waste'],
        'ewaste':          ['e_waste'],
        'electronics':     ['e_waste'],
        'hhw':             ['household_hazardous'],
        'hazardous':       ['household_hazardous'],
        'paint':           ['household_hazardous'],
        'donation':        ['donation_dropoff'],
        'donate':          ['donation_dropoff'],
        'goodwill':        ['donation_dropoff'],
        'restore':         ['donation_dropoff'],
        'free drop':       ['donation_dropoff', 'recycling_center'],
        'free drop-off':   ['donation_dropoff', 'recycling_center'],
        'free dropoff':    ['donation_dropoff', 'recycling_center'],
        'green waste':     ['composting', 'transfer_station'],
        'compost':         ['composting'],
        'yard waste':      ['composting'],
      }
      const expandedTypes = []
      if (q) {
        for (const [kw, kinds] of Object.entries(KEYWORD_TYPES)) {
          if (q.includes(kw)) kinds.forEach((k) => { if (!expandedTypes.includes(k)) expandedTypes.push(k) })
        }
      }

      const query = status === 'all' ? {} : { status }
      let docs = await db.collection('facilities').find(query).limit(2000).toArray()

      docs = docs.map(clean)
      if (types.length) docs = docs.filter((f) => types.includes(f.type) || types.includes(f.typeKey))
      if (verified) docs = docs.filter((f) => f.verified)
      if (materials.length) docs = docs.filter((f) => materials.some((m) => (f.accepted || []).some((a) => String(a).toLowerCase().includes(m.toLowerCase()))))
      if (q) {
        docs = docs.filter(
          (f) =>
            f.name?.toLowerCase().includes(q) ||
            f.address?.toLowerCase().includes(q) ||
            f.city?.toLowerCase().includes(q) ||
            f.county?.toLowerCase().includes(q) ||
            f.type?.toLowerCase().includes(q) ||
            f.typeKey?.toLowerCase().includes(q) ||
            (f.accepted || []).some((m) => String(m).toLowerCase().includes(q)) ||
            (f.tags || []).some((t) => String(t).toLowerCase().includes(q)) ||
            (f.notes || '').toLowerCase().includes(q) ||
            (expandedTypes.length && expandedTypes.includes(f.typeKey))
        )
      }
      if (!isNaN(lat) && !isNaN(lng)) {
        docs = docs.map((f) => ({ ...f, distanceKm: distanceKm(lat, lng, f.lat, f.lng) }))
        if (maxKm) docs = docs.filter((f) => f.distanceKm <= maxKm)
        docs.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
      }
      docs = await attachActiveAlerts(db, docs)
      return handleCORS(NextResponse.json({ facilities: docs }))
    }

    // ============================================================
    // RECOMMENDATIONS ENGINE — "Best Option Right Now"
    // ============================================================
    // GET /api/recommendations/best-option?lat=&lng=&material=&maxKm=&limit=
    // Scoring formula (composite 0-100):
    //   30 pts — Proximity (linear falloff; <=5km full pts, 0 at 50km)
    //   15 pts — Open status (CLOSED=-30, ACCEPTING_NOW=+15, default open=+8)
    //   15 pts — Material accepted (exact match=+15, partial=+8, none=0; if material provided and not accepted → exclude)
    //   15 pts — Wait time signal (WAIT_TIME/LONG_LINE/YARD_FULL=-15, FAST_MOVING=+15, default=+8)
    //    5 pts — Contractor-friendly (if user role contractor AND facility flag set)
    //   10 pts — Recent positive community signals (last 6h)
    //    5 pts — Reviews/ratings (>=4.0=+5, >=3.0=+2, <2.0=-3)
    //  -10 pts — Active hazards (SCALE_ISSUE / NOT_ACCEPTING penalty)
    //    3 pts — Pricing transparency (any pricing info present)
    //    2 pts — Hot-spot density nearby (open jobs within 10km)
    // Returns: { topPick, alternatives[], scoredAt, signals }
    if (route === '/recommendations/best-option' && method === 'GET') {
      const lat = parseFloat(url.searchParams.get('lat'))
      const lng = parseFloat(url.searchParams.get('lng'))
      if (isNaN(lat) || isNaN(lng)) {
        return handleCORS(NextResponse.json({ error: 'lat and lng required' }, { status: 400 }))
      }
      const material = (url.searchParams.get('material') || '').toLowerCase().trim()
      const maxKm = parseFloat(url.searchParams.get('maxKm')) || 50
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 20)
      // Determine user role (if logged in)
      const auth = getAuth(request)
      let user = null
      if (auth) user = await db.collection('users').findOne({ id: auth.id })
      const userIsContractor = !!user && /contractor|hauler|junk_hauler/i.test(user.role || user.communityProfileType || '')

      // Pull active/approved facilities + alerts in parallel
      let facilities = await db.collection('facilities').find({ status: { $in: ['active', 'approved'] } }).limit(2000).toArray()
      facilities = facilities.map(clean)
      // Add distance + filter by maxKm (require lat/lng)
      facilities = facilities
        .map((f) => ({ ...f, distanceKm: distanceKm(lat, lng, f.lat, f.lng) }))
        .filter((f) => f.lat != null && f.lng != null && f.distanceKm != null && f.distanceKm <= maxKm)
      if (!facilities.length) {
        return handleCORS(NextResponse.json({ topPick: null, alternatives: [], scoredAt: new Date(), signals: { reason: 'No facilities within ' + maxKm + ' km' } }))
      }
      // Attach alerts + reviews aggregates in batch
      facilities = await attachActiveAlerts(db, facilities)
      const facIds = facilities.map((f) => f.id)
      const reviews = await db.collection('reviews').find({ facilityId: { $in: facIds } }).toArray()
      const reviewsByFac = {}
      for (const r of reviews) {
        if (!reviewsByFac[r.facilityId]) reviewsByFac[r.facilityId] = []
        reviewsByFac[r.facilityId].push(r)
      }
      // Hot-spot job density nearby (within 10km of user)
      const openJobs = await db.collection('jobs').find({ status: { $in: ['open', 'accepted'] } }).limit(500).toArray().catch(() => [])
      const nearbyJobCount = openJobs.filter((j) => {
        if (j.lat == null || j.lng == null) return false
        return distanceKm(lat, lng, j.lat, j.lng) <= 10
      }).length

      const since6h = Date.now() - 6 * 3600 * 1000
      // Score each facility
      const scored = facilities.map((f) => {
        const score = { breakdown: {}, reasons: [], penalties: [] }
        const acceptedLower = (f.accepted || []).map((m) => String(m).toLowerCase())

        // Material check (hard filter or partial)
        if (material) {
          const exact = acceptedLower.includes(material)
          const partial = acceptedLower.some((m) => m.includes(material) || material.includes(m))
          if (!exact && !partial) {
            score.breakdown.material = -999  // exclude
            return { facility: f, score: -999, ...score }
          }
          score.breakdown.material = exact ? 15 : 8
          if (exact) score.reasons.push(`Accepts ${material}`)
          else score.reasons.push(`Accepts similar material (${material})`)
        } else {
          score.breakdown.material = 0
        }

        // Proximity (max 30)
        const prox = f.distanceKm <= 5 ? 30 : Math.max(0, 30 - ((f.distanceKm - 5) / 45) * 30)
        score.breakdown.proximity = Math.round(prox)
        if (f.distanceKm <= 5) score.reasons.push(`Only ${f.distanceKm.toFixed(1)} km away`)
        else if (f.distanceKm <= 15) score.reasons.push(`${f.distanceKm.toFixed(1)} km away`)

        // Open status from active alerts
        const alerts = f.activeAlerts || []
        const closed = alerts.find((a) => a.type === 'CLOSED')
        const acceptingNow = alerts.find((a) => a.type === 'ACCEPTING_NOW')
        let openScore = 8 // default assumed open
        if (closed) { openScore = -30; score.penalties.push('Reported closed') }
        else if (acceptingNow) { openScore = 15; score.reasons.push('Actively accepting now') }
        score.breakdown.open = openScore

        // Wait time signal
        const waitAlert = alerts.find((a) => /WAIT_TIME|LONG_LINE|YARD_FULL/.test(a.type))
        const fastAlert = alerts.find((a) => a.type === 'FAST_MOVING')
        let waitScore = 8
        if (waitAlert) { waitScore = -15; score.penalties.push(`${ALERT_TYPES[waitAlert.type]?.label || 'Delay'} reported`) }
        else if (fastAlert) { waitScore = 15; score.reasons.push('Fast moving line') }
        score.breakdown.wait = waitScore

        // Contractor-friendly bonus
        if (userIsContractor && f.contractorFriendly) {
          score.breakdown.contractor = 5; score.reasons.push('Contractor-friendly')
        } else { score.breakdown.contractor = 0 }

        // Recent community signals (last 6h)
        const recentPositive = alerts.filter((a) => new Date(a.createdAt).getTime() >= since6h && /FAST_MOVING|ACCEPTING_NOW/.test(a.type)).length
        const recentNegative = alerts.filter((a) => new Date(a.createdAt).getTime() >= since6h && /WAIT_TIME|LONG_LINE|YARD_FULL|CLOSED/.test(a.type)).length
        const commScore = Math.max(-10, Math.min(10, (recentPositive - recentNegative) * 3))
        score.breakdown.community = commScore
        if (commScore >= 6) score.reasons.push(`${recentPositive} positive report${recentPositive === 1 ? '' : 's'} (6h)`)

        // Reviews / ratings
        const facReviews = reviewsByFac[f.id] || []
        const avgRating = facReviews.length ? facReviews.reduce((s, r) => s + (r.rating || 0), 0) / facReviews.length : 0
        let reviewScore = 0
        if (avgRating >= 4) { reviewScore = 5; score.reasons.push(`${avgRating.toFixed(1)} avg (${facReviews.length} review${facReviews.length === 1 ? '' : 's'})`) }
        else if (avgRating >= 3) reviewScore = 2
        else if (avgRating > 0 && avgRating < 2) { reviewScore = -3; score.penalties.push(`Low rating (${avgRating.toFixed(1)})`) }
        score.breakdown.reviews = reviewScore

        // Active hazards (SCALE_ISSUE / NOT_ACCEPTING)
        const hazardAlert = alerts.find((a) => /SCALE_ISSUE|NOT_ACCEPTING/.test(a.type))
        let hazardScore = 0
        if (hazardAlert) { hazardScore = -10; score.penalties.push(`${ALERT_TYPES[hazardAlert.type]?.label || 'Issue'} reported`) }
        score.breakdown.hazards = hazardScore

        // Pricing transparency
        const hasPricing = (typeof f.pricing === 'string' && f.pricing) ||
                          (f.pricing && typeof f.pricing === 'object' && Object.values(f.pricing).some((v) => v))
        score.breakdown.pricing = hasPricing ? 3 : 0
        if (hasPricing) score.reasons.push('Pricing posted')

        // Hot-spot density nearby
        score.breakdown.hotspots = nearbyJobCount > 0 ? 2 : 0

        const total = Object.values(score.breakdown).reduce((a, b) => a + b, 0)
        return { facility: f, score: total, ...score }
      })

      const eligible = scored.filter((s) => s.score > -100).sort((a, b) => b.score - a.score)
      if (!eligible.length) {
        return handleCORS(NextResponse.json({
          topPick: null, alternatives: [], scoredAt: new Date(),
          signals: { reason: material ? `No facilities within ${maxKm}km accept "${material}"` : 'No eligible facilities' },
        }))
      }
      const formatPick = (s) => ({
        facility: s.facility,
        score: s.score,
        scorePct: Math.max(0, Math.min(100, Math.round((s.score / 100) * 100))),
        reasons: s.reasons,
        penalties: s.penalties,
        breakdown: s.breakdown,
      })
      return handleCORS(NextResponse.json({
        topPick: formatPick(eligible[0]),
        alternatives: eligible.slice(1, limit).map(formatPick),
        scoredAt: new Date(),
        signals: {
          totalConsidered: facilities.length,
          eligibleCount: eligible.length,
          nearbyJobCount,
          userIsContractor,
          material: material || null,
          maxKm,
        },
      }))
    }

    if (route.startsWith('/facilities/') && method === 'GET' && route.split('/').length === 3) {
      const id = route.split('/')[2]
      const f = await db.collection('facilities').findOne({ id })
      if (!f) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const reviews = await db.collection('reviews').find({ facilityId: id }).toArray()
      const now = new Date()
      // sweep expired
      await db.collection('alerts').updateMany(
        { facilityId: id, status: 'active', expiresAt: { $lte: now } },
        { $set: { status: 'expired' } }
      )
      const alerts = await db
        .collection('alerts')
        .find({ facilityId: id, status: 'active', expiresAt: { $gt: now } })
        .sort({ createdAt: -1 })
        .toArray()
      const [enriched] = await attachActiveAlerts(db, [clean(f)])
      const ownerUser = f.claimedByUserId ? await db.collection('users').findOne({ id: f.claimedByUserId }) : null
      return handleCORS(
        NextResponse.json({
          facility: {
            ...enriched,
            reviewCount: reviews.length,
            owner: ownerUser ? { id: ownerUser.id, name: ownerUser.name, email: ownerUser.email, verificationLevel: ownerUser.verificationLevel } : null,
          },
          reviews: reviews.map(clean),
          alerts: alerts.map(clean),
        })
      )
    }

    // user submits a new facility (pending)
    if (route === '/facilities' && method === 'POST') {
      const body = await request.json()
      if (!body.name || !body.address || !body.type) {
        return handleCORS(NextResponse.json({ error: 'name, address, type are required' }, { status: 400 }))
      }
      // geocode if not provided using OSM Nominatim
      let lat = body.lat
      let lng = body.lng
      if (!lat || !lng) {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(body.address)}`,
            { headers: { 'User-Agent': 'DumpMaps/1.0' } }
          )
          const j = await r.json()
          if (j && j[0]) {
            lat = parseFloat(j[0].lat)
            lng = parseFloat(j[0].lon)
          }
        } catch (e) {
          console.error('geocode failed', e)
        }
      }
      const auth = getAuth(request)
      const facility = {
        id: uuidv4(),
        name: body.name,
        type: body.type,
        typeKey: body.typeKey || null,
        address: body.address,
        lat: lat || 34.0522,
        lng: lng || -118.2437,
        phone: body.phone || '',
        website: body.website || '',
        hours: body.hours || '',
        accepted: body.accepted || [],
        notAccepted: body.notAccepted || [],
        currentStatus: body.currentStatus || '',
        contractorNotes: Array.isArray(body.contractorNotes) ? body.contractorNotes : [],
        restricted: body.restricted || [],
        pricing: body.pricing || '',
        pricingFields: body.pricingFields || {},
        extraFields: body.extraFields || {},
        pricingUnknown: !!body.pricingUnknown,
        verifyLater: !!body.verifyLater,
        tags: Array.isArray(body.tags) ? body.tags : [],
        flags: body.flags || {},
        images: body.images || [],
        photos: body.photos || [],
        notes: body.notes || '',
        verified: false,
        rating: 0,
        reviewsCount: 0,
        status: body.status || 'pending',
        lastUpdated: body.lastUpdated ? new Date(body.lastUpdated) : new Date(),
        submittedAt: new Date(),
        submittedBy: auth?.id || 'guest',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('facilities').insertOne(facility)
      return handleCORS(NextResponse.json({ facility: clean(facility) }))
    }

    // admin moderation: approve/reject/verify/delete
    // IMPORTANT: Only match /admin/facilities/:id (not /admin/facilities/:id/rewards-config)
    if (/^\/admin\/facilities\/[^/]+$/.test(route) && method === 'PATCH') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const id = route.split('/')[3]
      const body = await request.json()
      const update = {}
      if (body.status) update.status = body.status
      if (typeof body.verified === 'boolean') update.verified = body.verified
      if (body.adminNotes !== undefined) update.adminNotes = body.adminNotes
      update.updatedAt = new Date()
      await db.collection('facilities').updateOne({ id }, { $set: update })
      const f = await db.collection('facilities').findOne({ id })
      return handleCORS(NextResponse.json({ facility: clean(f) }))
    }

    // IMPORTANT: Only match /admin/facilities/:id (not sub-routes)
    if (/^\/admin\/facilities\/[^/]+$/.test(route) && method === 'DELETE') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const id = route.split('/')[3]
      await db.collection('facilities').deleteOne({ id })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // ---------- REVIEWS ----------
    if (route === '/reviews' && method === 'POST') {
      const body = await request.json()
      if (!body.facilityId || !body.rating) {
        return handleCORS(NextResponse.json({ error: 'facilityId and rating required' }, { status: 400 }))
      }
      const auth = getAuth(request)
      const review = {
        id: uuidv4(),
        facilityId: body.facilityId,
        rating: parseInt(body.rating),
        text: body.text || '',
        material: body.material || '',
        visitDate: body.visitDate || '',
        imageUrl: body.imageUrl || '',
        authorName: auth?.email || body.authorName || 'Guest',
        authorId: auth?.id || 'guest',
        createdAt: new Date(),
      }
      await db.collection('reviews').insertOne(review)
      // recompute rating
      const all = await db.collection('reviews').find({ facilityId: body.facilityId }).toArray()
      const avg = all.reduce((s, r) => s + r.rating, 0) / all.length
      await db
        .collection('facilities')
        .updateOne({ id: body.facilityId }, { $set: { rating: avg, reviewsCount: all.length } })
      return handleCORS(NextResponse.json({ review: clean(review) }))
    }

    // ---------- FLAGS ----------
    if (route === '/flags' && method === 'POST') {
      const body = await request.json()
      const auth = getAuth(request)
      const flag = {
        id: uuidv4(),
        facilityId: body.facilityId,
        reason: body.reason || 'inaccurate',
        text: body.text || '',
        authorId: auth?.id || 'guest',
        createdAt: new Date(),
      }
      await db.collection('flags').insertOne(flag)
      return handleCORS(NextResponse.json({ flag: clean(flag) }))
    }

    // ---------- ADMIN LIST ----------
    if (route === '/admin/pending' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const pending = await db.collection('facilities').find({ status: 'pending' }).toArray()
      return handleCORS(NextResponse.json({ facilities: pending.map(clean) }))
    }

    if (route === '/admin/flags' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const flags = await db.collection('flags').find({}).toArray()
      return handleCORS(NextResponse.json({ flags: flags.map(clean) }))
    }

    // ---------- GEOCODE (forward) ----------
    if (route === '/geocode' && method === 'GET') {
      const q = url.searchParams.get('q')
      if (!q) return handleCORS(NextResponse.json({ results: [] }))
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
          { headers: { 'User-Agent': 'DumpMaps/1.0' } }
        )
        const j = await r.json()
        return handleCORS(
          NextResponse.json({
            results: j.map((x) => ({
              displayName: x.display_name,
              lat: parseFloat(x.lat),
              lng: parseFloat(x.lon),
            })),
          })
        )
      } catch (e) {
        return handleCORS(NextResponse.json({ results: [] }))
      }
    }

    // ---------- PILOT SIGNUP ----------
    if (route === '/pilot-signup' && method === 'POST') {
      const body = await request.json()
      if (!body.email) return handleCORS(NextResponse.json({ error: 'email required' }, { status: 400 }))
      await db.collection('pilot_signups').insertOne({
        id: uuidv4(),
        email: body.email,
        role: body.role || '',
        city: body.city || '',
        createdAt: new Date(),
      })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // ---------- BETA WAITLIST SIGNUP (V1 strategic pivot) ----------
    // Saves to `beta_signups` collection and queues an admin notification.
    // Real email delivery is TODO (pending SendGrid/Resend key) — the
    // `admin_notifications_queue` collection lets admins see submissions
    // immediately in the dashboard while we wire up the provider.
    if (route === '/beta-signup' && method === 'POST') {
      const body = await request.json()
      if (!body.email || !String(body.email).includes('@')) {
        return handleCORS(NextResponse.json({ error: 'Valid email required' }, { status: 400 }))
      }
      const id = uuidv4()
      const now = new Date()
      await db.collection('beta_signups').insertOne({
        id,
        email: String(body.email).trim().toLowerCase(),
        fullName: body.fullName || '',
        role: body.role || '',
        city: body.city || '',
        state: body.state || '',
        interests: Array.isArray(body.interests) ? body.interests : [],
        notes: body.notes || '',
        source: 'beta_page',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
      // Queue an admin notification (visible in admin dashboard) so Jamal
      // sees new signups even before email provider is wired.
      await db.collection('admin_notifications_queue').insertOne({
        id: uuidv4(),
        type: 'beta_signup',
        title: `New beta signup: ${body.email}`,
        summary: `${body.fullName || 'Someone'} (${body.role || 'role unspecified'}) from ${body.city || 'somewhere'} joined the beta list.`,
        payload: { signupId: id, email: body.email, fullName: body.fullName, role: body.role, city: body.city, state: body.state },
        emailTo: 'jamal@dumpmaps.org',
        emailSubject: `[DumpMaps Beta] New signup: ${body.email}`,
        sent: false,
        createdAt: now,
      })
      return handleCORS(NextResponse.json({ ok: true, id }))
    }

    // ---------- BUSINESS PARTNERSHIP INQUIRY (V1 strategic pivot) ----------
    // Saves to `business_inquiries` collection and queues an admin notification.
    if (route === '/business-inquiry' && method === 'POST') {
      const body = await request.json()
      if (!body.businessName || !body.email || !String(body.email).includes('@')) {
        return handleCORS(NextResponse.json({ error: 'Business name and valid email required' }, { status: 400 }))
      }
      const id = uuidv4()
      const now = new Date()
      await db.collection('business_inquiries').insertOne({
        id,
        businessName: String(body.businessName).trim(),
        contactName: body.contactName || '',
        email: String(body.email).trim().toLowerCase(),
        phone: body.phone || '',
        businessType: body.businessType || '',
        city: body.city || '',
        state: body.state || '',
        website: body.website || '',
        interest: body.interest || 'partnership',
        message: body.message || '',
        source: 'business_page',
        status: 'new',
        createdAt: now,
        updatedAt: now,
      })
      await db.collection('admin_notifications_queue').insertOne({
        id: uuidv4(),
        type: 'business_inquiry',
        title: `New business inquiry: ${body.businessName}`,
        summary: `${body.contactName || 'A contact'} at ${body.businessName} (${body.businessType || 'type unspecified'}) is interested in ${body.interest || 'partnership'}.`,
        payload: { inquiryId: id, businessName: body.businessName, email: body.email, businessType: body.businessType, interest: body.interest, city: body.city, state: body.state },
        emailTo: 'jamal@dumpmaps.org',
        emailSubject: `[DumpMaps Business] New inquiry: ${body.businessName}`,
        sent: false,
        createdAt: now,
      })
      return handleCORS(NextResponse.json({ ok: true, id }))
    }

    // ---------- MARKETPLACE: CONTACT SELLER (July 2026 revival) ----------
    // Buyer sends a message to a seller via email. If Gmail is configured
    // (GMAIL_USER + GMAIL_APP_PASSWORD env vars), we send a real email
    // with replyTo = buyer's email. If not configured yet, we queue an admin
    // notification + persist the request so nothing is lost.
    if (route === '/marketplace/contact-seller' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth || auth.id === 'guest') {
        return handleCORS(NextResponse.json({ error: 'Please log in to contact a seller' }, { status: 401 }))
      }
      const body = await request.json()
      const { listingId, buyerName, buyerEmail, buyerPhone, message } = body
      if (!listingId || !buyerEmail || !buyerEmail.includes('@') || !message || String(message).trim().length < 5) {
        return handleCORS(NextResponse.json({ error: 'listingId, valid email, and a message (min 5 chars) are required' }, { status: 400 }))
      }

      // Look up the listing + seller.
      const listing = await db.collection('marketplace_listings').findOne({ id: listingId })
      if (!listing) return handleCORS(NextResponse.json({ error: 'Listing not found' }, { status: 404 }))
      if (listing.sellerId === auth.id) {
        return handleCORS(NextResponse.json({ error: 'You cannot contact yourself' }, { status: 400 }))
      }
      const seller = await db.collection('users').findOne({ id: listing.sellerId })
      const sellerEmail = seller?.email
      if (!sellerEmail) {
        return handleCORS(NextResponse.json({ error: 'Seller has no email on file' }, { status: 400 }))
      }

      // Load Gmail helper LAZILY so the file doesn't get bundled unless needed.
      const { sendEmail, renderContactSellerEmail, isEmailConfigured } = await import('@/lib/email/gmail')

      const contactId = uuidv4()
      const now = new Date()

      // Persist to marketplace_contact_requests (source of truth).
      await db.collection('marketplace_contact_requests').insertOne({
        id: contactId,
        listingId,
        listingTitle: listing.title,
        sellerId:  listing.sellerId,
        sellerEmail,
        buyerId:   auth.id,
        buyerName: buyerName || '',
        buyerEmail,
        buyerPhone: buyerPhone || '',
        message: String(message).trim(),
        status: 'pending',
        emailSent: false,
        createdAt: now,
        updatedAt: now,
      })

      let emailResult = { ok: false, skipped: true }
      if (isEmailConfigured()) {
        // Build the absolute URL to the listing so the seller can click through.
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
        const listingUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/marketplace/${listingId}` : `/marketplace/${listingId}`
        const html = renderContactSellerEmail({
          listing,
          buyer: { name: buyerName, email: buyerEmail, phone: buyerPhone },
          message: String(message).trim(),
          listingUrl,
        })
        emailResult = await sendEmail({
          to: sellerEmail,
          replyTo: buyerEmail,
          subject: `[DumpMaps] New inquiry for "${listing.title}" from ${buyerName || buyerEmail}`,
          html,
          text: `${buyerName || buyerEmail} is interested in "${listing.title}".\n\n${message}\n\nReply to this email to respond directly (${buyerEmail}${buyerPhone ? ' / ' + buyerPhone : ''}).`,
        })
        if (emailResult.ok) {
          await db.collection('marketplace_contact_requests').updateOne(
            { id: contactId },
            { $set: { emailSent: true, emailMessageId: emailResult.messageId, status: 'sent', sentAt: new Date() } }
          )
        }
      }

      // ALWAYS queue an admin notification (so Jamal can review contact volumes).
      await db.collection('admin_notifications_queue').insertOne({
        id: uuidv4(),
        type: 'marketplace_contact',
        title: `Marketplace contact: ${listing.title}`,
        summary: `${buyerName || buyerEmail} \u2192 ${sellerEmail}${emailResult.ok ? ' (email sent)' : ' (queued)'}`,
        payload: { contactId, listingId, buyerEmail, sellerEmail, emailSent: emailResult.ok },
        emailTo: 'jamal@dumpmaps.org',
        emailSubject: `[DumpMaps Marketplace] New buyer inquiry`,
        sent: emailResult.ok,
        createdAt: now,
      })

      // Also drop an in-app message thread from buyer \u2192 seller as fallback.
      // Best-effort; ignore failures so the primary flow always completes.
      try {
        await db.collection('messages').insertOne({
          id: uuidv4(),
          senderId: auth.id,
          receiverId: listing.sellerId,
          text: `\ud83d\udcec Marketplace inquiry \u2014 "${listing.title}"\n\n${message}\n\n(Reply-to: ${buyerEmail}${buyerPhone ? ' / ' + buyerPhone : ''})`,
          context: { listingId, kind: 'marketplace_contact_seller' },
          createdAt: now,
        })
      } catch (_e) { /* noop */ }

      return handleCORS(NextResponse.json({
        ok: true,
        id: contactId,
        sent:  emailResult.ok === true,
        queued: emailResult.ok !== true,
      }))
    }


    // Super-admin only. Powers the admin review page for new leads.
    if (route === '/admin/beta-signups' && method === 'GET') {
      const auth = getAuth(request)
      const user = auth?.id && auth.id !== 'guest' ? await db.collection('users').findOne({ id: auth.id }) : null
      if (!user || !['super_admin', 'admin', 'moderator'].includes(user.role)) {
        return handleCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
      }
      const beta = await db.collection('beta_signups').find({}).sort({ createdAt: -1 }).limit(500).toArray()
      const business = await db.collection('business_inquiries').find({}).sort({ createdAt: -1 }).limit(500).toArray()
      const notifs = await db.collection('admin_notifications_queue').find({ sent: false }).sort({ createdAt: -1 }).limit(200).toArray()
      return handleCORS(NextResponse.json({
        betaSignups:       beta.map((s) => ({ ...s, _id: undefined })),
        businessInquiries: business.map((s) => ({ ...s, _id: undefined })),
        notifications:     notifs.map((n) => ({ ...n, _id: undefined })),
      }))
    }

    // ---------- ADMIN: update lead status ----------
    // Marks a beta signup or business inquiry as contacted/closed and stores internal notes.
    if (route === '/admin/leads/update' && method === 'POST') {
      const auth = getAuth(request)
      const staff = auth?.id && auth.id !== 'guest' ? await db.collection('users').findOne({ id: auth.id }) : null
      if (!staff || !['super_admin', 'admin', 'moderator'].includes(staff.role)) {
        return handleCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
      }
      const body = await request.json()
      const { kind, id, status, notes } = body
      if (!kind || !id || !status) {
        return handleCORS(NextResponse.json({ error: 'kind, id, status required' }, { status: 400 }))
      }
      const collection = kind === 'beta' ? 'beta_signups' : kind === 'business' ? 'business_inquiries' : null
      if (!collection) {
        return handleCORS(NextResponse.json({ error: 'invalid kind' }, { status: 400 }))
      }
      const upd = {
        status,
        internalNotes: notes || '',
        contactedBy: staff.id,
        contactedByName: staff.name || staff.email,
        contactedAt: new Date(),
        updatedAt: new Date(),
      }
      const result = await db.collection(collection).updateOne({ id }, { $set: upd })
      if (result.matchedCount === 0) {
        return handleCORS(NextResponse.json({ error: 'not found' }, { status: 404 }))
      }
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // ---------- ADMIN: mark queued email notification as sent ----------
    // Used until we wire up SendGrid/Resend — admin clicks "Mark Sent" after
    // manually emailing the person.
    if (route === '/admin/leads/mark-notif-sent' && method === 'POST') {
      const auth = getAuth(request)
      const staff = auth?.id && auth.id !== 'guest' ? await db.collection('users').findOne({ id: auth.id }) : null
      if (!staff || !['super_admin', 'admin', 'moderator'].includes(staff.role)) {
        return handleCORS(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
      }
      const body = await request.json()
      if (!body?.id) return handleCORS(NextResponse.json({ error: 'id required' }, { status: 400 }))
      await db.collection('admin_notifications_queue').updateOne({ id: body.id }, { $set: { sent: true, sentAt: new Date(), sentBy: staff.id } })
      return handleCORS(NextResponse.json({ ok: true }))
    }


    // ---------- ALERTS (Waze-style real-time facility status) ----------
    if (route === '/alerts' && method === 'POST') {
      const body = await request.json()
      const auth = getAuth(request)
      if (!body.facilityId || !body.type) {
        return handleCORS(NextResponse.json({ error: 'facilityId and type required' }, { status: 400 }))
      }
      const meta = ALERT_TYPES[body.type]
      if (!meta) return handleCORS(NextResponse.json({ error: 'Unknown alert type' }, { status: 400 }))
      const expiryHours = meta.expiryHours || 6
      // detect if user owns this facility -> official alert
      let isOfficial = false
      let authorUser = null
      if (auth?.id && auth.id !== 'guest') {
        authorUser = await db.collection('users').findOne({ id: auth.id })
        if (authorUser?.ownedFacilities?.includes(body.facilityId)) isOfficial = true
      }
      const alert = {
        id: uuidv4(),
        facilityId: body.facilityId,
        type: body.type,
        label: meta.label,
        severity: meta.severity,
        text: body.text || '',
        waitMinutes: body.waitMinutes ? parseInt(body.waitMinutes) : null,
        truckCount: body.truckCount ? parseInt(body.truckCount) : null,
        material: body.material || '',
        photoUrl: body.photoUrl || '',
        confirmCount: 1,
        denyCount: 0,
        flagCount: 0,
        votedBy: [auth?.id || 'guest'],
        userId: auth?.id || 'guest',
        userName: authorUser?.name || auth?.email?.split('@')[0] || 'Guest',
        userRole: authorUser?.primaryProfile || '',
        isOfficial,
        createdAt: new Date(),
        // Owners get DOUBLE expiry on their official posts
        expiryHours: isOfficial ? expiryHours * 2 : expiryHours,
        expiresAt: new Date(Date.now() + (isOfficial ? expiryHours * 2 : expiryHours) * 60 * 60 * 1000),
        status: 'active',
      }
      await db.collection('alerts').insertOne(alert)
      if (auth?.id && auth.id !== 'guest') {
        await db.collection('users').updateOne({ id: auth.id }, { $inc: { karma: isOfficial ? 2 : 1 } })
      }
      return handleCORS(NextResponse.json({ alert: clean(alert) }))
    }

    if (route === '/alerts' && method === 'GET') {
      const facilityId = url.searchParams.get('facilityId')
      const recent = url.searchParams.get('recent') === 'true'
      // ignore custom hours range — only active alerts (per-type expiry already enforced)
      const now = new Date()
      // background sweep
      await db.collection('alerts').updateMany(
        { status: 'active', expiresAt: { $lte: now } },
        { $set: { status: 'expired' } }
      )
      const query = { status: 'active', expiresAt: { $gt: now } }
      if (facilityId) query.facilityId = facilityId
      const alerts = await db.collection('alerts').find(query).sort({ createdAt: -1 }).limit(200).toArray()
      const facIds = [...new Set(alerts.map((a) => a.facilityId))]
      const facs = await db.collection('facilities').find({ id: { $in: facIds } }).toArray()
      const facMap = Object.fromEntries(facs.map((f) => [f.id, f]))
      const out = alerts.map((a) => ({
        ...clean(a),
        facilityName: facMap[a.facilityId]?.name || 'Unknown',
        facilityType: facMap[a.facilityId]?.type || '',
        facilityLat: facMap[a.facilityId]?.lat,
        facilityLng: facMap[a.facilityId]?.lng,
      }))
      return handleCORS(NextResponse.json({ alerts: out }))
    }

    if (route.startsWith('/alerts/') && route.endsWith('/flag') && method === 'POST') {
      const id = route.split('/')[2]
      const body = await request.json()
      const auth = getAuth(request)
      const alert = await db.collection('alerts').findOne({ id })
      if (!alert) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      await db.collection('alerts').updateOne(
        { id },
        { $inc: { flagCount: 1 }, $push: { flags: { userId: auth?.id || 'guest', reason: body.reason || '', at: new Date() } } }
      )
      // auto-remove after 3 flags
      const updated = await db.collection('alerts').findOne({ id })
      if ((updated.flagCount || 0) >= 3) {
        await db.collection('alerts').updateOne({ id }, { $set: { status: 'flagged' } })
      }
      return handleCORS(NextResponse.json({ ok: true }))
    }

    if (route.startsWith('/alerts/') && route.endsWith('/vote') && method === 'POST') {
      const id = route.split('/')[2]
      const body = await request.json()
      const auth = getAuth(request)
      const voterId = auth?.id || 'guest-' + (request.headers.get('x-forwarded-for') || 'anon')
      const alert = await db.collection('alerts').findOne({ id })
      if (!alert) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if ((alert.votedBy || []).includes(voterId)) {
        return handleCORS(NextResponse.json({ error: 'Already voted', alert: clean(alert) }, { status: 400 }))
      }
      const update = {
        $addToSet: { votedBy: voterId },
        $inc: body.vote === 'confirm' ? { confirmCount: 1 } : { denyCount: 1 },
      }
      // Auto-extend on confirm, auto-remove on heavy denial
      await db.collection('alerts').updateOne({ id }, update)
      const updated = await db.collection('alerts').findOne({ id })
      if (body.vote === 'confirm') {
        await db
          .collection('alerts')
          .updateOne({ id }, { $set: { expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) } })
      }
      if (updated.denyCount >= 3 && updated.denyCount > updated.confirmCount + 1) {
        await db.collection('alerts').updateOne({ id }, { $set: { status: 'expired' } })
      }
      const final = await db.collection('alerts').findOne({ id })
      return handleCORS(NextResponse.json({ alert: clean(final) }))
    }

    if (route.startsWith('/alerts/') && method === 'DELETE') {
      const id = route.split('/')[2]
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const alert = await db.collection('alerts').findOne({ id })
      if (!alert) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (alert.userId !== auth.id && !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      await db.collection('alerts').updateOne({ id }, { $set: { status: 'removed' } })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    if (route === '/alerts/types' && method === 'GET') {
      return handleCORS(NextResponse.json({ types: ALERT_TYPES }))
    }

    // ---------- FAVORITES ----------
    if (route === '/favorites' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ favorites: [] }))
      const favs = await db.collection('favorites').find({ userId: auth.id }).toArray()
      const ids = favs.map((f) => f.facilityId)
      const facs = await db.collection('facilities').find({ id: { $in: ids } }).toArray()
      const enriched = await attachActiveAlerts(db, facs.map(clean))
      return handleCORS(NextResponse.json({ favorites: enriched }))
    }

    if (route.startsWith('/favorites/') && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const facilityId = route.split('/')[2]
      const existing = await db.collection('favorites').findOne({ userId: auth.id, facilityId })
      if (existing) {
        await db.collection('favorites').deleteOne({ userId: auth.id, facilityId })
        return handleCORS(NextResponse.json({ favorited: false }))
      }
      await db.collection('favorites').insertOne({
        id: uuidv4(),
        userId: auth.id,
        facilityId,
        createdAt: new Date(),
      })
      return handleCORS(NextResponse.json({ favorited: true }))
    }

    // ---------- USER PROFILE ----------
    if (route === '/auth/profile' && method === 'PATCH') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const body = await request.json()
      const update = {}
      if (body.name !== undefined) update.name = body.name
      if (body.userRole !== undefined) update.userRole = body.userRole
      if (body.bio !== undefined) update.bio = body.bio
      if (body.city !== undefined) update.city = body.city
      if (body.avatarUrl !== undefined) update.avatarUrl = body.avatarUrl
      if (body.phone !== undefined) update.phone = body.phone
      // Community profile type (resident/contractor/hauler/recycler/facility_owner/realtor/property_manager/volunteer/business/agency)
      const VALID_PROFILE_TYPES = ['resident','contractor','hauler','recycler','facility_owner','realtor','property_manager','volunteer','business','agency']
      if (body.communityProfileType !== undefined) {
        if (body.communityProfileType && !VALID_PROFILE_TYPES.includes(body.communityProfileType)) {
          return handleCORS(NextResponse.json({ error: 'Invalid profile type' }, { status: 400 }))
        }
        update.communityProfileType = body.communityProfileType
        update.communityProfileTypeSetAt = new Date()
        update.communityProfileTypePromptDismissed = true
      }
      if (body.communityProfileTypePromptDismissed === true) update.communityProfileTypePromptDismissed = true
      await db.collection('users').updateOne({ id: auth.id }, { $set: update })
      const u = await db.collection('users').findOne({ id: auth.id })
      return handleCORS(NextResponse.json({ user: clean(u) }))
    }

    if (route === '/users/me/contributions' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ alerts: [], reviews: [], submissions: [] }))
      const [alerts, reviews, submissions, favs] = await Promise.all([
        db.collection('alerts').find({ userId: auth.id }).sort({ createdAt: -1 }).limit(50).toArray(),
        db.collection('reviews').find({ authorId: auth.id }).sort({ createdAt: -1 }).limit(50).toArray(),
        db.collection('facilities').find({ submittedBy: auth.id }).sort({ createdAt: -1 }).limit(50).toArray(),
        db.collection('favorites').find({ userId: auth.id }).toArray(),
      ])
      return handleCORS(
        NextResponse.json({
          alerts: alerts.map(clean),
          reviews: reviews.map(clean),
          submissions: submissions.map(clean),
          favoriteIds: favs.map((f) => f.facilityId),
        })
      )
    }

    // ---------- PROFILE TYPES (add / remove / set primary) ----------
    if (route === '/auth/profile-types' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const body = await request.json()
      const user = await db.collection('users').findOne({ id: auth.id })
      let types = user?.profileTypes || []
      if (body.add && !types.includes(body.add)) types = [...types, body.add]
      if (body.remove) types = types.filter((t) => t !== body.remove)
      const primary = body.primary || (types.includes(user?.primaryProfile) ? user.primaryProfile : types[0])
      await db
        .collection('users')
        .updateOne({ id: auth.id }, { $set: { profileTypes: types, primaryProfile: primary } })
      const u = await db.collection('users').findOne({ id: auth.id })
      return handleCORS(NextResponse.json({ user: clean(u) }))
    }

    // ---------- FACILITY CLAIM (owner) ----------
    if (route.match(/^\/facilities\/[^/]+\/claim$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const facilityId = route.split('/')[2]
      const body = await request.json()
      const f = await db.collection('facilities').findOne({ id: facilityId })
      if (!f) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const existing = await db.collection('claims').findOne({ facilityId, userId: auth.id, status: 'pending' })
      if (existing) return handleCORS(NextResponse.json({ error: 'Claim already pending' }, { status: 400 }))
      const claim = {
        id: uuidv4(),
        facilityId,
        userId: auth.id,
        userEmail: auth.email,
        proof: body.proof || '',
        relationship: body.relationship || '',
        status: 'pending',
        createdAt: new Date(),
      }
      await db.collection('claims').insertOne(claim)
      return handleCORS(NextResponse.json({ claim: clean(claim) }))
    }

    if (route === '/admin/claims' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const claims = await db.collection('claims').find({ status: 'pending' }).toArray()
      return handleCORS(NextResponse.json({ claims: claims.map(clean) }))
    }

    if (route.match(/^\/admin\/claims\/[^/]+$/) && method === 'PATCH') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const id = route.split('/')[3]
      const body = await request.json()
      const claim = await db.collection('claims').findOne({ id })
      if (!claim) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      await db.collection('claims').updateOne({ id }, { $set: { status: body.status, updatedAt: new Date() } })
      if (body.status === 'approved') {
        await db.collection('users').updateOne(
          { id: claim.userId },
          { $addToSet: { ownedFacilities: claim.facilityId, profileTypes: 'facility_owner' } }
        )
      }
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // Owner updates own facility (only allowed fields)
    if (route.match(/^\/facilities\/[^/]+\/owner-update$/) && method === 'PATCH') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const facilityId = route.split('/')[2]
      const user = await db.collection('users').findOne({ id: auth.id })
      if (!user?.ownedFacilities?.includes(facilityId) && !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Not the owner' }, { status: 403 }))
      }
      const body = await request.json()
      const allowed = ['hours', 'phone', 'website', 'accepted', 'notAccepted', 'restricted', 'pricing', 'pricingFields', 'extraFields', 'currentStatus', 'contractorNotes', 'images', 'photos']
      const update = {}
      for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]
      update.updatedAt = new Date()
      await db.collection('facilities').updateOne({ id: facilityId }, { $set: update })
      const f = await db.collection('facilities').findOne({ id: facilityId })
      return handleCORS(NextResponse.json({ facility: clean(f) }))
    }

    // ---------- ROUTE NOTES (private per-user notes on facilities) ----------
    if (route === '/notes' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const body = await request.json()
      if (!body.facilityId) return handleCORS(NextResponse.json({ error: 'facilityId required' }, { status: 400 }))
      await db.collection('notes').updateOne(
        { userId: auth.id, facilityId: body.facilityId },
        { $set: { userId: auth.id, facilityId: body.facilityId, text: body.text || '', updatedAt: new Date() } },
        { upsert: true }
      )
      return handleCORS(NextResponse.json({ ok: true }))
    }

    if (route.match(/^\/notes\/[^/]+$/) && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ note: null }))
      const facilityId = route.split('/')[2]
      const note = await db.collection('notes').findOne({ userId: auth.id, facilityId })
      return handleCORS(NextResponse.json({ note: note ? clean(note) : null }))
    }

    // ---------- FOLLOWS ----------
    if (route.match(/^\/follows\/[^/]+$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const facilityId = route.split('/')[2]
      const ex = await db.collection('follows').findOne({ userId: auth.id, facilityId })
      if (ex) {
        await db.collection('follows').deleteOne({ userId: auth.id, facilityId })
        return handleCORS(NextResponse.json({ following: false }))
      }
      await db.collection('follows').insertOne({
        id: uuidv4(),
        userId: auth.id,
        facilityId,
        createdAt: new Date(),
      })
      return handleCORS(NextResponse.json({ following: true }))
    }

    if (route === '/follows' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ follows: [], alerts: [] }))
      const follows = await db.collection('follows').find({ userId: auth.id }).toArray()
      // also include favorites as part of "watched" set
      const favs = await db.collection('favorites').find({ userId: auth.id }).toArray()
      const followIds = follows.map((f) => f.facilityId)
      const favIds = favs.map((f) => f.facilityId)
      const watchedIds = [...new Set([...followIds, ...favIds])]
      if (!watchedIds.length) return handleCORS(NextResponse.json({ follows: followIds, watched: watchedIds, alerts: [] }))
      const now = new Date()
      await db.collection('alerts').updateMany(
        { facilityId: { $in: watchedIds }, status: 'active', expiresAt: { $lte: now } },
        { $set: { status: 'expired' } }
      )
      const alerts = await db
        .collection('alerts')
        .find({ facilityId: { $in: watchedIds }, status: 'active', expiresAt: { $gt: now } })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray()
      const facs = await db.collection('facilities').find({ id: { $in: watchedIds } }).toArray()
      const facMap = Object.fromEntries(facs.map((f) => [f.id, f]))
      return handleCORS(
        NextResponse.json({
          follows: followIds,
          watched: watchedIds,
          alerts: alerts.map((a) => ({
            ...clean(a),
            facilityName: facMap[a.facilityId]?.name,
            facilityType: facMap[a.facilityId]?.type,
            isFavorite: favIds.includes(a.facilityId),
            isFollow: followIds.includes(a.facilityId),
          })),
        })
      )
    }

    // ---------- POSTS (facility board + community board + events) ----------
    if (route === '/posts' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const body = await request.json()
      if (!body.scope || !body.title) {
        return handleCORS(NextResponse.json({ error: 'scope and title required' }, { status: 400 }))
      }
      const user = await db.collection('users').findOne({ id: auth.id })
      const post = {
        id: uuidv4(),
        scope: body.scope, // 'facility' | 'community' | 'event'
        facilityId: body.facilityId || null,
        category: body.category || '',
        title: body.title,
        body: body.body || '',
        photoUrl: body.photoUrl || '',
        eventDate: body.eventDate || null,
        eventEndDate: body.eventEndDate || null,
        eventLocation: body.eventLocation || '',
        userId: auth.id,
        userName: user?.name || auth.email.split('@')[0],
        userPrimaryProfile: user?.primaryProfile || '',
        isOfficial: body.facilityId && (user?.ownedFacilities || []).includes(body.facilityId),
        isAdminPost: isStaff(user?.role),
        upvotes: 0,
        upvotedBy: [],
        commentCount: 0,
        createdAt: new Date(),
      }
      await db.collection('posts').insertOne(post)
      await db.collection('users').updateOne({ id: auth.id }, { $inc: { karma: 2 } })
      return handleCORS(NextResponse.json({ post: clean(post) }))
    }

    if (route === '/posts' && method === 'GET') {
      const scope = url.searchParams.get('scope')
      const facilityId = url.searchParams.get('facilityId')
      const category = url.searchParams.get('category')
      const upcoming = url.searchParams.get('upcoming') === 'true'
      const query = {}
      if (scope) query.scope = scope
      if (facilityId) query.facilityId = facilityId
      if (category) query.category = category
      if (upcoming) query.eventDate = { $gte: new Date().toISOString().split('T')[0] }
      const posts = await db.collection('posts').find(query).sort({ createdAt: -1 }).limit(200).toArray()
      // attach facility name for community/event scope
      const facIds = [...new Set(posts.map((p) => p.facilityId).filter(Boolean))]
      let facMap = {}
      if (facIds.length) {
        const facs = await db.collection('facilities').find({ id: { $in: facIds } }).toArray()
        facMap = Object.fromEntries(facs.map((f) => [f.id, f]))
      }
      const out = posts.map((p) => ({
        ...clean(p),
        facilityName: facMap[p.facilityId]?.name || null,
      }))
      return handleCORS(NextResponse.json({ posts: out }))
    }

    if (route.match(/^\/posts\/[^/]+$/) && method === 'GET') {
      const id = route.split('/')[2]
      const post = await db.collection('posts').findOne({ id })
      if (!post) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const comments = await db.collection('comments').find({ postId: id }).sort({ createdAt: 1 }).toArray()
      return handleCORS(NextResponse.json({ post: clean(post), comments: comments.map(clean) }))
    }

    if (route.match(/^\/posts\/[^/]+\/comments$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const body = await request.json()
      const user = await db.collection('users').findOne({ id: auth.id })
      const comment = {
        id: uuidv4(),
        postId: id,
        userId: auth.id,
        userName: user?.name || auth.email.split('@')[0],
        body: body.body || '',
        createdAt: new Date(),
      }
      await db.collection('comments').insertOne(comment)
      await db.collection('posts').updateOne({ id }, { $inc: { commentCount: 1 } })
      return handleCORS(NextResponse.json({ comment: clean(comment) }))
    }

    if (route.match(/^\/posts\/[^/]+\/upvote$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const post = await db.collection('posts').findOne({ id })
      if (!post) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if ((post.upvotedBy || []).includes(auth.id)) {
        await db.collection('posts').updateOne({ id }, { $pull: { upvotedBy: auth.id }, $inc: { upvotes: -1 } })
        return handleCORS(NextResponse.json({ upvoted: false }))
      }
      await db.collection('posts').updateOne({ id }, { $addToSet: { upvotedBy: auth.id }, $inc: { upvotes: 1 } })
      return handleCORS(NextResponse.json({ upvoted: true }))
    }

    // ---------- DIRECT MESSAGES ----------
    if (route === '/messages' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const body = await request.json()
      if (!body.toUserId || !body.body) {
        return handleCORS(NextResponse.json({ error: 'toUserId and body required' }, { status: 400 }))
      }
      if (body.toUserId === auth.id) {
        return handleCORS(NextResponse.json({ error: "Can't message yourself" }, { status: 400 }))
      }
      const toUser = await db.collection('users').findOne({ id: body.toUserId })
      if (!toUser) return handleCORS(NextResponse.json({ error: 'Recipient not found' }, { status: 404 }))
      const fromUser = await db.collection('users').findOne({ id: auth.id })
      const pair = [auth.id, body.toUserId].sort()
      const threadId = pair.join('_')
      const msg = {
        id: uuidv4(),
        threadId,
        fromUserId: auth.id,
        toUserId: body.toUserId,
        fromName: fromUser?.name || auth.email.split('@')[0],
        toName: toUser.name,
        body: body.body,
        read: false,
        createdAt: new Date(),
      }
      await db.collection('messages').insertOne(msg)
      return handleCORS(NextResponse.json({ message: clean(msg) }))
    }

    if (route === '/messages/threads' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ threads: [], unreadCount: 0 }))
      const all = await db
        .collection('messages')
        .find({ $or: [{ fromUserId: auth.id }, { toUserId: auth.id }] })
        .sort({ createdAt: -1 })
        .toArray()
      const map = {}
      for (const m of all) {
        if (!map[m.threadId]) {
          const otherId = m.fromUserId === auth.id ? m.toUserId : m.fromUserId
          const otherName = m.fromUserId === auth.id ? m.toName : m.fromName
          map[m.threadId] = { threadId: m.threadId, otherId, otherName, lastMessage: clean(m), unread: 0, count: 0 }
        }
        map[m.threadId].count += 1
        if (!m.read && m.toUserId === auth.id) map[m.threadId].unread += 1
      }
      const threads = Object.values(map)
      const unreadCount = threads.reduce((s, t) => s + t.unread, 0)
      return handleCORS(NextResponse.json({ threads, unreadCount }))
    }

    if (route.match(/^\/messages\/thread\/[^/]+$/) && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ messages: [] }))
      const threadId = route.split('/')[3]
      if (!threadId.includes(auth.id)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      // mark received as read
      await db
        .collection('messages')
        .updateMany({ threadId, toUserId: auth.id, read: false }, { $set: { read: true } })
      const msgs = await db.collection('messages').find({ threadId }).sort({ createdAt: 1 }).toArray()
      return handleCORS(NextResponse.json({ messages: msgs.map(clean) }))
    }

    if (route === '/users/search' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ users: [] }))
      const q = (url.searchParams.get('q') || '').toLowerCase().trim()
      if (q.length < 2) return handleCORS(NextResponse.json({ users: [] }))
      const users = await db
        .collection('users')
        .find({ $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }] })
        .limit(20)
        .toArray()
      return handleCORS(
        NextResponse.json({
          users: users
            .filter((u) => u.id !== auth.id)
            .map((u) => ({ id: u.id, name: u.name, email: u.email, primaryProfile: u.primaryProfile, karma: u.karma })),
        })
      )
    }

    // ---------- ADMIN: flagged alerts (legacy, kept) ----------
    if (route === '/admin/flagged-alerts' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const alerts = await db.collection('alerts').find({ flagCount: { $gt: 0 } }).sort({ flagCount: -1 }).limit(100).toArray()
      const facIds = [...new Set(alerts.map((a) => a.facilityId))]
      const facs = await db.collection('facilities').find({ id: { $in: facIds } }).toArray()
      const facMap = Object.fromEntries(facs.map((f) => [f.id, f]))
      return handleCORS(
        NextResponse.json({
          alerts: alerts.map((a) => ({ ...clean(a), facilityName: facMap[a.facilityId]?.name })),
        })
      )
    }

    // followers count for a facility (used by owners)
    if (route.match(/^\/facilities\/[^/]+\/followers$/) && method === 'GET') {
      const facilityId = route.split('/')[2]
      const followers = await db.collection('follows').countDocuments({ facilityId })
      const favorites = await db.collection('favorites').countDocuments({ facilityId })
      return handleCORS(NextResponse.json({ followers, favorites, total: followers + favorites }))
    }

    // ---------- PAYMENT GATEWAY INTEREST (Phase 2 preview signup) ----------
    if (route === '/payment-interest' && method === 'POST') {
      const body = await request.json()
      if (!body.email) return handleCORS(NextResponse.json({ error: 'email required' }, { status: 400 }))
      await db.collection('payment_interest').insertOne({
        id: uuidv4(),
        email: body.email,
        facilityName: body.facilityName || '',
        role: body.role || '',
        notes: body.notes || '',
        createdAt: new Date(),
      })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // ---------- PRICING UPDATE (owner/admin can patch facility pricing) ----------
    if (route.match(/^\/facilities\/[^/]+\/pricing$/) && method === 'PATCH') {
      const facilityId = route.split('/')[2]
      const auth = getAuth(request)
      // For MVP: allow any authenticated user to suggest pricing — flagged as 'user' verified
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const body = await request.json()
      const user = await db.collection('users').findOne({ id: auth.id })
      const isOwner = (user?.ownedFacilities || []).includes(facilityId)
      const isAdmin = isStaff(auth.role)
      const verifiedBy = isAdmin ? 'admin' : isOwner ? 'facility' : 'user'
      const update = {
        'pricing.lastUpdated': new Date().toISOString(),
        'pricing.verifiedBy': verifiedBy,
      }
      const fields = ['pricingType', 'pricePerTon', 'minimumCharge', 'materialPricing', 'surgeFeeNotes', 'sortingFeeNotes', 'scaleInRequired', 'scaleOutRequired', 'paymentMethods']
      for (const f of fields) {
        if (body[f] !== undefined) update[`pricing.${f}`] = body[f]
      }
      await db.collection('facilities').updateOne({ id: facilityId }, { $set: update })
      const fac = await db.collection('facilities').findOne({ id: facilityId })
      return handleCORS(NextResponse.json({ facility: clean(fac) }))
    }

    if (route === '/admin/payment-interest' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const leads = await db.collection('payment_interest').find({}).sort({ createdAt: -1 }).limit(500).toArray()
      return handleCORS(NextResponse.json({ leads: leads.map(clean) }))
    }

    // ============================================================
    // =================== PHOTO UPLOAD (local FS) ================
    // ============================================================
    // POST /api/upload   multipart/form-data, field name = "file" (one or many)
    // Returns { uploads: [{ id, url, size, mime, originalName }] }
    if (route === '/upload' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      try {
        const form = await request.formData()
        const files = []
        for (const [key, value] of form.entries()) {
          if (key === 'file' && typeof value === 'object' && 'arrayBuffer' in value) {
            files.push(value)
          }
        }
        if (files.length === 0) {
          return handleCORS(NextResponse.json({ error: 'No file uploaded' }, { status: 400 }))
        }
        const MAX_IMAGE_BYTES = 8 * 1024 * 1024   // 8 MB for images
        const MAX_VIDEO_BYTES = 64 * 1024 * 1024  // 64 MB for videos
        const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
        const allowedVideoMimes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
        // Persistent storage \u2014 survives container redeploys (unlike /public/uploads).
        const uploadDir = PERSIST_UPLOAD_DIR
        await fs.mkdir(uploadDir, { recursive: true })
        const results = []
        for (const file of files) {
          const mime = (file.type || '').toLowerCase()
          const isVideo = mime.startsWith('video/')
          const isImage = mime.startsWith('image/')
          const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
          if (file.size > maxBytes) {
            const mb = Math.round(maxBytes / 1024 / 1024)
            return handleCORS(NextResponse.json({ error: `File "${file.name}" exceeds ${mb} MB limit` }, { status: 413 }))
          }
          if (isVideo ? !allowedVideoMimes.includes(mime) : (!allowedImageMimes.includes(mime) && !isImage)) {
            return handleCORS(NextResponse.json({ error: `File "${file.name}" is not a supported image or video` }, { status: 415 }))
          }
          const id = uuidv4()
          // Derive a safe extension
          let ext = ''
          const nameExt = file.name && file.name.includes('.') ? file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') : ''
          if (nameExt && nameExt.length <= 5) ext = nameExt
          else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg'
          else if (mime.includes('png')) ext = 'png'
          else if (mime.includes('webp') && !isVideo) ext = 'webp'
          else if (mime.includes('gif')) ext = 'gif'
          else if (mime.includes('heic')) ext = 'heic'
          else if (mime.includes('heif')) ext = 'heif'
          else if (mime.includes('mp4')) ext = 'mp4'
          else if (mime.includes('webm')) ext = 'webm'
          else if (mime.includes('ogg')) ext = 'ogv'
          else if (mime.includes('quicktime')) ext = 'mov'
          else ext = 'bin'
          const fname = `${id}.${ext}`
          const fpath = nodePath.join(uploadDir, fname)
          const buf = Buffer.from(await file.arrayBuffer())
          await fs.writeFile(fpath, buf)
          // URL points at our /api/files/[name] route which streams from /data/uploads.
          // This guarantees the image renders even if the public folder is rebuilt.
          const url = `/api/files/${fname}`
          // Record in db.uploads for ownership/cleanup tracking
          await db.collection('uploads').insertOne({
            id,
            url,
            filename: fname,
            originalName: file.name || '',
            mime,
            size: file.size,
            userId: auth.id,
            createdAt: new Date(),
          })
          results.push({ id, url, size: file.size, mime, originalName: file.name || '' })
        }
        return handleCORS(NextResponse.json({ uploads: results, ok: true }))
      } catch (e) {
        console.error('upload error', e)
        return handleCORS(NextResponse.json({ error: 'Upload failed: ' + (e?.message || 'unknown') }, { status: 500 }))
      }
    }

    // DELETE /api/upload/:id   removes the file (owner or admin only)
    if (route.match(/^\/upload\/[^/]+$/) && method === 'DELETE') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const rec = await db.collection('uploads').findOne({ id })
      if (!rec) return handleCORS(NextResponse.json({ ok: true })) // idempotent
      if (rec.userId !== auth.id && !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      try {
        // Try new persistent path first, then legacy /data/uploads, then legacy
        // /app/public/uploads as final fallback (covers files left behind by
        // earlier upload directory schemes).
        const candidates = [
          nodePath.join(PERSIST_UPLOAD_DIR, rec.filename),
          nodePath.join('/data', 'uploads', rec.filename),
          nodePath.join(process.cwd(), 'public', 'uploads', rec.filename),
        ]
        let unlinked = false
        for (const p of candidates) {
          try { await fs.unlink(p); unlinked = true; break } catch { /* try next */ }
        }
      } catch (e) { /* file already missing is OK */ }
      await db.collection('uploads').deleteOne({ id })
      return handleCORS(NextResponse.json({ ok: true }))
    }
    // ============================================================
    // =============== END PHOTO UPLOAD ===========================
    // ============================================================

    // ============================================================
    // ================= JOBS & HOT SPOTS API ====================
    // ============================================================
    // ---------- MARKETPLACE LISTINGS ----------
    // Item status enum (DumpMaps-specific: "On Truck", "At Site", "Last Chance", etc.).
    // Now role-aware: residents see a simpler set; contractors get truck/site/recycled;
    // property managers get pickup_scheduled/disposed; facilities get accepted/processed.
    // The enum is the UNION across all roles — the frontend filters by user role.
    const MARKETPLACE_ITEM_STATUSES = [
      'available', 'on_truck', 'at_site', 'last_chance',
      'pending_pickup', 'pickup_scheduled', 'reserved',
      'accepted', 'processed', 'disposed',
      'sold', 'claimed', 'donated', 'recycled',
    ]
    const MARKETPLACE_RESERVATION_MS = 15 * 60 * 1000 // 15 minutes

    // Strip exact address from public view. Only the seller, the current
    // reservation holder, or staff get to see street/zip/lat/lng.
    const scrubAddress = (l, viewerId, viewerRole) => {
      if (!l) return l
      const isOwner = viewerId && l.sellerId === viewerId
      const isReserver = viewerId && l.reservation && l.reservation.userId === viewerId && new Date(l.reservation.expiresAt) > new Date()
      const isStaffViewer = viewerRole && ['super_admin', 'admin', 'moderator'].includes(viewerRole)
      if (isOwner || isReserver || isStaffViewer) return l
      const out = { ...l }
      // City/state OK to expose; everything more precise gets hidden.
      delete out.location
      delete out.zip
      delete out.lat
      delete out.lng
      out.addressHidden = true
      return out
    }

    const enrichListing = async (l, viewer) => {
      if (!l) return null
      // Auto-expire stale reservations on read
      if (l.reservation && new Date(l.reservation.expiresAt) <= new Date()) {
        await db.collection('marketplace_listings').updateOne(
          { id: l.id, 'reservation.expiresAt': l.reservation.expiresAt },
          { $set: { reservation: null, itemStatus: l.itemStatus === 'reserved' ? 'available' : l.itemStatus, updatedAt: new Date() } }
        )
        l = { ...l, reservation: null, itemStatus: l.itemStatus === 'reserved' ? 'available' : l.itemStatus }
      }
      // Last Chance auto-promotion (DumpMaps-unique feature):
      //   • leavingAt within 30 minutes  → bump to last_chance
      //   • on_truck or at_site for 24h+ → bump to last_chance
      // Only auto-promotes from "soft" states (on_truck / at_site / available); never
      // overrides terminal states (reserved / sold / claimed / donated / recycled / last_chance).
      const softStatuses = ['available', 'on_truck', 'at_site']
      if (l.itemStatus && softStatuses.includes(l.itemStatus) && !l.sold) {
        const now = Date.now()
        let promoteReason = null
        if (l.leavingAt && new Date(l.leavingAt).getTime() - now <= 30 * 60 * 1000 && new Date(l.leavingAt).getTime() > now) {
          promoteReason = 'leaving_soon'
        } else if ((l.itemStatus === 'on_truck' || l.itemStatus === 'at_site') && l.createdAt && (now - new Date(l.createdAt).getTime() >= 24 * 60 * 60 * 1000)) {
          promoteReason = 'aged_out'
        }
        if (promoteReason) {
          await db.collection('marketplace_listings').updateOne(
            { id: l.id, itemStatus: l.itemStatus },
            { $set: { itemStatus: 'last_chance', lastChancePromotedAt: new Date(), lastChanceReason: promoteReason, featured: true, updatedAt: new Date() } }
          )
          l = { ...l, itemStatus: 'last_chance', lastChancePromotedAt: new Date(), lastChanceReason: promoteReason, featured: true }
          // Drop an admin/system note for the seller (in-app notification stream)
          try {
            await db.collection('notifications').insertOne({
              id: uuidv4(),
              userId: l.sellerId,
              kind: 'marketplace.last_chance',
              title: 'Your listing is now Last Chance',
              body: `"${l.title}" was auto-promoted to Last Chance (${promoteReason === 'leaving_soon' ? 'leaving within 30 min' : 'on truck/at site 24h+'}).`,
              targetType: 'marketplace_listing',
              targetId: l.id,
              read: false,
              createdAt: new Date(),
            })
          } catch (e) { /* non-blocking */ }
        }
      }
      const out = clean(scrubAddress(l, viewer?.id, viewer?.role))
      if (l.sellerId) {
        const u = await db.collection('users').findOne({ id: l.sellerId })
        if (u) {
          out.seller = {
            id: u.id,
            name: u.name || 'Seller',
            avatarUrl: u.avatarUrl || null,
            karma: u.karma || 0,
            isVerified: !!u.isVerified,
            profileTypes: u.profileTypes || [],
            primaryProfile: u.primaryProfile || u.userRole || 'resident',
          }
          // Seller badge derived from primary profile + verified flag
          const profile = (u.primaryProfile || u.userRole || 'resident').toLowerCase()
          let badge = 'Resident'
          if (profile.includes('hauler')) badge = u.isVerified ? 'Verified Hauler' : 'Hauler'
          else if (profile.includes('contractor')) badge = u.isVerified ? 'Verified Contractor' : 'Contractor'
          else if (profile.includes('facility')) badge = 'Facility'
          else if (profile.includes('nonprofit')) badge = 'Verified Nonprofit'
          else if (profile.includes('vendor')) badge = 'Vendor'
          out.seller.badge = badge
        }
      }
      const msgCount = await db.collection('marketplace_messages').countDocuments({ listingId: l.id })
      out.messageCount = msgCount
      // Convenience: minutes until "leaving"
      if (l.leavingAt) {
        const ms = new Date(l.leavingAt).getTime() - Date.now()
        out.leavingInMinutes = Math.max(0, Math.round(ms / 60000))
      }
      // Convenience: ms remaining on reservation
      if (l.reservation && new Date(l.reservation.expiresAt) > new Date()) {
        out.reservation = {
          userId: l.reservation.userId,
          startedAt: l.reservation.startedAt,
          expiresAt: l.reservation.expiresAt,
          msRemaining: Math.max(0, new Date(l.reservation.expiresAt).getTime() - Date.now()),
        }
      } else {
        out.reservation = null
      }
      return out
    }

    // POST /api/marketplace   create listing
    if (route === '/marketplace' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const body = await request.json()
      if (!body.title || !body.category) {
        return handleCORS(NextResponse.json({ error: 'Title and category required' }, { status: 400 }))
      }
      const itemStatus = MARKETPLACE_ITEM_STATUSES.includes(body.itemStatus) ? body.itemStatus : 'available'
      let leavingAt = null
      if (body.leavingAt) {
        const d = new Date(body.leavingAt)
        if (!isNaN(d.getTime()) && d.getTime() > Date.now() - 60000) leavingAt = d
      } else if (typeof body.leavingInMinutes === 'number' && body.leavingInMinutes > 0 && body.leavingInMinutes <= 720) {
        leavingAt = new Date(Date.now() + body.leavingInMinutes * 60000)
      }
      const listing = {
        id: uuidv4(),
        sellerId: auth.id,
        segment: ['residential', 'commercial'].includes(body.segment) ? body.segment : 'residential',
        kind: ['sell', 'buy', 'trade', 'free', 'request'].includes(body.kind) ? body.kind : 'sell',
        title: String(body.title).slice(0, 140),
        category: body.category,
        condition: ['new', 'like_new', 'good', 'fair', 'for_parts'].includes(body.condition) ? body.condition : 'good',
        description: String(body.description || '').slice(0, 4000),
        photos: Array.isArray(body.photos) ? body.photos.slice(0, 10) : [],
        price: typeof body.price === 'number' ? body.price : null,
        priceType: ['fixed', 'obo', 'free', 'trade', 'contact', 'donation'].includes(body.priceType) ? body.priceType : 'fixed',
        acceptsOffers: !!body.acceptsOffers,
        donationPreferred: !!body.donationPreferred,
        currency: body.currency || 'USD',
        quantity: typeof body.quantity === 'number' ? body.quantity : 1,
        dimensions: body.dimensions || '',
        location: body.location || '',
        city: body.city || '',
        state: body.state || '',
        zip: body.zip || '',
        lat: typeof body.lat === 'number' ? body.lat : null,
        lng: typeof body.lng === 'number' ? body.lng : null,
        pickupWindow: body.pickupWindow || '',
        itemStatus,
        leavingAt,
        reservation: null,
        deliveryOptions: Array.isArray(body.deliveryOptions) ? body.deliveryOptions : [],
        materialTags: Array.isArray(body.materialTags) ? body.materialTags.slice(0, 10) : [],
        contactPreference: body.contactPreference || 'in_app',
        status: 'active',
        sold: false,
        soldAt: null,
        featured: false,
        viewCount: 0,
        savedByUserIds: [],
        reportCount: 0,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('marketplace_listings').insertOne(listing)
      return handleCORS(NextResponse.json({ listing: await enrichListing(listing, auth) }))
    }

    // GET /api/marketplace   list with filters
    if (route === '/marketplace' && method === 'GET') {
      const auth = getAuth(request)
      const query = {}
      const mine = url.searchParams.get('mine') === 'true'
      const saved = url.searchParams.get('saved') === 'true'
      const reserved = url.searchParams.get('reserved') === 'true'
      const includeSold = url.searchParams.get('includeSold') === 'true'
      const includeAll = url.searchParams.get('all') === 'true' && isStaff(auth?.role)

      if (mine) {
        if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
        query.sellerId = auth.id
      } else if (saved) {
        if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
        query.savedByUserIds = auth.id
      } else if (reserved) {
        if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
        query['reservation.userId'] = auth.id
      } else if (!includeAll) {
        query.status = 'active'
        if (!includeSold) query.sold = false
      }

      const seg = url.searchParams.get('segment')
      if (seg && ['residential', 'commercial'].includes(seg)) query.segment = seg
      const cat = url.searchParams.get('category')
      if (cat) query.category = cat
      const kind = url.searchParams.get('kind')
      if (kind) query.kind = kind
      const priceType = url.searchParams.get('priceType')
      if (priceType) query.priceType = priceType
      const itemStatus = url.searchParams.get('itemStatus')
      if (itemStatus && itemStatus !== 'all') query.itemStatus = itemStatus
      const condition = url.searchParams.get('condition')
      if (condition) query.condition = condition

      let listings = await db.collection('marketplace_listings').find(query).sort({ featured: -1, createdAt: -1 }).limit(500).toArray()

      // Price filter
      const minP = parseFloat(url.searchParams.get('minPrice'))
      const maxP = parseFloat(url.searchParams.get('maxPrice'))
      if (!isNaN(minP)) listings = listings.filter((l) => l.price == null || l.price >= minP)
      if (!isNaN(maxP)) listings = listings.filter((l) => l.price == null || l.price <= maxP)

      // Text query
      const q = (url.searchParams.get('q') || '').trim().toLowerCase()
      if (q) {
        listings = listings.filter((l) =>
          l.title.toLowerCase().includes(q) ||
          (l.description || '').toLowerCase().includes(q) ||
          (l.city || '').toLowerCase().includes(q) ||
          (l.materialTags || []).some((t) => String(t).toLowerCase().includes(q)),
        )
      }

      // Distance
      const lat = parseFloat(url.searchParams.get('lat'))
      const lng = parseFloat(url.searchParams.get('lng'))
      const maxKm = parseFloat(url.searchParams.get('maxKm'))
      if (!isNaN(lat) && !isNaN(lng)) {
        listings = listings
          .map((l) => ({ ...l, distanceKm: l.lat != null && l.lng != null ? distanceKm(lat, lng, l.lat, l.lng) : null }))
          .sort((a, b) => {
            if (a.distanceKm == null) return 1
            if (b.distanceKm == null) return -1
            return a.distanceKm - b.distanceKm
          })
        if (!isNaN(maxKm)) listings = listings.filter((l) => l.distanceKm != null && l.distanceKm <= maxKm)
      }

      // Sort overrides
      const sort = (url.searchParams.get('sort') || '').toLowerCase()
      if (sort === 'newest') listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      else if (sort === 'price_asc') listings.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
      else if (sort === 'price_desc') listings.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
      else if (sort === 'leaving_soon') listings.sort((a, b) => {
        const av = a.leavingAt ? new Date(a.leavingAt).getTime() : Infinity
        const bv = b.leavingAt ? new Date(b.leavingAt).getTime() : Infinity
        return av - bv
      })

      const enriched = await Promise.all(listings.slice(0, 200).map((l) => enrichListing(l, auth)))
      return handleCORS(NextResponse.json({ listings: enriched }))
    }

    // GET /api/marketplace/:id
    if (route.match(/^\/marketplace\/[^/]+$/) && method === 'GET' && route !== '/marketplace/me' && route !== '/marketplace/saved-searches' && route !== '/marketplace/commercial' && route !== '/marketplace/inbox') {
      const auth = getAuth(request)
      const id = route.split('/')[2]
      const l = await db.collection('marketplace_listings').findOne({ id })
      if (!l) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      await db.collection('marketplace_listings').updateOne({ id }, { $inc: { viewCount: 1 } })
      return handleCORS(NextResponse.json({ listing: await enrichListing(l, auth) }))
    }

    // PATCH /api/marketplace/:id   owner edits (mark sold, change itemStatus, etc.)
    if (route.match(/^\/marketplace\/[^/]+$/) && method === 'PATCH') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const l = await db.collection('marketplace_listings').findOne({ id })
      if (!l) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (l.sellerId !== auth.id && !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const body = await request.json()
      const allowed = ['title', 'description', 'category', 'condition', 'photos', 'price', 'priceType', 'quantity', 'dimensions', 'location', 'city', 'state', 'zip', 'lat', 'lng', 'pickupWindow', 'deliveryOptions', 'materialTags', 'contactPreference', 'kind', 'segment', 'status', 'acceptsOffers', 'donationPreferred']
      const update = { updatedAt: new Date() }
      for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]
      if (body.itemStatus !== undefined && MARKETPLACE_ITEM_STATUSES.includes(body.itemStatus)) {
        // Role-aware: block status transitions the seller's role can't perform.
        if (!isStaff(auth.role)) {
          const sellerUser = await db.collection('users').findOne({ id: l.sellerId })
          if (sellerUser && !isStatusAllowed(sellerUser, body.itemStatus, l.itemStatus)) {
            const role = resolveMarketplaceRole(sellerUser)
            return handleCORS(NextResponse.json({
              error: `Status "${body.itemStatus}" is not available for ${role.label} accounts.`,
              allowedStatuses: allowedStatusesForUser(sellerUser),
              role: role.key,
            }, { status: 403 }))
          }
        }
        update.itemStatus = body.itemStatus
      }
      if (body.leavingAt !== undefined) {
        if (body.leavingAt === null || body.leavingAt === '') {
          update.leavingAt = null
        } else {
          const d = new Date(body.leavingAt)
          if (!isNaN(d.getTime())) update.leavingAt = d
        }
      } else if (typeof body.leavingInMinutes === 'number') {
        update.leavingAt = body.leavingInMinutes > 0 ? new Date(Date.now() + body.leavingInMinutes * 60000) : null
      }
      if (body.sold !== undefined) {
        update.sold = !!body.sold
        update.soldAt = body.sold ? new Date() : null
        if (body.sold) update.itemStatus = 'sold'
      }
      await db.collection('marketplace_listings').updateOne({ id }, { $set: update })
      const fresh = await db.collection('marketplace_listings').findOne({ id })
      return handleCORS(NextResponse.json({ listing: await enrichListing(fresh, auth) }))
    }

    // DELETE /api/marketplace/:id   owner or admin
    if (route.match(/^\/marketplace\/[^/]+$/) && method === 'DELETE') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const l = await db.collection('marketplace_listings').findOne({ id })
      if (!l) return handleCORS(NextResponse.json({ ok: true }))
      if (l.sellerId !== auth.id && !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      await db.collection('marketplace_listings').deleteOne({ id })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // POST /api/marketplace/:id/save   toggle save
    if (route.match(/^\/marketplace\/[^/]+\/save$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const l = await db.collection('marketplace_listings').findOne({ id })
      if (!l) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const has = (l.savedByUserIds || []).includes(auth.id)
      await db.collection('marketplace_listings').updateOne(
        { id },
        has ? { $pull: { savedByUserIds: auth.id } } : { $addToSet: { savedByUserIds: auth.id } },
      )
      return handleCORS(NextResponse.json({ saved: !has }))
    }

    // POST /api/marketplace/:id/report
    if (route.match(/^\/marketplace\/[^/]+\/report$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const body = await request.json()
      const report = {
        id: uuidv4(),
        targetType: 'marketplace_listing',
        targetId: id,
        userId: auth.id,
        reason: body.reason || 'Other',
        notes: body.notes || '',
        status: 'pending',
        createdAt: new Date(),
      }
      await db.collection('marketplace_reports').insertOne(report)
      await db.collection('marketplace_listings').updateOne({ id }, { $inc: { reportCount: 1 } })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // POST /api/marketplace/:id/reserve  — 15-minute hold for the buyer.
    // Seller cannot reserve own item. One active reservation at a time per listing.
    if (route.match(/^\/marketplace\/[^/]+\/reserve$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const l = await db.collection('marketplace_listings').findOne({ id })
      if (!l) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (l.sellerId === auth.id) return handleCORS(NextResponse.json({ error: 'You cannot reserve your own item' }, { status: 400 }))
      // B2B listings require commercial access to reserve.
      if (l.marketplaceType === 'b2b') {
        const actor = await db.collection('users').findOne({ id: auth.id })
        if (!_hasCommercialAccess(actor)) {
          return handleCORS(NextResponse.json({
            error: 'Commercial access required to reserve B2B listings.',
            applyUrl: '/marketplace?apply=1',
          }, { status: 403 }))
        }
      }
      if (l.sold || l.itemStatus === 'sold' || l.itemStatus === 'claimed' || l.itemStatus === 'donated') {
        return handleCORS(NextResponse.json({ error: 'Item no longer available' }, { status: 400 }))
      }
      // If an active reservation by another user exists, block.
      if (l.reservation && new Date(l.reservation.expiresAt) > new Date() && l.reservation.userId !== auth.id) {
        return handleCORS(NextResponse.json({ error: 'Item is reserved by someone else right now' }, { status: 409 }))
      }
      const now = new Date()
      const expiresAt = new Date(now.getTime() + MARKETPLACE_RESERVATION_MS)
      const reservation = { userId: auth.id, startedAt: now, expiresAt }
      await db.collection('marketplace_listings').updateOne(
        { id },
        { $set: { reservation, itemStatus: 'reserved', updatedAt: new Date() } }
      )
      // Auto-message the seller so they know there is a reserver
      try {
        await db.collection('marketplace_messages').insertOne({
          id: uuidv4(),
          listingId: id,
          senderId: auth.id,
          receiverId: l.sellerId,
          message: 'Reserved this item via DumpMaps (15-min hold). I will coordinate pickup shortly.',
          system: true,
          read: false,
          createdAt: new Date(),
        })
      } catch (e) { /* non-blocking */ }
      const fresh = await db.collection('marketplace_listings').findOne({ id })
      await logActivity(db, auth, 'marketplace.reserve', { kind: 'marketplace_listing', id, label: l.title }, {})
      return handleCORS(NextResponse.json({ listing: await enrichListing(fresh, auth) }))
    }

    // POST /api/marketplace/:id/reserve/cancel  — buyer or seller cancels hold
    if (route.match(/^\/marketplace\/[^/]+\/reserve\/cancel$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const l = await db.collection('marketplace_listings').findOne({ id })
      if (!l) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (!l.reservation) return handleCORS(NextResponse.json({ listing: await enrichListing(l, auth) }))
      const isReserver = l.reservation.userId === auth.id
      const isSeller = l.sellerId === auth.id
      if (!isReserver && !isSeller && !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      await db.collection('marketplace_listings').updateOne(
        { id },
        { $set: { reservation: null, itemStatus: l.sold ? 'sold' : 'available', updatedAt: new Date() } }
      )
      const fresh = await db.collection('marketplace_listings').findOne({ id })
      return handleCORS(NextResponse.json({ listing: await enrichListing(fresh, auth) }))
    }

    // POST /api/marketplace/:id/reserve/complete  — seller marks pickup completed
    if (route.match(/^\/marketplace\/[^/]+\/reserve\/complete$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const l = await db.collection('marketplace_listings').findOne({ id })
      if (!l) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (l.sellerId !== auth.id && !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Only the seller can complete a pickup' }, { status: 403 }))
      }
      const body = await request.json().catch(() => ({}))
      const finalStatus = ['claimed', 'sold', 'donated', 'recycled'].includes(body.finalStatus) ? body.finalStatus : 'claimed'
      await db.collection('marketplace_listings').updateOne(
        { id },
        { $set: {
          reservation: null,
          itemStatus: finalStatus,
          sold: finalStatus === 'sold',
          soldAt: finalStatus === 'sold' ? new Date() : (l.soldAt || null),
          updatedAt: new Date(),
        } }
      )
      const fresh = await db.collection('marketplace_listings').findOne({ id })
      return handleCORS(NextResponse.json({ listing: await enrichListing(fresh, auth) }))
    }

    // POST /api/marketplace/:id/quick-status  — seller one-tap status change.
    // Mobile-friendly: lets a hauler switch On Truck → At Site → Last Chance →
    // Claimed / Sold / Donated / Recycled with a single call.
    if (route.match(/^\/marketplace\/[^/]+\/quick-status$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const l = await db.collection('marketplace_listings').findOne({ id })
      if (!l) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (l.sellerId !== auth.id && !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const body = await request.json().catch(() => ({}))
      const next = body.itemStatus
      const allowedStatuses = [
        'available', 'on_truck', 'at_site', 'last_chance', 'pending_pickup',
        'pickup_scheduled', 'reserved', 'accepted', 'processed', 'disposed',
        'claimed', 'sold', 'donated', 'recycled',
      ]
      if (!allowedStatuses.includes(next)) {
        return handleCORS(NextResponse.json({ error: 'Invalid status' }, { status: 400 }))
      }
      // Role-aware restriction: only block NEW transitions that don't match
      // the seller's role. The existing status is always allowed (so listings
      // created under an old/different role can still be edited away from it).
      // Admin/moderator staff bypass this check.
      if (!isStaff(auth.role)) {
        const sellerUser = await db.collection('users').findOne({ id: l.sellerId })
        if (sellerUser && !isStatusAllowed(sellerUser, next, l.itemStatus)) {
          const role = resolveMarketplaceRole(sellerUser)
          return handleCORS(NextResponse.json({
            error: `Status "${next}" is not available for ${role.label} accounts.`,
            allowedStatuses: allowedStatusesForUser(sellerUser),
            role: role.key,
          }, { status: 403 }))
        }
      }
      const update = { itemStatus: next, updatedAt: new Date() }
      if (next === 'last_chance') {
        update.featured = true
        update.lastChancePromotedAt = new Date()
        update.lastChanceReason = 'manual'
      }
      if (next === 'sold') {
        update.sold = true
        update.soldAt = new Date()
      }
      // Terminal statuses: clear active hold and stamp completedAt.
      if (['claimed', 'sold', 'donated', 'recycled', 'disposed', 'processed'].includes(next)) {
        update.reservation = null
        update.completedAt = new Date()
      }
      await db.collection('marketplace_listings').updateOne({ id }, { $set: update })
      const fresh = await db.collection('marketplace_listings').findOne({ id })
      await logActivity(db, auth, `marketplace.quick_status.${next}`, { kind: 'marketplace_listing', id, label: l.title }, {})
      return handleCORS(NextResponse.json({ listing: await enrichListing(fresh, auth) }))
    }

    // GET /api/marketplace/me  — Buyer/Seller dashboard data in one call.
    if (route === '/marketplace/me' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const [
        saved, reserved, claimedAsBuyer, myListings, savedSearches,
      ] = await Promise.all([
        db.collection('marketplace_listings').find({ savedByUserIds: auth.id, status: 'active' }).sort({ createdAt: -1 }).limit(120).toArray(),
        db.collection('marketplace_listings').find({ 'reservation.userId': auth.id }).sort({ 'reservation.expiresAt': -1 }).limit(60).toArray(),
        db.collection('marketplace_listings').find({ completedByBuyer: auth.id }).sort({ completedAt: -1 }).limit(60).toArray(),
        db.collection('marketplace_listings').find({ sellerId: auth.id }).sort({ createdAt: -1 }).limit(200).toArray(),
        db.collection('marketplace_saved_searches').find({ userId: auth.id }).sort({ createdAt: -1 }).limit(50).toArray().catch(() => []),
      ])
      // unread inbox count for marketplace messages
      let unreadCount = 0
      try {
        unreadCount = await db.collection('marketplace_messages').countDocuments({ receiverId: auth.id, read: false })
      } catch {}
      // Active alerts = total saved-search hits since last viewed (lightweight)
      let nearbyAlerts = 0
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
        nearbyAlerts = await db.collection('marketplace_listings').countDocuments({ createdAt: { $gte: since }, status: 'active', sold: false })
      } catch {}

      // Items Diverted from buyer perspective = claimed/donated/recycled they got
      const valueRecovered = claimedAsBuyer.reduce((s, l) => s + (Number(l.price) || 0), 0)

      const [sEnriched, rEnriched, cEnriched] = await Promise.all([
        Promise.all(saved.map((l) => enrichListing(l, auth))),
        Promise.all(reserved.map((l) => enrichListing(l, auth))),
        Promise.all(claimedAsBuyer.map((l) => enrichListing(l, auth))),
      ])
      // Build favorite categories list from saved + reserved + claimed
      const catCount = {}
      for (const l of [...saved, ...reserved, ...claimedAsBuyer]) {
        if (l.category) catCount[l.category] = (catCount[l.category] || 0) + 1
      }
      const favoriteCategories = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }))

      return handleCORS(NextResponse.json({
        metrics: {
          itemsSaved: saved.length,
          itemsReserved: reserved.filter((l) => l.reservation && new Date(l.reservation.expiresAt) > new Date()).length,
          itemsClaimed: claimedAsBuyer.length,
          valueRecovered,
          listingsViewed: myListings.reduce((s, l) => s + (l.viewCount || 0), 0),
          unreadMessages: unreadCount,
          nearbyAlerts,
        },
        saved: sEnriched,
        reserved: rEnriched,
        claimed: cEnriched,
        favoriteCategories,
        savedSearches: savedSearches.map(clean),
      }))
    }

    // ============ SAVED SEARCHES =================
    // GET /api/marketplace/saved-searches
    if (route === '/marketplace/saved-searches' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const rows = await db.collection('marketplace_saved_searches').find({ userId: auth.id }).sort({ createdAt: -1 }).toArray()
      return handleCORS(NextResponse.json({ savedSearches: rows.map(clean) }))
    }
    // POST /api/marketplace/saved-searches
    if (route === '/marketplace/saved-searches' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const body = await request.json()
      const doc = {
        id: uuidv4(),
        userId: auth.id,
        name: String(body.name || 'Untitled search').slice(0, 80),
        category: body.category || '',
        city: body.city || '',
        keyword: body.keyword || '',
        maxKm: typeof body.maxKm === 'number' ? body.maxKm : null,
        priceType: body.priceType || '',
        freeOnly: !!body.freeOnly,
        donationOnly: !!body.donationOnly,
        enabled: body.enabled !== false,
        lastNotifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('marketplace_saved_searches').insertOne(doc)
      return handleCORS(NextResponse.json({ savedSearch: clean(doc) }))
    }
    // PATCH /api/marketplace/saved-searches/:id  (toggle enabled, rename, update filters)
    if (route.match(/^\/marketplace\/saved-searches\/[^/]+$/) && method === 'PATCH') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[3]
      const existing = await db.collection('marketplace_saved_searches').findOne({ id, userId: auth.id })
      if (!existing) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json()
      const allowed = ['name', 'category', 'city', 'keyword', 'maxKm', 'priceType', 'freeOnly', 'donationOnly', 'enabled']
      const update = { updatedAt: new Date() }
      for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]
      await db.collection('marketplace_saved_searches').updateOne({ id }, { $set: update })
      const fresh = await db.collection('marketplace_saved_searches').findOne({ id })
      return handleCORS(NextResponse.json({ savedSearch: clean(fresh) }))
    }
    // DELETE /api/marketplace/saved-searches/:id
    if (route.match(/^\/marketplace\/saved-searches\/[^/]+$/) && method === 'DELETE') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[3]
      await db.collection('marketplace_saved_searches').deleteOne({ id, userId: auth.id })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // GET /api/marketplace/saved-searches/:id/preview  — preview matching listings
    if (route.match(/^\/marketplace\/saved-searches\/[^/]+\/preview$/) && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[3]
      const s = await db.collection('marketplace_saved_searches').findOne({ id, userId: auth.id })
      if (!s) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const query = { status: 'active', sold: false }
      if (s.category) query.category = s.category
      if (s.priceType) query.priceType = s.priceType
      if (s.freeOnly) query.priceType = 'free'
      if (s.donationOnly) query.priceType = 'donation'
      if (s.city) query.city = new RegExp(s.city.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i')
      let listings = await db.collection('marketplace_listings').find(query).sort({ createdAt: -1 }).limit(60).toArray()
      if (s.keyword) {
        const kw = s.keyword.toLowerCase()
        listings = listings.filter((l) =>
          l.title.toLowerCase().includes(kw) ||
          (l.description || '').toLowerCase().includes(kw) ||
          (l.materialTags || []).some((t) => String(t).toLowerCase().includes(kw))
        )
      }
      const enriched = await Promise.all(listings.slice(0, 24).map((l) => enrichListing(l, auth)))
      return handleCORS(NextResponse.json({ savedSearch: clean(s), matches: enriched }))
    }

    // GET /api/admin/marketplace/reports  — moderation queue
    if (route === '/admin/marketplace/reports' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const statusFilter = url.searchParams.get('status') || 'pending'
      const q = { targetType: 'marketplace_listing' }
      if (statusFilter !== 'all') q.status = statusFilter
      const reports = await db.collection('marketplace_reports').find(q).sort({ createdAt: -1 }).limit(200).toArray()
      // Hydrate with listing + reporter
      const out = []
      for (const r of reports) {
        const listing = await db.collection('marketplace_listings').findOne({ id: r.targetId })
        const reporter = r.userId ? await db.collection('users').findOne({ id: r.userId }) : null
        out.push({
          ...clean(r),
          listing: listing ? { id: listing.id, title: listing.title, sellerId: listing.sellerId, photos: listing.photos, itemStatus: listing.itemStatus, status: listing.status } : null,
          reporter: reporter ? { id: reporter.id, name: reporter.name, email: reporter.email } : null,
        })
      }
      return handleCORS(NextResponse.json({ reports: out }))
    }

    // PATCH /api/admin/marketplace/reports/:id  — resolve / dismiss / take action
    if (route.match(/^\/admin\/marketplace\/reports\/[^/]+$/) && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[4]
      const body = await request.json()
      const upd = {
        status: body.status || 'resolved', // resolved | dismissed | escalated
        moderatorNote: body.moderatorNote || '',
        resolvedBy: guard.user.id,
        resolvedAt: new Date(),
      }
      await db.collection('marketplace_reports').updateOne({ id }, { $set: upd })
      const fresh = await db.collection('marketplace_reports').findOne({ id })
      return handleCORS(NextResponse.json({ report: clean(fresh) }))
    }

    // GET /api/admin/marketplace/seller/:userId  — seller activity history
    if (route.match(/^\/admin\/marketplace\/seller\/[^/]+$/) && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const userId = route.split('/')[4]
      const [u, listings, reports] = await Promise.all([
        db.collection('users').findOne({ id: userId }),
        db.collection('marketplace_listings').find({ sellerId: userId }).sort({ createdAt: -1 }).limit(200).toArray(),
        db.collection('marketplace_reports').find({ targetType: 'marketplace_listing' }).limit(500).toArray(),
      ])
      const listingIds = new Set(listings.map((l) => l.id))
      const sellerReports = reports.filter((r) => listingIds.has(r.targetId))
      return handleCORS(NextResponse.json({
        user: u ? { id: u.id, name: u.name, email: u.email, isVerified: !!u.isVerified, isSuspended: !!u.isSuspended, isBanned: !!u.isBanned, createdAt: u.createdAt } : null,
        listings: listings.map(clean),
        reports: sellerReports.map(clean),
        stats: {
          total: listings.length,
          active: listings.filter((l) => l.status === 'active' && !l.sold).length,
          sold: listings.filter((l) => l.sold).length,
          flagged: listings.filter((l) => (l.reportCount || 0) > 0).length,
          totalReports: sellerReports.length,
        },
      }))
    }

    // POST /api/admin/marketplace/seed-samples  — seed the 10 sample listings (idempotent)
    if (route === '/admin/marketplace/seed-samples' && method === 'POST') {
      const guard = await requireStaff(request, db, 'admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      // Stock photos for each seed (Unsplash, free use)
      const SAMPLE_PHOTOS = {
        'Brown Leather Sofa':         'https://images.unsplash.com/photo-1691480152351-4b3f2c89ccff?crop=entropy&cs=srgb&fm=jpg&q=85',
        'Commercial Refrigerator':    'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?crop=entropy&cs=srgb&fm=jpg&q=85',
        'Wood Dining Table Set':      'https://images.unsplash.com/photo-1604578762246-41134e37f9cc?crop=entropy&cs=srgb&fm=jpg&q=85',
        'Metal Filing Cabinets (4)':  'https://images.unsplash.com/photo-1569235186275-626cb53b83ce?crop=entropy&cs=srgb&fm=jpg&q=85',
        'Reclaimed Wood Bundle':      'https://images.unsplash.com/photo-1422246654994-34520d5a0340?crop=entropy&cs=srgb&fm=jpg&q=85',
        'Office Chairs (10)':         'https://images.unsplash.com/photo-1594235048794-fae8583a5af5?crop=entropy&cs=srgb&fm=jpg&q=85',
        'Washer & Dryer Set':         'https://images.unsplash.com/photo-1604335398980-ededcadcc37d?crop=entropy&cs=srgb&fm=jpg&q=85',
        'Vintage Arcade Machine':     'https://images.unsplash.com/photo-1572289758057-3e0f4327833b?crop=entropy&cs=srgb&fm=jpg&q=85',
        'Copper Pipe Bundle':         'https://images.unsplash.com/photo-1694827893591-af9b80361599?crop=entropy&cs=srgb&fm=jpg&q=85',
        'Store Fixtures / Shelving':  'https://images.unsplash.com/photo-1631856956334-35db20cb7748?crop=entropy&cs=srgb&fm=jpg&q=85',
      }
      const SAMPLE = [
        { title: 'Brown Leather Sofa',           priceType: 'free',  price: 0,   itemStatus: 'on_truck',       category: 'Furniture',              condition: 'good',     description: 'Great condition brown leather sofa. Smoke free home. Available for pickup today.', city: 'Hayward', state: 'CA', lat: 37.6688, lng: -122.0808, dimensions: '86" W x 34" D x 32" H' },
        { title: 'Commercial Refrigerator',      priceType: 'fixed', price: 450, itemStatus: 'at_site',         category: 'Appliances',             condition: 'good',     description: 'True 2-door commercial fridge, runs cold, includes shelves.', city: 'San Jose', state: 'CA', lat: 37.3382, lng: -121.8863, segment: 'commercial' },
        { title: 'Wood Dining Table Set',        priceType: 'free',  price: 0,   itemStatus: 'last_chance',     leavingInMinutes: 30, category: 'Furniture', condition: 'good', description: 'Solid wood table + 6 chairs. Leaving the job site in 30 min — first come.', city: 'Oakland', state: 'CA', lat: 37.8044, lng: -122.2712 },
        { title: 'Metal Filing Cabinets (4)',    priceType: 'fixed', price: 120, itemStatus: 'on_truck',         category: 'Office Furniture',       condition: 'good',     description: 'Four 4-drawer steel cabinets from an office cleanout. Locks + keys included.', city: 'Fremont', state: 'CA', lat: 37.5485, lng: -121.9886, segment: 'commercial' },
        { title: 'Reclaimed Wood Bundle',        priceType: 'free',  price: 0,   itemStatus: 'at_site',          category: 'Construction Materials', condition: 'good',     description: 'Salvaged 2x4 + 2x6 boards. Pulled nails. Pickup at jobsite in Burlingame.', city: 'Burlingame', state: 'CA', lat: 37.5841, lng: -122.3661 },
        { title: 'Office Chairs (10)',           priceType: 'donation', price: 0, itemStatus: 'available',       category: 'Office Furniture',       condition: 'good',     description: 'Set of 10 black mesh office chairs. Donation preferred — nonprofits move to front of line.', donationPreferred: true, city: 'Redwood City', state: 'CA', lat: 37.4852, lng: -122.2364, segment: 'commercial' },
        { title: 'Washer & Dryer Set',           priceType: 'fixed', price: 200, itemStatus: 'at_site',          category: 'Appliances',             condition: 'good',     description: 'GE matching set, both work, pickup from garage. Help loading available.', city: 'San Mateo', state: 'CA', lat: 37.5630, lng: -122.3255 },
        { title: 'Vintage Arcade Machine',       priceType: 'fixed', price: 350, itemStatus: 'last_chance',      leavingInMinutes: 60, category: 'Collectibles', condition: 'fair', description: 'Working vintage arcade — Galaga board. Heavy. Last chance before landfill.', city: 'Sunnyvale', state: 'CA', lat: 37.3688, lng: -122.0363 },
        { title: 'Copper Pipe Bundle',           priceType: 'obo',   price: 0,   itemStatus: 'on_truck',         acceptsOffers: true, category: 'Scrap Metal', condition: 'for_parts', description: 'Type-L copper, mixed lengths. Free or make offer — going to scrapyard otherwise.', city: 'San Leandro', state: 'CA', lat: 37.7249, lng: -122.1561 },
        { title: 'Store Fixtures / Shelving',    priceType: 'fixed', price: 300, itemStatus: 'available',         category: 'Fixtures',               condition: 'good',     description: 'Retail fixtures + gridwall + shelves from a store closure.', city: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194, segment: 'commercial' },
      ]
      // Find a system seller (super admin) so seeds attach to a real account.
      const systemSeller = await db.collection('users').findOne({ role: 'super_admin' }) || await db.collection('users').findOne({})
      let created = 0, skipped = 0
      for (const s of SAMPLE) {
        const existing = await db.collection('marketplace_listings').findOne({ title: s.title, sellerId: systemSeller.id })
        if (existing) { skipped++; continue }
        const listing = {
          id: uuidv4(),
          sellerId: systemSeller.id,
          segment: s.segment || 'residential',
          kind: s.priceType === 'free' || s.priceType === 'donation' ? 'free' : 'sell',
          title: s.title,
          category: s.category,
          condition: s.condition,
          description: s.description,
          photos: SAMPLE_PHOTOS[s.title] ? [SAMPLE_PHOTOS[s.title]] : [],
          price: s.priceType === 'fixed' || s.priceType === 'obo' ? s.price : null,
          priceType: s.priceType,
          acceptsOffers: !!s.acceptsOffers,
          donationPreferred: !!s.donationPreferred,
          currency: 'USD',
          quantity: 1,
          dimensions: s.dimensions || '',
          location: '',
          city: s.city, state: s.state, zip: '',
          lat: s.lat, lng: s.lng,
          pickupWindow: 'Pickup window: today',
          itemStatus: s.itemStatus,
          leavingAt: s.leavingInMinutes ? new Date(Date.now() + s.leavingInMinutes * 60000) : null,
          reservation: null,
          deliveryOptions: ['pickup'],
          materialTags: [],
          contactPreference: 'in_app',
          status: 'active',
          sold: false,
          soldAt: null,
          featured: s.itemStatus === 'last_chance',
          viewCount: 0,
          savedByUserIds: [],
          reportCount: 0,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 6) * 3600000), // staggered hours
          updatedAt: new Date(),
        }
        await db.collection('marketplace_listings').insertOne(listing)
        created++
      }
      return handleCORS(NextResponse.json({ ok: true, created, skipped, total: SAMPLE.length }))
    }

    // GET / POST /api/marketplace/:id/messages
    if (route.match(/^\/marketplace\/[^/]+\/messages$/) && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const l = await db.collection('marketplace_listings').findOne({ id })
      if (!l) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      // Buyer can see only their own thread; seller sees all
      let q = { listingId: id }
      if (l.sellerId !== auth.id && !isStaff(auth.role)) {
        q.$or = [{ senderId: auth.id }, { receiverId: auth.id }]
      }
      const msgs = await db.collection('marketplace_messages').find(q).sort({ createdAt: 1 }).limit(500).toArray()
      await db.collection('marketplace_messages').updateMany(
        { listingId: id, receiverId: auth.id, read: false },
        { $set: { read: true } },
      )
      return handleCORS(NextResponse.json({ messages: msgs.map(clean) }))
    }
    if (route.match(/^\/marketplace\/[^/]+\/messages$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const l = await db.collection('marketplace_listings').findOne({ id })
      if (!l) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      // B2B listings require commercial access to message the seller.
      // (Sellers can always reply to incoming threads on their own listing.)
      if (l.marketplaceType === 'b2b' && l.sellerId !== auth.id) {
        const actor = await db.collection('users').findOne({ id: auth.id })
        if (!_hasCommercialAccess(actor)) {
          return handleCORS(NextResponse.json({
            error: 'Commercial access required to message B2B sellers.',
            applyUrl: '/marketplace?apply=1',
          }, { status: 403 }))
        }
      }
      const body = await request.json()
      const text = String(body.message || '').trim()
      if (!text) return handleCORS(NextResponse.json({ error: 'Message required' }, { status: 400 }))
      const isSeller = l.sellerId === auth.id
      // If buyer messaging seller for first time, receiver=seller. If seller replying, receiver=otherPartyId if provided.
      let receiverId = isSeller ? body.toUserId : l.sellerId
      if (!receiverId) {
        return handleCORS(NextResponse.json({ error: 'No recipient' }, { status: 400 }))
      }
      const msg = {
        id: uuidv4(),
        listingId: id,
        senderId: auth.id,
        receiverId,
        message: text,
        photos: Array.isArray(body.photos) ? body.photos.slice(0, 4) : [],
        read: false,
        createdAt: new Date(),
      }
      await db.collection('marketplace_messages').insertOne(msg)
      return handleCORS(NextResponse.json({ message: clean(msg) }))
    }

    // GET /api/marketplace/inbox/threads  (unique listings the user has messages on)
    if (route === '/marketplace/inbox/threads' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const msgs = await db.collection('marketplace_messages')
        .find({ $or: [{ senderId: auth.id }, { receiverId: auth.id }] })
        .sort({ createdAt: -1 })
        .limit(500)
        .toArray()
      const seen = new Set()
      const threads = []
      for (const m of msgs) {
        const otherUserId = m.senderId === auth.id ? m.receiverId : m.senderId
        const key = `${m.listingId}:${otherUserId}`
        if (seen.has(key)) continue
        seen.add(key)
        const l = await db.collection('marketplace_listings').findOne({ id: m.listingId })
        if (!l) continue
        const other = await db.collection('users').findOne({ id: otherUserId })
        const unread = await db.collection('marketplace_messages').countDocuments({ listingId: m.listingId, receiverId: auth.id, senderId: otherUserId, read: false })
        threads.push({
          listingId: l.id,
          listingTitle: l.title,
          listingPhoto: l.photos?.[0] || null,
          otherUserId,
          otherUserName: other?.name || 'User',
          otherUserAvatar: other?.avatarUrl || null,
          lastMessage: m.message,
          lastMessageAt: m.createdAt,
          unread,
          isSeller: l.sellerId === auth.id,
        })
      }
      // also include jobs threads (poster<->contractor) so the inbox is one place
      const jobMsgs = await db.collection('job_messages')
        .find({ $or: [{ senderId: auth.id }, { receiverId: auth.id }] })
        .sort({ createdAt: -1 }).limit(500).toArray()
      const seenJ = new Set()
      const jobThreads = []
      for (const m of jobMsgs) {
        const otherUserId = m.senderId === auth.id ? m.receiverId : m.senderId
        const key = `${m.jobId}:${otherUserId}`
        if (seenJ.has(key)) continue
        seenJ.add(key)
        const job = await db.collection('jobs').findOne({ id: m.jobId })
        if (!job) continue
        const other = await db.collection('users').findOne({ id: otherUserId })
        const unread = await db.collection('job_messages').countDocuments({ jobId: m.jobId, receiverId: auth.id, senderId: otherUserId, read: false })
        jobThreads.push({
          jobId: job.id,
          listingTitle: job.title,
          listingPhoto: job.photos?.[0] || null,
          otherUserId,
          otherUserName: other?.name || 'User',
          otherUserAvatar: other?.avatarUrl || null,
          lastMessage: m.message,
          lastMessageAt: m.createdAt,
          unread,
        })
      }
      const totalUnread = threads.reduce((s, t) => s + t.unread, 0) + jobThreads.reduce((s, t) => s + t.unread, 0)
      return handleCORS(NextResponse.json({ marketplaceThreads: threads, jobThreads, totalUnread }))
    }

    // GET /api/admin/marketplace   admin moderation
    if (route === '/admin/marketplace' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const listings = await db.collection('marketplace_listings').find({}).sort({ createdAt: -1 }).limit(500).toArray()
      const reports = await db.collection('marketplace_reports').find({}).sort({ createdAt: -1 }).limit(500).toArray()
      const enriched = await Promise.all(listings.map((l) => enrichListing(l)))
      return handleCORS(NextResponse.json({ listings: enriched, reports: reports.map(clean) }))
    }
    if (route.match(/^\/admin\/marketplace\/[^/]+$/) && method === 'PATCH') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const id = route.split('/')[3]
      const body = await request.json()
      const update = { updatedAt: new Date() }
      if (body.status) update.status = body.status
      if (body.featured !== undefined) update.featured = !!body.featured
      await db.collection('marketplace_listings').updateOne({ id }, { $set: update })
      const fresh = await db.collection('marketplace_listings').findOne({ id })
      return handleCORS(NextResponse.json({ listing: await enrichListing(fresh) }))
    }
    // ---------- END MARKETPLACE ----------

    // ============================================================
    // ====== PR-2b feature modules (extracted to ./handlers/*) ====
    // ============================================================
    // MOVED HERE to run BEFORE old Jobs API so Sprint A workItems handler
    // can claim /jobs, /bounties, /volunteer-events, /work-orders routes
    {
      const handlerCtx = {
        route, method, request, db,
        getAuth, isStaff, requireStaff, clean, logActivity,
        uuidv4, NextResponse, handleCORS,
        getStripeConfig,
      }
      const pr2bResp = await dispatchPr2b(handlerCtx)
      if (pr2bResp) return pr2bResp
    }

    // ============================================================
    // ================= JOBS & HOT SPOTS API ====================
    // ============================================================
    // Helper: enrich a job with poster + contractor + counts
    const enrichJob = async (job) => {
      if (!job) return null
      const out = clean(job)
      if (job.postedByUserId) {
        const u = await db.collection('users').findOne({ id: job.postedByUserId })
        if (u) {
          out.poster = {
            id: u.id,
            name: u.name || 'Customer',
            isVerified: !!u.isVerified,
            isPaidAccount: !!u.isPaidAccount,
            accountType: u.accountType || 'resident',
          }
        }
      }
      if (job.acceptedByUserId) {
        const u = await db.collection('users').findOne({ id: job.acceptedByUserId })
        if (u) {
          out.contractor = {
            id: u.id,
            name: u.name || 'Contractor',
            primaryProfile: u.primaryProfile,
            karma: u.karma || 0,
          }
        }
      }
      const msgCount = await db.collection('job_messages').countDocuments({ jobId: job.id })
      out.messageCount = msgCount
      return out
    }

    // ---------- CREATE JOB ----------
    if (route === '/jobs' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const body = await request.json()
      if (!body.title || !body.category) {
        return handleCORS(NextResponse.json({ error: 'Title and category are required' }, { status: 400 }))
      }
      const user = await db.collection('users').findOne({ id: auth.id })
      const isVerifiedPoster = !!(user?.isVerified || user?.isPaidAccount || user?.verifiedPosting || isStaff(auth.role))
      const job = {
        id: uuidv4(),
        postedByUserId: auth.id,
        title: String(body.title).slice(0, 140),
        category: body.category,
        residentialOrCommercial: body.residentialOrCommercial || 'residential',
        address: body.address || '',
        city: body.city || '',
        state: body.state || '',
        zip: body.zip || '',
        lat: typeof body.lat === 'number' ? body.lat : null,
        lng: typeof body.lng === 'number' ? body.lng : null,
        description: String(body.description || '').slice(0, 4000),
        photos: Array.isArray(body.photos) ? body.photos.slice(0, 8) : [],
        loadSize: body.loadSize || 'medium',
        materialTypes: Array.isArray(body.materialTypes) ? body.materialTypes.slice(0, 12) : [],
        accessNotes: body.accessNotes || '',
        parkingNotes: body.parkingNotes || '',
        preferredPickupTime: body.preferredPickupTime || '',
        urgency: ['flexible', 'today', 'asap', 'scheduled'].includes(body.urgency) ? body.urgency : 'flexible',
        budgetRange: body.budgetRange || '',
        fixedPriceOffer: typeof body.fixedPriceOffer === 'number' ? body.fixedPriceOffer : null,
        contactPreference: body.contactPreference || 'in_app',
        specialInstructions: body.specialInstructions || '',
        status: body.status === 'draft' ? 'draft' : (isVerifiedPoster ? 'open' : 'pending_verification'),
        acceptedByUserId: null,
        isPilot: !isVerifiedPoster,
        viewCount: 0,
        savedByUserIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('jobs').insertOne(job)
      const enriched = await enrichJob(job)
      return handleCORS(NextResponse.json({ job: enriched, verifiedPoster: isVerifiedPoster }))
    }

    // ---------- LIST JOBS (with filters) ----------
    if (route === '/jobs' && method === 'GET') {
      const auth = getAuth(request)
      const query = {}
      // Visibility: by default only show publicly listed statuses, unless `mine` or `accepted`
      const mine = url.searchParams.get('mine') === 'true'
      const accepted = url.searchParams.get('accepted') === 'true'
      const saved = url.searchParams.get('saved') === 'true'
      const includeAll = url.searchParams.get('all') === 'true' && isStaff(auth?.role)

      if (mine) {
        if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
        query.postedByUserId = auth.id
      } else if (accepted) {
        if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
        query.acceptedByUserId = auth.id
      } else if (saved) {
        if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
        query.savedByUserIds = auth.id
      } else if (!includeAll) {
        query.status = { $in: ['open', 'accepted', 'in_progress'] }
      }

      const cat = url.searchParams.get('category')
      if (cat) query.category = cat
      const urg = url.searchParams.get('urgency')
      if (urg) query.urgency = urg
      const status = url.searchParams.get('status')
      if (status) query.status = status
      const hot = url.searchParams.get('hotSpot') === 'true'
      if (hot) query.urgency = 'asap'

      let jobs = await db.collection('jobs').find(query).sort({ createdAt: -1 }).limit(500).toArray()

      // Distance filter
      const lat = parseFloat(url.searchParams.get('lat'))
      const lng = parseFloat(url.searchParams.get('lng'))
      const maxKm = parseFloat(url.searchParams.get('maxKm'))
      if (!isNaN(lat) && !isNaN(lng)) {
        jobs = jobs
          .map((j) => ({ ...j, distanceKm: j.lat != null && j.lng != null ? distanceKm(lat, lng, j.lat, j.lng) : null }))
          .sort((a, b) => {
            if (a.distanceKm == null) return 1
            if (b.distanceKm == null) return -1
            return a.distanceKm - b.distanceKm
          })
        if (!isNaN(maxKm)) jobs = jobs.filter((j) => j.distanceKm != null && j.distanceKm <= maxKm)
      }

      // Budget filter (very rough: parses min from budgetRange string)
      const minBudget = parseFloat(url.searchParams.get('minBudget'))
      if (!isNaN(minBudget)) {
        jobs = jobs.filter((j) => {
          if (j.fixedPriceOffer != null) return j.fixedPriceOffer >= minBudget
          const m = String(j.budgetRange || '').match(/\d+/g)
          if (!m) return true
          return parseFloat(m[m.length - 1]) >= minBudget
        })
      }

      const enriched = await Promise.all(jobs.slice(0, 200).map((j) => enrichJob(j)))
      return handleCORS(NextResponse.json({ jobs: enriched }))
    }

    // ---------- JOB DETAIL ----------
    if (route.match(/^\/jobs\/[^/]+$/) && method === 'GET') {
      const id = route.split('/')[2]
      const job = await db.collection('jobs').findOne({ id })
      if (!job) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      await db.collection('jobs').updateOne({ id }, { $inc: { viewCount: 1 } })
      const enriched = await enrichJob(job)
      const updates = await db
        .collection('job_status_updates')
        .find({ jobId: id })
        .sort({ createdAt: 1 })
        .limit(100)
        .toArray()
      enriched.statusHistory = updates.map(clean)
      return handleCORS(NextResponse.json({ job: enriched }))
    }

    // ---------- UPDATE JOB (poster only, when status open/draft) ----------
    if (route.match(/^\/jobs\/[^/]+$/) && method === 'PATCH') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const job = await db.collection('jobs').findOne({ id })
      if (!job) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (job.postedByUserId !== auth.id && !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      if (!['draft', 'open', 'pending_verification'].includes(job.status) && !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Cannot edit accepted job' }, { status: 400 }))
      }
      const body = await request.json()
      const allowed = [
        'title', 'category', 'residentialOrCommercial', 'address', 'city', 'state', 'zip', 'lat', 'lng',
        'description', 'photos', 'loadSize', 'materialTypes', 'accessNotes', 'parkingNotes',
        'preferredPickupTime', 'urgency', 'budgetRange', 'fixedPriceOffer', 'contactPreference',
        'specialInstructions', 'status',
      ]
      const update = { updatedAt: new Date() }
      for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]
      await db.collection('jobs').updateOne({ id }, { $set: update })
      const fresh = await db.collection('jobs').findOne({ id })
      return handleCORS(NextResponse.json({ job: await enrichJob(fresh) }))
    }

    // ---------- ACCEPT JOB ----------
    if (route.match(/^\/jobs\/[^/]+\/accept$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const job = await db.collection('jobs').findOne({ id })
      if (!job) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (job.status !== 'open') {
        return handleCORS(NextResponse.json({ error: 'Job is not open' }, { status: 400 }))
      }
      if (job.postedByUserId === auth.id) {
        return handleCORS(NextResponse.json({ error: "Can't accept your own job" }, { status: 400 }))
      }
      await db.collection('jobs').updateOne(
        { id },
        { $set: { status: 'accepted', acceptedByUserId: auth.id, acceptedAt: new Date(), updatedAt: new Date() } },
      )
      await db.collection('job_status_updates').insertOne({
        id: uuidv4(),
        jobId: id,
        userId: auth.id,
        status: 'accepted',
        message: 'Contractor accepted the job',
        photos: [],
        createdAt: new Date(),
      })
      const fresh = await db.collection('jobs').findOne({ id })
      return handleCORS(NextResponse.json({ job: await enrichJob(fresh) }))
    }

    // ---------- POST STATUS UPDATE ----------
    if (route.match(/^\/jobs\/[^/]+\/status$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const job = await db.collection('jobs').findOne({ id })
      if (!job) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json()
      const status = body.status
      const allowedStatuses = [
        'draft', 'open', 'pending_verification', 'accepted',
        'on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled', 'disputed',
      ]
      if (!allowedStatuses.includes(status)) {
        return handleCORS(NextResponse.json({ error: 'Invalid status' }, { status: 400 }))
      }
      const isPoster = job.postedByUserId === auth.id
      const isContractor = job.acceptedByUserId === auth.id
      const isAdmin = isStaff(auth.role)
      if (!isPoster && !isContractor && !isAdmin) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      // Contractor-only transitions
      const contractorOnly = ['on_the_way', 'arrived', 'in_progress', 'completed']
      if (contractorOnly.includes(status) && !isContractor && !isAdmin) {
        return handleCORS(NextResponse.json({ error: 'Only the contractor can do this' }, { status: 403 }))
      }
      // Poster-only transitions
      const posterOnly = ['cancelled', 'disputed']
      if (posterOnly.includes(status) && !isPoster && !isAdmin) {
        return handleCORS(NextResponse.json({ error: 'Only the poster can do this' }, { status: 403 }))
      }
      await db.collection('jobs').updateOne({ id }, { $set: { status, updatedAt: new Date() } })
      await db.collection('job_status_updates').insertOne({
        id: uuidv4(),
        jobId: id,
        userId: auth.id,
        status,
        message: body.message || '',
        photos: Array.isArray(body.photos) ? body.photos.slice(0, 6) : [],
        createdAt: new Date(),
      })
      const fresh = await db.collection('jobs').findOne({ id })
      return handleCORS(NextResponse.json({ job: await enrichJob(fresh) }))
    }

    // ---------- TOGGLE SAVE JOB (contractor's saved list) ----------
    if (route.match(/^\/jobs\/[^/]+\/save$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const job = await db.collection('jobs').findOne({ id })
      if (!job) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const has = (job.savedByUserIds || []).includes(auth.id)
      await db.collection('jobs').updateOne(
        { id },
        has ? { $pull: { savedByUserIds: auth.id } } : { $addToSet: { savedByUserIds: auth.id } },
      )
      return handleCORS(NextResponse.json({ saved: !has }))
    }

    // ---------- JOB MESSAGES ----------
    if (route.match(/^\/jobs\/[^/]+\/messages$/) && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const job = await db.collection('jobs').findOne({ id })
      if (!job) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const isParty = job.postedByUserId === auth.id || job.acceptedByUserId === auth.id || isStaff(auth.role)
      if (!isParty) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const msgs = await db.collection('job_messages').find({ jobId: id }).sort({ createdAt: 1 }).limit(500).toArray()
      // mark read
      await db.collection('job_messages').updateMany(
        { jobId: id, receiverId: auth.id, read: false },
        { $set: { read: true } },
      )
      return handleCORS(NextResponse.json({ messages: msgs.map(clean) }))
    }
    if (route.match(/^\/jobs\/[^/]+\/messages$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[2]
      const job = await db.collection('jobs').findOne({ id })
      if (!job) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json()
      const text = String(body.message || '').trim()
      if (!text) return handleCORS(NextResponse.json({ error: 'Message required' }, { status: 400 }))
      const isPoster = job.postedByUserId === auth.id
      const isContractor = job.acceptedByUserId === auth.id
      if (!isPoster && !isContractor) {
        return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const receiverId = isPoster ? job.acceptedByUserId : job.postedByUserId
      const msg = {
        id: uuidv4(),
        jobId: id,
        senderId: auth.id,
        receiverId,
        message: text,
        photos: Array.isArray(body.photos) ? body.photos.slice(0, 4) : [],
        read: false,
        createdAt: new Date(),
      }
      await db.collection('job_messages').insertOne(msg)
      return handleCORS(NextResponse.json({ message: clean(msg) }))
    }

    // ---------- VERIFIED POSTING APPLICATION ----------
    if (route === '/verified-posting-application' && method === 'POST') {
      const auth = getAuth(request)
      const body = await request.json()
      if (!body.email || !body.accountType) {
        return handleCORS(NextResponse.json({ error: 'Email and account type required' }, { status: 400 }))
      }
      const app = {
        id: uuidv4(),
        userId: auth?.id || null,
        accountType: body.accountType,
        businessName: body.businessName || '',
        contactName: body.contactName || '',
        email: String(body.email).toLowerCase(),
        phone: body.phone || '',
        reasonForPosting: body.reasonForPosting || '',
        expectedMonthlyJobs: body.expectedMonthlyJobs || '',
        notes: body.notes || '',
        status: 'pending',
        createdAt: new Date(),
      }
      await db.collection('verified_posting_applications').insertOne(app)
      return handleCORS(NextResponse.json({ ok: true, application: clean(app) }))
    }

    if (route === '/admin/verified-posting-applications' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const apps = await db.collection('verified_posting_applications').find({}).sort({ createdAt: -1 }).limit(500).toArray()
      return handleCORS(NextResponse.json({ applications: apps.map(clean) }))
    }
    if (route.match(/^\/admin\/verified-posting-applications\/[^/]+$/) && method === 'PATCH') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const id = route.split('/')[3]
      const body = await request.json()
      const update = {}
      if (body.status) update.status = body.status
      if (body.notes !== undefined) update.notes = body.notes
      await db.collection('verified_posting_applications').updateOne({ id }, { $set: update })
      const app = await db.collection('verified_posting_applications').findOne({ id })
      // If approved, mark user as verified poster
      if (body.status === 'approved' && app?.userId) {
        await db.collection('users').updateOne(
          { id: app.userId },
          { $set: { isVerified: true, isPaidAccount: true, verifiedPosting: true, accountType: app.accountType, paymentStatus: 'pilot' } },
        )
      }
      return handleCORS(NextResponse.json({ application: clean(app) }))
    }

    if (route === '/admin/jobs' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth || !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const jobs = await db.collection('jobs').find({}).sort({ createdAt: -1 }).limit(500).toArray()
      const enriched = await Promise.all(jobs.map((j) => enrichJob(j)))
      return handleCORS(NextResponse.json({ jobs: enriched }))
    }
    // ============================================================
    // ================== END JOBS API ============================
    // ============================================================

    // ============================================================
    // ================== ADMIN DASHBOARD API =====================
    // ============================================================

    // -- OVERVIEW (KPIs) -----------------------------------------
    if (route === '/admin/overview' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const since24h = new Date(Date.now() - 24 * 3600 * 1000)
      const since7d  = new Date(Date.now() - 7  * 24 * 3600 * 1000)
      const [
        totalUsers, activeUsers, suspendedUsers, bannedUsers, verifiedUsers,
        totalFacilities, pendingFacilities, approvedFacilities, rejectedFacilities,
        totalMarketplace, flaggedMarketplace,
        totalJobs, openJobs, hotSpotJobs,
        alertsActive, alertsToday,
        reportsOpen, reportsTotal,
        recentActivity,
      ] = await Promise.all([
        db.collection('users').countDocuments({}),
        db.collection('users').countDocuments({ accountStatus: 'active' }),
        db.collection('users').countDocuments({ accountStatus: 'suspended' }),
        db.collection('users').countDocuments({ accountStatus: 'banned' }),
        db.collection('users').countDocuments({ verificationLevel: { $in: ['verified_user', 'verified_contractor', 'verified_facility_owner'] } }),
        db.collection('facilities').countDocuments({}),
        db.collection('facilities').countDocuments({ status: 'pending' }),
        db.collection('facilities').countDocuments({ status: 'approved' }),
        db.collection('facilities').countDocuments({ status: 'rejected' }),
        db.collection('marketplace_listings').countDocuments({}).catch(() => 0),
        db.collection('marketplace_listings').countDocuments({ flagCount: { $gt: 0 } }).catch(() => 0),
        db.collection('jobs').countDocuments({}).catch(() => 0),
        db.collection('jobs').countDocuments({ status: { $in: ['open', 'accepted', 'in_progress'] } }).catch(() => 0),
        db.collection('jobs').countDocuments({ hotSpot: true }).catch(() => 0),
        db.collection('alerts').countDocuments({ status: 'active' }).catch(() => 0),
        db.collection('alerts').countDocuments({ createdAt: { $gte: since24h } }).catch(() => 0),
        db.collection('reports').countDocuments({ status: 'open' }).catch(() => 0),
        db.collection('reports').countDocuments({}).catch(() => 0),
        db.collection('activity_logs').find({}).sort({ createdAt: -1 }).limit(15).toArray().catch(() => []),
      ])
      return handleCORS(NextResponse.json({
        kpis: {
          users:        { total: totalUsers, active: activeUsers, suspended: suspendedUsers, banned: bannedUsers, verified: verifiedUsers },
          facilities:   { total: totalFacilities, pending: pendingFacilities, approved: approvedFacilities, rejected: rejectedFacilities },
          marketplace:  { total: totalMarketplace, flagged: flaggedMarketplace },
          jobs:         { total: totalJobs, open: openJobs, hotSpots: hotSpotJobs },
          alerts:       { active: alertsActive, last24h: alertsToday },
          reports:      { open: reportsOpen, total: reportsTotal },
        },
        recentActivity: recentActivity.map(clean),
        generatedAt: new Date(),
      }))
    }

    // -- USERS (list) --------------------------------------------
    if (route === '/admin/users' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const q       = (url.searchParams.get('q') || '').trim().toLowerCase()
      const role    = url.searchParams.get('role') || ''
      const status  = url.searchParams.get('status') || ''
      const limit   = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
      const skip    = parseInt(url.searchParams.get('skip') || '0', 10)
      const filter  = {}
      if (q)      filter.$or = [{ email: { $regex: q, $options: 'i' } }, { name: { $regex: q, $options: 'i' } }]
      if (role)   filter.role = role
      if (status) filter.accountStatus = status
      const [users, total] = await Promise.all([
        db.collection('users').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
        db.collection('users').countDocuments(filter),
      ])
      // enrich w/ activity counts
      const enriched = await Promise.all(users.map(async (u) => {
        const [mkt, jobs, alerts] = await Promise.all([
          db.collection('marketplace_listings').countDocuments({ sellerId: u.id }).catch(() => 0),
          db.collection('jobs').countDocuments({ postedByUserId: u.id }).catch(() => 0),
          db.collection('alerts').countDocuments({ userId: u.id }).catch(() => 0),
        ])
        return { ...clean(u), marketplaceCount: mkt, jobsPosted: jobs, alertsPosted: alerts }
      }))
      return handleCORS(NextResponse.json({ users: enriched, total }))
    }

    // -- USER ACTIVITY (specific path — MUST be checked before generic /admin/users/:id) --
    if (route.match(/^\/admin\/users\/[^/]+\/activity$/) && method === 'GET') {
      const guard = await requireStaff(request, db, 'admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[3]
      const u = await db.collection('users').findOne({ id })
      if (!u) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20', 10))
      const events = await db.collection('activity_log')
        .find({ $or: [{ 'actor.id': id }, { 'target.id': id }] })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()
        .catch(() => [])
      return handleCORS(NextResponse.json({
        user: clean(u),
        events: events.map(clean),
        lastLogin: u.lastLoginAt || null,
        createdAt: u.createdAt || null,
        adminNotes: u.adminNotes || [],
      }))
    }

    // -- USER (single, with detail) ------------------------------
    // Skip V2 routes (handled by adminUsersV2 handler)
    if (route.startsWith('/admin/users/') && method === 'GET' && !route.startsWith('/admin/users/v2') && route !== '/admin/users/export' && !route.startsWith('/admin/users/bulk/') && route !== '/admin/users/migrate-memberships') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[3]
      const u = await db.collection('users').findOne({ id })
      if (!u) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const [reportsAgainst, recent] = await Promise.all([
        db.collection('reports').find({ targetUserId: u.id }).sort({ createdAt: -1 }).limit(20).toArray().catch(() => []),
        db.collection('activity_logs').find({ targetId: u.id, targetKind: 'user' }).sort({ createdAt: -1 }).limit(20).toArray().catch(() => []),
      ])
      return handleCORS(NextResponse.json({
        user: clean(u),
        reportsAgainst: reportsAgainst.map(clean),
        moderationHistory: recent.map(clean),
      }))
    }

    // -- USER (mutate role/status/verification) ------------------
    // Skip V2 routes (handled by adminUsersV2 handler)
    if (route.startsWith('/admin/users/') && method === 'PATCH' && !route.startsWith('/admin/users/bulk/')) {
      const guard = await requireStaff(request, db, 'admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[3]
      const u = await db.collection('users').findOne({ id })
      if (!u) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json()
      const { action, role, accountStatus, verificationLevel, suspendedUntil, banReason, email: newEmail, adminNote } = body
      // Guards: can't downgrade a super_admin unless YOU are super_admin
      if (u.role === 'super_admin' && !isSuperAdmin(guard.user.role)) {
        return handleCORS(NextResponse.json({ error: 'Only super_admin may modify super_admin accounts' }, { status: 403 }))
      }
      // Only super_admin can promote to admin/super_admin/moderator
      if ((role && STAFF_ROLES.includes(role)) && !isSuperAdmin(guard.user.role)) {
        return handleCORS(NextResponse.json({ error: 'Only super_admin may assign staff roles' }, { status: 403 }))
      }
      const update = { updatedAt: new Date() }
      if (role)              update.role = role
      if (accountStatus)     update.accountStatus = accountStatus
      if (verificationLevel) update.verificationLevel = verificationLevel
      if (suspendedUntil !== undefined) update.suspendedUntil = suspendedUntil ? new Date(suspendedUntil) : null
      if (banReason !== undefined)      update.banReason = banReason
      // Email update — validate uniqueness + format
      if (newEmail && typeof newEmail === 'string') {
        const normalized = String(newEmail).trim().toLowerCase()
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
          return handleCORS(NextResponse.json({ error: 'Invalid email address' }, { status: 400 }))
        }
        if (normalized !== u.email) {
          const dupe = await db.collection('users').findOne({ email: normalized, id: { $ne: u.id } })
          if (dupe) {
            return handleCORS(NextResponse.json({ error: 'Another account already uses this email' }, { status: 409 }))
          }
          update.email = normalized
        }
      }
      // Quick actions
      if (action === 'suspend') {
        update.accountStatus = 'suspended'
        update.suspendedUntil = suspendedUntil ? new Date(suspendedUntil) : new Date(Date.now() + 7 * 24 * 3600 * 1000)
      } else if (action === 'suspend_30d') {
        update.accountStatus = 'suspended'
        update.suspendedUntil = new Date(Date.now() + 30 * 24 * 3600 * 1000)
      } else if (action === 'ban') {
        update.accountStatus = 'banned'
        update.banReason = banReason || 'Violation of terms'
      } else if (action === 'reinstate' || action === 'reset' || action === 'unlock') {
        update.accountStatus = 'active'
        update.suspendedUntil = null
        update.banReason = null
      } else if (action === 'delete') {
        // Soft delete — preserves audit trail, hides user from regular surfaces.
        update.accountStatus = 'deleted'
        update.deletedAt = new Date()
        update.deletedBy = guard.user.id
      } else if (action === 'verify_user') {
        update.verificationLevel = 'verified_user'
      } else if (action === 'verify_contractor') {
        update.verificationLevel = 'verified_contractor'
        update.isVerified = true
      } else if (action === 'verify_facility_owner') {
        update.verificationLevel = 'verified_facility_owner'
      }
      await db.collection('users').updateOne({ id }, { $set: update })
      // Append admin note (separate from $set so we can push to an array)
      if (adminNote && typeof adminNote === 'string' && adminNote.trim()) {
        await db.collection('users').updateOne(
          { id },
          { $push: { adminNotes: { text: String(adminNote).trim().slice(0, 1000), authorId: guard.user.id, authorEmail: guard.user.email, createdAt: new Date() } } }
        )
      }
      await logActivity(db, guard.user, `user.${action || 'update'}`, { kind: 'user', id, label: u.email }, body)
      const fresh = await db.collection('users').findOne({ id })
      return handleCORS(NextResponse.json({ user: clean(fresh) }))
    }

    // -- FACILITIES (admin list, all statuses) -------------------
    if (route === '/admin/facilities' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const status = url.searchParams.get('status') || ''
      const q = (url.searchParams.get('q') || '').trim().toLowerCase()
      const filter = {}
      if (status) filter.status = status
      if (q) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { address: { $regex: q, $options: 'i' } }]
      const docs = await db.collection('facilities').find(filter).sort({ submittedAt: -1, createdAt: -1 }).limit(200).toArray()
      return handleCORS(NextResponse.json({ facilities: docs.map(clean) }))
    }

    // -- MARKETPLACE (admin list) --------------------------------
    if (route === '/admin/marketplace' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const q       = (url.searchParams.get('q') || '').trim().toLowerCase()
      const segment = url.searchParams.get('segment') || ''
      const status  = url.searchParams.get('status') || ''
      const flagged = url.searchParams.get('flagged') === 'true'
      const filter  = {}
      if (q)       filter.$or = [{ title: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } }]
      if (segment) filter.segment = segment
      if (status)  filter.status = status
      if (flagged) filter.flagCount = { $gt: 0 }
      const listings = await db.collection('marketplace_listings').find(filter).sort({ createdAt: -1 }).limit(200).toArray()
      return handleCORS(NextResponse.json({ listings: listings.map(clean) }))
    }

    // -- MARKETPLACE PATCH (admin action) ------------------------
    if (route.startsWith('/admin/marketplace/') && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[3]
      const l = await db.collection('marketplace_listings').findOne({ id })
      if (!l) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json()
      const { action, featured } = body
      const update = { updatedAt: new Date() }
      if (action === 'approve') update.status = 'active'
      else if (action === 'remove') update.status = 'removed'
      else if (action === 'flag_spam') update.status = 'flagged'
      else if (action === 'feature') update.featured = !!featured
      else if (action === 'unfeature') update.featured = false
      else if (action === 'clear_flags') { update.flagCount = 0; update.status = 'active' }
      await db.collection('marketplace_listings').updateOne({ id }, { $set: update })
      await logActivity(db, guard.user, `marketplace.${action || 'update'}`, { kind: 'marketplace', id, label: l.title }, body)
      const fresh = await db.collection('marketplace_listings').findOne({ id })
      return handleCORS(NextResponse.json({ listing: clean(fresh) }))
    }

    // -- JOBS (admin list, all statuses) -------------------------
    if (route === '/admin/jobs' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const status = url.searchParams.get('status') || ''
      const q = (url.searchParams.get('q') || '').trim().toLowerCase()
      const filter = {}
      if (status) filter.status = status
      if (q) filter.$or = [{ title: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } }]
      const jobs = await db.collection('jobs').find(filter).sort({ createdAt: -1 }).limit(200).toArray()
      return handleCORS(NextResponse.json({ jobs: jobs.map(clean) }))
    }

    // -- JOBS PATCH (admin action) -------------------------------
    if (route.startsWith('/admin/jobs/') && route.split('/').length === 4 && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[3]
      const j = await db.collection('jobs').findOne({ id })
      if (!j) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json()
      const { action } = body
      const update = { updatedAt: new Date() }
      if (action === 'remove') update.status = 'removed'
      else if (action === 'verify') { update.status = 'open'; update.adminVerified = true }
      else if (action === 'feature') update.featured = true
      else if (action === 'unfeature') update.featured = false
      else if (action === 'mark_completed') update.status = 'completed'
      await db.collection('jobs').updateOne({ id }, { $set: update })
      await logActivity(db, guard.user, `job.${action || 'update'}`, { kind: 'job', id, label: j.title }, body)
      const fresh = await db.collection('jobs').findOne({ id })
      return handleCORS(NextResponse.json({ job: clean(fresh) }))
    }

    // -- ALERTS (admin list) -------------------------------------
    if (route === '/admin/alerts' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const status = url.searchParams.get('status') || ''
      const filter = {}
      if (status) filter.status = status
      const alerts = await db.collection('alerts').find(filter).sort({ createdAt: -1 }).limit(200).toArray()
      return handleCORS(NextResponse.json({ alerts: alerts.map(clean) }))
    }

    // -- ALERTS PATCH (admin action) -----------------------------
    if (route.startsWith('/admin/alerts/') && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[3]
      const a = await db.collection('alerts').findOne({ id })
      if (!a) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json()
      const { action } = body
      const update = { updatedAt: new Date() }
      if (action === 'remove') update.status = 'removed'
      else if (action === 'pin') update.pinned = true
      else if (action === 'unpin') update.pinned = false
      else if (action === 'verify') update.adminVerified = true
      await db.collection('alerts').updateOne({ id }, { $set: update })
      await logActivity(db, guard.user, `alert.${action || 'update'}`, { kind: 'alert', id, label: a.type }, body)
      const fresh = await db.collection('alerts').findOne({ id })
      return handleCORS(NextResponse.json({ alert: clean(fresh) }))
    }

    // -- REPORTS (universal — user-facing CREATE) ----------------
    if (route === '/reports' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Login required to report' }, { status: 401 }))
      const body = await request.json()
      const { targetKind, targetId, reason, detail } = body
      if (!targetKind || !targetId || !reason) {
        return handleCORS(NextResponse.json({ error: 'targetKind, targetId, and reason are required' }, { status: 400 }))
      }
      const report = {
        id: uuidv4(),
        targetKind,                 // 'facility'|'marketplace'|'job'|'alert'|'profile'|'message'
        targetId,
        targetUserId: body.targetUserId || null,
        reason,                     // 'spam'|'scam'|'inappropriate'|'inaccurate'|'duplicate'|'other'
        detail: detail || '',
        reportedByUserId: auth.id,
        reportedByEmail: auth.email,
        status: 'open',             // 'open'|'reviewing'|'resolved'|'dismissed'
        resolution: null,
        moderatorId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('reports').insertOne(report)
      // Bump reportsAgainst on the target user (for user reports)
      if (targetKind === 'profile' && body.targetUserId) {
        await db.collection('users').updateOne({ id: body.targetUserId }, { $inc: { reportsAgainst: 1 } })
      }
      return handleCORS(NextResponse.json({ report: clean(report) }))
    }

    // -- REPORTS (admin list) ------------------------------------
    if (route === '/admin/reports' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const status = url.searchParams.get('status') || ''
      const kind = url.searchParams.get('kind') || ''
      const filter = {}
      if (status) filter.status = status
      if (kind) filter.targetKind = kind
      const reports = await db.collection('reports').find(filter).sort({ createdAt: -1 }).limit(200).toArray()
      return handleCORS(NextResponse.json({ reports: reports.map(clean) }))
    }

    // -- REPORTS PATCH (admin resolve/dismiss) -------------------
    if (route.startsWith('/admin/reports/') && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[3]
      const r = await db.collection('reports').findOne({ id })
      if (!r) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json()
      const update = {
        status: body.status || 'reviewing',
        resolution: body.resolution || null,
        moderatorId: guard.user.id,
        updatedAt: new Date(),
      }
      await db.collection('reports').updateOne({ id }, { $set: update })
      await logActivity(db, guard.user, `report.${body.status || 'update'}`, { kind: 'report', id, label: r.targetKind }, body)
      const fresh = await db.collection('reports').findOne({ id })
      return handleCORS(NextResponse.json({ report: clean(fresh) }))
    }

    // -- ACTIVITY LOG --------------------------------------------
    if (route === '/admin/activity-log' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500)
      const actor = url.searchParams.get('actorId') || ''
      const action = url.searchParams.get('action') || ''
      const filter = {}
      if (actor) filter.actorId = actor
      if (action) filter.action = { $regex: action, $options: 'i' }
      const logs = await db.collection('activity_logs').find(filter).sort({ createdAt: -1 }).limit(limit).toArray()
      return handleCORS(NextResponse.json({ logs: logs.map(clean) }))
    }

    // -- ANALYTICS -----------------------------------------------
    if (route === '/admin/analytics' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))

      const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000)

      // Top facilities by active alert count + rating
      const facilities = await db.collection('facilities').find({ status: 'approved' }).limit(200).toArray()
      const facWithAlerts = await attachActiveAlerts(db, facilities)
      const trendingFacilities = facWithAlerts
        .sort((a, b) => (b.activeAlertCount || 0) - (a.activeAlertCount || 0))
        .slice(0, 10)
        .map((f) => ({ id: f.id, name: f.name, type: f.type, activeAlertCount: f.activeAlertCount || 0, rating: f.rating || 0 }))
      const busiestFacilities = facWithAlerts
        .filter((f) => f.activeAlerts?.some((a) => /WAIT_TIME|LONG_LINE|YARD_FULL/i.test(a.type)))
        .slice(0, 10)
        .map((f) => ({ id: f.id, name: f.name, type: f.type, activeAlertCount: f.activeAlertCount || 0 }))
      const fastestMoving = facWithAlerts
        .filter((f) => f.activeAlerts?.some((a) => /FAST_MOVING|ACCEPTING_NOW/i.test(a.type)))
        .slice(0, 10)
        .map((f) => ({ id: f.id, name: f.name, type: f.type }))

      // Most active users (by alerts posted last 30d + jobs posted)
      const recentAlerts = await db.collection('alerts').find({ createdAt: { $gte: since30d } }).toArray()
      const userCounts = {}
      for (const a of recentAlerts) {
        if (!a.userId) continue
        userCounts[a.userId] = (userCounts[a.userId] || 0) + 1
      }
      const topUserIds = Object.entries(userCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map((x) => x[0])
      const topUsers = topUserIds.length
        ? await db.collection('users').find({ id: { $in: topUserIds } }).toArray()
        : []
      const mostActiveUsers = topUsers.map((u) => ({
        id: u.id, name: u.name, email: u.email,
        alertsPosted: userCounts[u.id] || 0, role: u.role,
      })).sort((a, b) => b.alertsPosted - a.alertsPosted)

      // Top marketplace categories
      const mktAgg = await db.collection('marketplace_listings').aggregate([
        { $match: { status: { $ne: 'removed' } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 10 },
      ]).toArray().catch(() => [])
      const topMarketCategories = mktAgg.map((x) => ({ category: x._id || 'Uncategorized', count: x.count }))

      // Active jobs by category
      const jobAgg = await db.collection('jobs').aggregate([
        { $match: { status: { $in: ['open', 'accepted', 'in_progress'] } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 10 },
      ]).toArray().catch(() => [])
      const activeJobsByCategory = jobAgg.map((x) => ({ category: x._id || 'Uncategorized', count: x.count }))

      // Alert types histogram (last 7 days)
      const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000)
      const alertAgg = await db.collection('alerts').aggregate([
        { $match: { createdAt: { $gte: since7d } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray().catch(() => [])
      const topAlertTypes = alertAgg.map((x) => ({ type: x._id, count: x.count }))

      return handleCORS(NextResponse.json({
        trendingFacilities,
        busiestFacilities,
        fastestMoving,
        mostActiveUsers,
        topMarketCategories,
        activeJobsByCategory,
        topAlertTypes,
        generatedAt: new Date(),
      }))
    }
    // ============================================================
    // ================== ADMIN v2 — Platform Tools ===============
    // ============================================================

    // ---- PLATFORM SETTINGS (singleton) ----
    if (route === '/admin/platform-settings' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const s = await getPlatformSettings(db)
      return handleCORS(NextResponse.json({ settings: s }))
    }
    if (route === '/admin/platform-settings' && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const update = { ...body, updatedAt: new Date() }
      delete update._id; delete update.id
      await db.collection('platform_settings').updateOne({ id: 'singleton' }, { $set: update }, { upsert: true })
      await logActivity(db, guard.user, 'settings.update', { kind: 'platform_settings', id: 'singleton', label: 'platform' }, body)
      const s = await getPlatformSettings(db)
      return handleCORS(NextResponse.json({ settings: s }))
    }
    // Public read of settings (for the main app to check maintenance / module flags)
    if (route === '/platform-settings/public' && method === 'GET') {
      const s = await getPlatformSettings(db)
      // strip anything sensitive
      const { _id, ...safe } = s
      return handleCORS(NextResponse.json({ settings: safe }))
    }

    // ---- INTEGRATIONS REGISTRY ----
    if (route === '/admin/integrations' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const list = await getIntegrations(db)
      return handleCORS(NextResponse.json({ integrations: list }))
    }
    if (route.startsWith('/admin/integrations/') && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const key = route.split('/')[3]
      const body = await request.json()
      const update = { ...body, key, updatedAt: new Date() }
      delete update._id
      await db.collection('integrations').updateOne({ key }, { $set: update }, { upsert: true })
      await logActivity(db, guard.user, 'integration.update', { kind: 'integration', id: key, label: key }, body)
      const fresh = await db.collection('integrations').findOne({ key })
      return handleCORS(NextResponse.json({ integration: clean(fresh) }))
    }

    // ---- EMAIL SETTINGS ----
    if (route === '/admin/email-settings' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const s = await getEmailSettings(db)
      return handleCORS(NextResponse.json({ settings: s }))
    }
    if (route === '/admin/email-settings' && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const update = { ...body, updatedAt: new Date() }
      delete update._id; delete update.id
      await db.collection('email_settings').updateOne({ id: 'singleton' }, { $set: update }, { upsert: true })
      await logActivity(db, guard.user, 'email_settings.update', { kind: 'email_settings', id: 'singleton', label: 'emails' }, body)
      const s = await getEmailSettings(db)
      return handleCORS(NextResponse.json({ settings: s }))
    }

    // ---- WARNINGS ----
    if (route === '/admin/warnings' && method === 'POST') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const w = {
        id: uuidv4(),
        userId: body.userId,
        reason: body.reason || '',
        severity: body.severity || 'warning', // warning | strike
        issuedBy: guard.user.id,
        issuedByEmail: guard.user.email,
        createdAt: new Date(),
      }
      await db.collection('warnings').insertOne(w)
      // increment user.warningCount
      await db.collection('users').updateOne({ id: body.userId }, { $inc: { warningCount: 1 } })
      await logActivity(db, guard.user, 'user.warning', { kind: 'user', id: body.userId, label: w.reason }, body)
      return handleCORS(NextResponse.json({ warning: clean(w) }))
    }
    if (route === '/admin/warnings' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const userId = url.searchParams.get('userId') || ''
      const filter = userId ? { userId } : {}
      const list = await db.collection('warnings').find(filter).sort({ createdAt: -1 }).limit(200).toArray()
      return handleCORS(NextResponse.json({ warnings: list.map(clean) }))
    }

    // ---- FRAUD FLAGS ----
    if (route === '/admin/fraud-flags' && method === 'POST') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const f = {
        id: uuidv4(),
        targetKind: body.targetKind, // user | listing | job | facility
        targetId: body.targetId,
        type: body.type || 'suspicious_activity',
        severity: body.severity || 'medium',
        note: body.note || '',
        flaggedBy: guard.user.id,
        createdAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
      }
      await db.collection('fraud_flags').insertOne(f)
      await logActivity(db, guard.user, 'fraud.flag', { kind: body.targetKind, id: body.targetId, label: body.type }, body)
      return handleCORS(NextResponse.json({ flag: clean(f) }))
    }
    if (route === '/admin/fraud-flags' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const open = url.searchParams.get('resolved') === 'true' ? { resolvedAt: { $ne: null } } : { resolvedAt: null }
      const list = await db.collection('fraud_flags').find(open).sort({ createdAt: -1 }).limit(200).toArray()
      return handleCORS(NextResponse.json({ flags: list.map(clean) }))
    }
    if (route.startsWith('/admin/fraud-flags/') && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[3]
      const body = await request.json()
      await db.collection('fraud_flags').updateOne({ id }, { $set: { resolvedAt: new Date(), resolvedBy: guard.user.id, resolution: body.resolution || '' } })
      const fresh = await db.collection('fraud_flags').findOne({ id })
      await logActivity(db, guard.user, 'fraud.resolve', { kind: 'fraud_flag', id }, body)
      return handleCORS(NextResponse.json({ flag: clean(fresh) }))
    }

    // ---- DISPUTES ----
    if (route === '/admin/disputes' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const status = url.searchParams.get('status') || ''
      const filter = status ? { status } : {}
      const list = await db.collection('disputes').find(filter).sort({ createdAt: -1 }).limit(200).toArray()
      return handleCORS(NextResponse.json({ disputes: list.map(clean) }))
    }
    if (route === '/admin/disputes' && method === 'POST') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const d = { id: uuidv4(), ...body, status: 'open', createdAt: new Date(), openedBy: guard.user.id }
      await db.collection('disputes').insertOne(d)
      await logActivity(db, guard.user, 'dispute.open', { kind: 'dispute', id: d.id, label: d.kind }, body)
      return handleCORS(NextResponse.json({ dispute: clean(d) }))
    }
    if (route.startsWith('/admin/disputes/') && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[3]
      const body = await request.json()
      await db.collection('disputes').updateOne({ id }, { $set: { ...body, updatedAt: new Date() } })
      const fresh = await db.collection('disputes').findOne({ id })
      await logActivity(db, guard.user, `dispute.${body.status || 'update'}`, { kind: 'dispute', id }, body)
      return handleCORS(NextResponse.json({ dispute: clean(fresh) }))
    }

    // ---- CONTRACTOR VERIFICATION QUEUE ----
    // ============================================================
    // ============ CONTRACTOR TOOL APPLICATIONS (Phase B) =========
    // ============================================================
    // User-facing endpoints that let any signed-in user apply for the
    // contractor tools (Disposal Intelligence + Receipt Center). Reuses
    // the existing `contractor_verifications` collection so admins can
    // review applications at /admin/contractor-verification with no
    // additional plumbing.

    if (route === '/contractor-applications' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const body = await request.json().catch(() => ({}))
      const businessName = String(body.businessName || '').trim()
      const desiredRoles = Array.isArray(body.desiredRoles) ? body.desiredRoles.filter(Boolean).map((r) => String(r).toLowerCase()) : []
      if (!businessName) return handleCORS(NextResponse.json({ error: 'businessName required' }, { status: 400 }))
      if (!desiredRoles.length) return handleCORS(NextResponse.json({ error: 'desiredRoles required' }, { status: 400 }))
      const allowed = ['contractor', 'hauler', 'recycler', 'junk_removal', 'dumpster_op', 'cleanup_crew']
      const sanitizedRoles = desiredRoles.filter((r) => allowed.includes(r))
      if (!sanitizedRoles.length) return handleCORS(NextResponse.json({ error: 'No valid contractor roles selected' }, { status: 400 }))

      // Upsert: if user already has a record, treat as a re-application.
      const existing = await db.collection('contractor_verifications').findOne({ userId: auth.id })
      const doc = {
        id: existing?.id || uuidv4(),
        userId: auth.id,
        businessName,
        phone: String(body.phone || '').trim(),
        email: String(body.email || auth.email || '').trim(),
        licenseNumber: String(body.licenseNumber || '').trim(),
        insuranceProvider: String(body.insuranceProvider || '').trim(),
        insurancePolicy: existing?.insurancePolicy || '',
        serviceArea: Array.isArray(body.serviceArea) ? body.serviceArea.map((s) => String(s).trim()).filter(Boolean) : [],
        desiredRoles: sanitizedRoles,
        documents: existing?.documents || [],
        status: 'pending',
        payoutEligible: false,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date(),
        submittedByUser: true,
      }
      await db.collection('contractor_verifications').updateOne({ userId: auth.id }, { $set: doc }, { upsert: true })
      try {
        await logActivity(db, auth, 'contractor.applied', { kind: 'user', id: auth.id, label: businessName }, { desiredRoles: sanitizedRoles })
      } catch (e) { /* logging is best-effort */ }
      return handleCORS(NextResponse.json({ application: clean(doc) }))
    }

    if (route === '/contractor-applications/me' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const app = await db.collection('contractor_verifications').findOne({ userId: auth.id })
      return handleCORS(NextResponse.json({ application: app ? clean(app) : null }))
    }

    // ============================================================
    // ================ END CONTRACTOR APPLICATIONS ===============
    // ============================================================

    if (route === '/admin/contractor-verifications' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const status = url.searchParams.get('status') || ''
      const filter = status ? { status } : {}
      const list = await db.collection('contractor_verifications').find(filter).sort({ createdAt: -1 }).limit(200).toArray()
      return handleCORS(NextResponse.json({ verifications: list.map(clean) }))
    }
    if (route === '/admin/contractor-verifications' && method === 'POST') {
      // staff creates/updates a verification record for a user
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const userId = body.userId
      if (!userId) return handleCORS(NextResponse.json({ error: 'userId required' }, { status: 400 }))
      const existing = await db.collection('contractor_verifications').findOne({ userId })
      const doc = {
        id: existing?.id || uuidv4(),
        userId,
        licenseNumber: body.licenseNumber || '',
        insuranceProvider: body.insuranceProvider || '',
        insurancePolicy: body.insurancePolicy || '',
        businessName: body.businessName || '',
        phone: body.phone || '',
        email: body.email || '',
        serviceArea: Array.isArray(body.serviceArea) ? body.serviceArea : [],
        documents: Array.isArray(body.documents) ? body.documents : [],
        status: body.status || 'pending', // pending | approved | rejected
        payoutEligible: !!body.payoutEligible,
        reviewedBy: guard.user.id,
        reviewedAt: new Date(),
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date(),
      }
      await db.collection('contractor_verifications').updateOne({ userId }, { $set: doc }, { upsert: true })
      // Bump user verification level if approved
      if (doc.status === 'approved') {
        // Phase B: when admin approves, also write the contractorRoles array
        // (drawn from the user's submitted desiredRoles) so the frontend
        // contractor-access lib picks them up immediately.
        const rolesFromApplication = Array.isArray(existing?.desiredRoles) ? existing.desiredRoles : []
        const rolesFromBody = Array.isArray(body.contractorRoles) ? body.contractorRoles : []
        const allowedRoles = ['contractor', 'hauler', 'recycler', 'junk_removal', 'dumpster_op', 'cleanup_crew']
        const finalRoles = Array.from(new Set([...rolesFromApplication, ...rolesFromBody]))
          .map((r) => String(r).toLowerCase())
          .filter((r) => allowedRoles.includes(r))
        await db.collection('users').updateOne(
          { id: userId },
          { $set: {
              verificationLevel: 'verified_contractor',
              isVerified: true,
              payoutEligible: !!body.payoutEligible,
              contractorRoles: finalRoles.length ? finalRoles : ['contractor'],
              contractorApprovedAt: new Date(),
            } }
        )
      } else if (doc.status === 'rejected') {
        await db.collection('users').updateOne({ id: userId }, { $set: { isVerified: false, payoutEligible: false } })
      }
      await logActivity(db, guard.user, `contractor.${doc.status}`, { kind: 'user', id: userId, label: doc.businessName || doc.email }, body)
      return handleCORS(NextResponse.json({ verification: clean(doc) }))
    }

    // ---- FACILITY OWNER FLAGS (per-user override) ----
    if (route.startsWith('/admin/facility-owner-flags/') && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const userId = route.split('/')[3]
      const body = await request.json() // { claimListing, updatePricing, postClosures, manageMessages, paymentPilot, uploadDocs }
      await db.collection('users').updateOne({ id: userId }, { $set: { facilityOwnerFlags: body, updatedAt: new Date() } })
      await logActivity(db, guard.user, 'facility_owner.flags', { kind: 'user', id: userId }, body)
      const u = await db.collection('users').findOne({ id: userId })
      return handleCORS(NextResponse.json({ user: clean(u) }))
    }

    // ============================================================
    // ================== END ADMIN v2 ============================
    // ============================================================

    // ============================================================
    // ================== DONATIONS ===============================
    // ============================================================
    // Public donation intent (works with or without Stripe wired).
    // If Stripe is configured, we create a real Checkout Session here and
    // return the URL so the donate page can redirect into Stripe's flow.
    // If Stripe is not configured, we still record the intent so the team
    // can follow up — the existing queued flow is preserved.
    if (route === '/donations/intent' && method === 'POST') {
      const body = await request.json()
      const email = (body.email || '').trim().toLowerCase()
      const amount = Number(body.amount || 0)
      if (!email || !amount || amount <= 0) {
        return handleCORS(NextResponse.json({ error: 'email and positive amount required' }, { status: 400 }))
      }
      const auth = getAuth(request)
      const stripeCfg = await getStripeConfig(db)
      const stripeReady = stripeCfg.ready
      const intent = {
        id: uuidv4(),
        email,
        name: body.name || '',
        amount,
        currency: (body.currency || 'usd').toLowerCase(),
        tier: body.tier || '',                // recycler / community / contractor / facility / mission
        message: body.message || '',
        recurring: !!body.recurring,
        userId: auth?.id || null,
        status: stripeReady ? 'pending_checkout' : 'queued',
        stripeCheckoutSessionId: null,
        stripeCheckoutUrl: null,
        stripePaymentIntentId: null,
        contactedStatus: '',
        convertedStatus: stripeReady ? '' : 'queued',
        createdAt: new Date(),
      }
      await db.collection('donation_intents').insertOne(intent)

      // Try to create a Stripe Checkout Session if Stripe is wired up.
      // If it fails (network, invalid key, etc.) we degrade to the queue
      // and return a friendly message — the intent is still saved.
      let checkoutUrl = null
      let sessionId = null
      let stripeError = null
      if (stripeReady) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`
          const productName = intent.recurring
            ? `DumpMaps Monthly Support${intent.tier ? ` — ${intent.tier}` : ''}`
            : `DumpMaps Donation${intent.tier ? ` — ${intent.tier}` : ''}`

          const sessionParams = {
            mode: intent.recurring ? 'subscription' : 'payment',
            customer_email: email,
            success_url: `${baseUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}&amount=${amount}&email=${encodeURIComponent(email)}`,
            cancel_url: `${baseUrl}/donate/cancel?amount=${amount}&email=${encodeURIComponent(email)}`,
            metadata: {
              intentId: intent.id,
              tier: intent.tier || '',
              name: intent.name || '',
              userId: auth?.id || '',
              message: (intent.message || '').slice(0, 480),
            },
          }

          if (intent.recurring) {
            // Subscription: use price_data with a monthly recurring price.
            sessionParams.line_items = [{
              quantity: 1,
              price_data: {
                currency: intent.currency,
                product_data: { name: productName },
                unit_amount: Math.round(amount * 100),
                recurring: { interval: 'month' },
              },
            }]
            sessionParams.subscription_data = {
              metadata: sessionParams.metadata,
            }
          } else {
            sessionParams.line_items = [{
              quantity: 1,
              price_data: {
                currency: intent.currency,
                product_data: { name: productName },
                unit_amount: Math.round(amount * 100),
              },
            }]
            sessionParams.payment_intent_data = {
              metadata: sessionParams.metadata,
              description: productName,
            }
          }

          const session = await stripeCfg.client.checkout.sessions.create(sessionParams)
          checkoutUrl = session.url
          sessionId = session.id
          await db.collection('donation_intents').updateOne(
            { id: intent.id },
            { $set: {
              stripeCheckoutSessionId: sessionId,
              stripeCheckoutUrl: checkoutUrl,
              status: 'pending_checkout',
              updatedAt: new Date(),
            } }
          )
          intent.stripeCheckoutSessionId = sessionId
          intent.stripeCheckoutUrl = checkoutUrl
        } catch (e) {
          stripeError = e?.message || 'Stripe checkout failed'
          console.error('Stripe checkout.sessions.create failed:', stripeError)
          await db.collection('donation_intents').updateOne(
            { id: intent.id },
            { $set: { status: 'queued', stripeError, updatedAt: new Date() } }
          )
          intent.status = 'queued'
        }
      }

      return handleCORS(NextResponse.json({
        intent: clean(intent),
        stripeReady,
        checkoutUrl,
        sessionId,
        stripeError,
        message: checkoutUrl
          ? 'Redirecting to secure Stripe Checkout…'
          : stripeReady
            ? (stripeError ? `Could not start secure checkout (${stripeError}). Your support was logged and we will reach out.` : 'Donation intent created.')
            : 'Thank you — your interest has been logged. We will notify you when secure donation processing is live.',
      }))
    }

    // Stripe webhook — verifies signature and records confirmed donations.
    // Path: POST /api/donations/webhook
    // Configure this URL inside Stripe Dashboard → Developers → Webhooks
    // with events: checkout.session.completed, invoice.payment_succeeded,
    // invoice.payment_failed.
    if (route === '/donations/webhook' && method === 'POST') {
      const stripeCfg = await getStripeConfig(db)
      const sig = request.headers.get('stripe-signature') || ''
      const rawBody = await request.text()

      // Always log the raw event so admins can inspect deliveries even when
      // signature secret is not yet configured.
      const baseLog = {
        id: uuidv4(),
        receivedAt: new Date(),
        signaturePresent: !!sig,
        bodySize: rawBody.length,
      }

      if (!stripeCfg.ready || !stripeCfg.webhookSecret) {
        await db.collection('stripe_webhook_events').insertOne({
          ...baseLog,
          status: 'skipped_no_keys',
          note: 'Stripe webhook secret not configured — event ignored',
        })
        return handleCORS(NextResponse.json({ received: true, skipped: true }, { status: 200 }))
      }

      let event
      try {
        event = stripeCfg.client.webhooks.constructEvent(rawBody, sig, stripeCfg.webhookSecret)
      } catch (e) {
        await db.collection('stripe_webhook_events').insertOne({
          ...baseLog,
          status: 'failed',
          error: e?.message || 'signature verification failed',
        })
        return handleCORS(NextResponse.json({ error: `Webhook signature invalid: ${e?.message}` }, { status: 400 }))
      }

      // Store event for the Payment Health dashboard
      await db.collection('stripe_webhook_events').insertOne({
        ...baseLog,
        eventId: event.id,
        type: event.type,
        status: 'received',
        livemode: !!event.livemode,
        raw: event,
      })

      try {
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object
          const intentId = session?.metadata?.intentId || null
          const email = (session.customer_details?.email || session.customer_email || session?.metadata?.email || '').toLowerCase()
          const amount = (session.amount_total || 0) / 100
          const isSubscription = session.mode === 'subscription'

          // Upsert donation record (idempotent on sessionId)
          await db.collection('donations').updateOne(
            { stripeCheckoutSessionId: session.id },
            {
              $setOnInsert: {
                id: uuidv4(),
                createdAt: new Date(),
              },
              $set: {
                email,
                name: session?.metadata?.name || session.customer_details?.name || '',
                amount,
                currency: (session.currency || 'usd').toLowerCase(),
                tier: session?.metadata?.tier || '',
                message: session?.metadata?.message || '',
                recurring: isSubscription,
                userId: session?.metadata?.userId || null,
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: session.payment_intent || null,
                stripeSubscriptionId: session.subscription || null,
                stripeCustomerId: session.customer || null,
                status: 'succeeded',
                livemode: !!event.livemode,
                updatedAt: new Date(),
              },
            },
            { upsert: true }
          )

          // Mark the originating intent as converted
          if (intentId) {
            await db.collection('donation_intents').updateOne(
              { id: intentId },
              { $set: {
                status: 'converted',
                convertedStatus: 'paid',
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: session.payment_intent || null,
                stripeSubscriptionId: session.subscription || null,
                convertedAt: new Date(),
                updatedAt: new Date(),
              } }
            )
          }
        } else if (event.type === 'invoice.payment_succeeded') {
          // Recurring renewal — record a fresh donation entry
          const invoice = event.data.object
          const subId = invoice.subscription
          const linkedDonation = subId ? await db.collection('donations').findOne({ stripeSubscriptionId: subId }) : null
          await db.collection('donations').insertOne({
            id: uuidv4(),
            email: (invoice.customer_email || linkedDonation?.email || '').toLowerCase(),
            name: linkedDonation?.name || '',
            amount: (invoice.amount_paid || 0) / 100,
            currency: (invoice.currency || 'usd').toLowerCase(),
            tier: linkedDonation?.tier || '',
            recurring: true,
            stripeInvoiceId: invoice.id,
            stripeSubscriptionId: subId || null,
            stripeCustomerId: invoice.customer || null,
            stripePaymentIntentId: invoice.payment_intent || null,
            status: 'succeeded',
            livemode: !!event.livemode,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        } else if (event.type === 'invoice.payment_failed' || event.type === 'checkout.session.expired') {
          const obj = event.data.object
          const sessionOrSubId = obj.id
          await db.collection('donations').updateOne(
            { $or: [{ stripeCheckoutSessionId: sessionOrSubId }, { stripeSubscriptionId: obj.subscription }] },
            { $set: { status: event.type === 'invoice.payment_failed' ? 'failed' : 'expired', updatedAt: new Date() } }
          )
          if (obj?.metadata?.intentId) {
            await db.collection('donation_intents').updateOne(
              { id: obj.metadata.intentId },
              { $set: { status: 'failed', updatedAt: new Date() } }
            )
          }
        }
        await db.collection('stripe_webhook_events').updateOne(
          { eventId: event.id },
          { $set: { status: 'processed', processedAt: new Date() } }
        )
      } catch (e) {
        console.error('Webhook handler error:', e?.message)
        await db.collection('stripe_webhook_events').updateOne(
          { eventId: event.id },
          { $set: { status: 'handler_error', error: e?.message, processedAt: new Date() } }
        )
        // Still 200 so Stripe doesn't keep retrying for our bug.
      }
      return handleCORS(NextResponse.json({ received: true }))
    }

    // ADMIN: donations dashboard data
    if (route === '/admin/donations' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const [donations, intents] = await Promise.all([
        db.collection('donations').find({}).sort({ createdAt: -1 }).limit(200).toArray().catch(() => []),
        db.collection('donation_intents').find({}).sort({ createdAt: -1 }).limit(200).toArray().catch(() => []),
      ])
      // Stripe live status
      const stripeCfg = await getStripeConfig(db)
      const stripeReady = stripeCfg.ready
      // Aggregate stats
      const totalRaised = donations.reduce((s, d) => s + (d.amount || 0), 0)
      const recurringCount = donations.filter((d) => d.recurring).length
      const intentCount = intents.length
      const uniqueSupporters = new Set(donations.map((d) => d.email)).size
      return handleCORS(NextResponse.json({
        donations: donations.map(clean),
        intents: intents.map(clean),
        stripeReady,
        stats: { totalRaised, recurringCount, intentCount, uniqueSupporters, donationCount: donations.length },
      }))
    }

    // ADMIN: CSV export of all donations (both Stripe-confirmed + queued intents)
    // GET /api/admin/donations/export?scope=all|donations|intents
    if (route === '/admin/donations/export' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const scope = (url.searchParams.get('scope') || 'all').toLowerCase()

      const [donations, intents] = await Promise.all([
        scope === 'intents' ? [] : db.collection('donations').find({}).sort({ createdAt: -1 }).toArray().catch(() => []),
        scope === 'donations' ? [] : db.collection('donation_intents').find({}).sort({ createdAt: -1 }).toArray().catch(() => []),
      ])

      const csvEscape = (v) => {
        if (v === null || v === undefined) return ''
        const s = String(v)
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
        return s
      }

      const header = [
        'Date', 'Source', 'Donor Name', 'Email', 'Amount', 'Currency', 'Frequency',
        'Supporter Tier', 'Status', 'Stripe Session ID', 'Stripe Payment Intent ID',
        'Stripe Subscription ID', 'Message/Notes', 'Contacted Status', 'Converted Status',
      ]
      const rows = [header.map(csvEscape).join(',')]

      for (const d of donations) {
        rows.push([
          d.createdAt ? new Date(d.createdAt).toISOString() : '',
          'stripe_donation',
          d.name || '',
          d.email || '',
          d.amount ?? '',
          (d.currency || 'usd').toUpperCase(),
          d.recurring ? 'monthly' : 'one-time',
          d.tier || '',
          d.status || '',
          d.stripeCheckoutSessionId || '',
          d.stripePaymentIntentId || '',
          d.stripeSubscriptionId || '',
          d.message || '',
          d.contactedStatus || '',
          d.convertedStatus || 'paid',
        ].map(csvEscape).join(','))
      }

      for (const i of intents) {
        rows.push([
          i.createdAt ? new Date(i.createdAt).toISOString() : '',
          'intent_queue',
          i.name || '',
          i.email || '',
          i.amount ?? '',
          (i.currency || 'usd').toUpperCase(),
          i.recurring ? 'monthly' : 'one-time',
          i.tier || '',
          i.status || '',
          i.stripeCheckoutSessionId || '',
          i.stripePaymentIntentId || '',
          i.stripeSubscriptionId || '',
          i.message || '',
          i.contactedStatus || (i.status === 'contacted' ? 'contacted' : ''),
          i.convertedStatus || (i.status === 'converted' ? 'converted' : ''),
        ].map(csvEscape).join(','))
      }

      const csv = rows.join('\r\n') + '\r\n'
      const filename = `dumpmaps-donations-${new Date().toISOString().slice(0, 10)}.csv`
      const resp = new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
      return handleCORS(resp)
    }

    // ADMIN: mark intent as contacted / converted
    if (route.startsWith('/admin/donations/intents/') && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[4]
      const body = await request.json()
      const status = body.status || 'contacted'
      const upd = {
        status,
        adminNote: body.adminNote || '',
        updatedAt: new Date(),
      }
      if (status === 'contacted') upd.contactedStatus = 'contacted'
      if (status === 'converted') upd.convertedStatus = 'converted'
      await db.collection('donation_intents').updateOne({ id }, { $set: upd })
      const fresh = await db.collection('donation_intents').findOne({ id })
      await logActivity(db, guard.user, `donation_intent.${status}`, { kind: 'donation_intent', id, label: fresh?.email }, body)
      return handleCORS(NextResponse.json({ intent: clean(fresh) }))
    }
    // ============================================================

    // ============================================================
    // ================== FACILITY CLAIMS =========================
    // ============================================================
    // User submits a claim
    if (route === '/facility-claims' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Login required to claim' }, { status: 401 }))
      const body = await request.json()
      const { facilityId } = body
      if (!facilityId) return handleCORS(NextResponse.json({ error: 'facilityId required' }, { status: 400 }))
      const f = await db.collection('facilities').findOne({ id: facilityId })
      if (!f) return handleCORS(NextResponse.json({ error: 'Facility not found' }, { status: 404 }))
      if (f.claimedByUserId) return handleCORS(NextResponse.json({ error: 'This facility is already claimed' }, { status: 409 }))
      // Prevent duplicate pending claims from same user
      const existing = await db.collection('facility_claims').findOne({ facilityId, userId: auth.id, status: { $in: ['pending', 'needs_more_info'] } })
      if (existing) return handleCORS(NextResponse.json({ error: 'You already have a pending claim for this facility', claim: clean(existing) }, { status: 409 }))
      const claim = {
        id: uuidv4(),
        facilityId,
        facilityName: f.name,
        userId: auth.id,
        userEmail: auth.email,
        claimantName: body.claimantName || '',
        businessRole: body.businessRole || '',
        businessEmail: body.businessEmail || '',
        phone: body.phone || '',
        website: body.website || '',
        proofNotes: body.proofNotes || '',
        proofUrls: Array.isArray(body.proofUrls) ? body.proofUrls : [],
        message: body.message || '',
        status: 'pending',
        adminNote: '',
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('facility_claims').insertOne(claim)
      return handleCORS(NextResponse.json({ claim: clean(claim) }))
    }

    // Check claim status for current user against a facility
    if (route === '/facility-claims/mine' && method === 'GET') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ claims: [] }))
      const facilityId = url.searchParams.get('facilityId') || ''
      const filter = { userId: auth.id }
      if (facilityId) filter.facilityId = facilityId
      const claims = await db.collection('facility_claims').find(filter).sort({ createdAt: -1 }).limit(50).toArray()
      return handleCORS(NextResponse.json({ claims: claims.map(clean) }))
    }

    // Admin: list claims
    if (route === '/admin/facility-claims' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const status = url.searchParams.get('status') || ''
      const filter = {}
      if (status) filter.status = status
      const claims = await db.collection('facility_claims').find(filter).sort({ createdAt: -1 }).limit(200).toArray()
      return handleCORS(NextResponse.json({ claims: claims.map(clean) }))
    }

    // Admin: approve/reject/request_info/revoke
    if (route.startsWith('/admin/facility-claims/') && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[3]
      const claim = await db.collection('facility_claims').findOne({ id })
      if (!claim) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json()
      const action = body.action || 'update'
      const update = { adminNote: body.adminNote || claim.adminNote || '', reviewedBy: guard.user.id, reviewedAt: new Date(), updatedAt: new Date() }
      if (action === 'approve') {
        update.status = 'approved'
        // Grant ownership: set facility.claimedByUserId, push to user.ownedFacilities, bump verificationLevel
        await db.collection('facilities').updateOne({ id: claim.facilityId }, { $set: { claimedByUserId: claim.userId, claimedAt: new Date(), claimed: true } })
        await db.collection('users').updateOne(
          { id: claim.userId },
          {
            $addToSet: { ownedFacilities: claim.facilityId },
            $set: { verificationLevel: 'verified_facility_owner' },
          }
        )
      } else if (action === 'reject') {
        update.status = 'rejected'
      } else if (action === 'needs_more_info') {
        update.status = 'needs_more_info'
      } else if (action === 'revoke') {
        update.status = 'revoked'
        // Strip ownership
        await db.collection('facilities').updateOne({ id: claim.facilityId }, { $unset: { claimedByUserId: '', claimedAt: '' }, $set: { claimed: false } })
        await db.collection('users').updateOne({ id: claim.userId }, { $pull: { ownedFacilities: claim.facilityId } })
      }
      await db.collection('facility_claims').updateOne({ id }, { $set: update })
      const fresh = await db.collection('facility_claims').findOne({ id })
      await logActivity(db, guard.user, `facility_claim.${action}`, { kind: 'facility_claim', id, label: claim.facilityName }, body)
      return handleCORS(NextResponse.json({ claim: clean(fresh) }))
    }

    // OWNER: post an official facility update (creates an alert tagged as official)
    if (route.match(/^\/facilities\/[^/]+\/owner-updates$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Login required' }, { status: 401 }))
      const facilityId = route.split('/')[2]
      const f = await db.collection('facilities').findOne({ id: facilityId })
      if (!f) return handleCORS(NextResponse.json({ error: 'Facility not found' }, { status: 404 }))
      if (f.claimedByUserId !== auth.id && !isStaff(auth.role)) {
        return handleCORS(NextResponse.json({ error: 'Only the verified owner or staff may post official updates' }, { status: 403 }))
      }
      const body = await request.json()
      const alert = {
        id: uuidv4(),
        facilityId,
        userId: auth.id,
        type: body.type || 'OWNER_UPDATE',
        text: body.text || body.message || '',
        message: body.message || body.text || '',
        official: true,
        pinned: !!body.pinned,
        status: 'active',
        adminVerified: isStaff(auth.role),
        createdAt: new Date(),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 24 * 3600 * 1000),
      }
      await db.collection('alerts').insertOne(alert)
      return handleCORS(NextResponse.json({ alert: clean(alert) }))
    }
    // ============================================================
    // ================ PAYMENT SETTINGS (Stripe) =================
    // Super_admin only. Secret keys masked in GET response.
    // No live processing happens here — this only stores config.
    // ============================================================
    function maskSecret(v) {
      if (!v || typeof v !== 'string' || v.length < 8) return v ? '••••••••' : ''
      return v.slice(0, 7) + '••••••••' + v.slice(-4)
    }
    async function getPaymentSettings(db) {
      const existing = await db.collection('payment_settings').findOne({ id: 'singleton' })
      const defaults = {
        id: 'singleton',
        provider: 'stripe',
        mode: 'test',                // 'test' | 'live'
        stripePublishableKey: '',
        stripeSecretKey: '',
        stripeWebhookSecret: '',
        platformFeePercent: 5,
        payoutsEnabled: false,
        marketplacePaymentsEnabled: false,
        jobsPaymentsEnabled: false,
        donationsEnabled: false,
        currency: 'usd',
        statementDescriptor: 'DUMPMAPS',
        configured: false,
        updatedAt: new Date(),
      }
      if (!existing) {
        await db.collection('payment_settings').insertOne({ ...defaults })
        return defaults
      }
      return { ...defaults, ...existing }
    }
    function isConfigured(s) {
      return !!(s.stripePublishableKey && s.stripeSecretKey)
    }

    if (route === '/admin/payment-settings' && method === 'GET') {
      const guard = await requireStaff(request, db, 'super_admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const s = await getPaymentSettings(db)
      // Mask secret keys for transport even to super_admin (display purposes)
      const out = clean({
        ...s,
        stripeSecretKey: s.stripeSecretKey ? maskSecret(s.stripeSecretKey) : '',
        stripeWebhookSecret: s.stripeWebhookSecret ? maskSecret(s.stripeWebhookSecret) : '',
        configured: isConfigured(s),
        publishableKeyLast4: s.stripePublishableKey ? s.stripePublishableKey.slice(-6) : '',
        hasSecretKey: !!s.stripeSecretKey,
        hasWebhookSecret: !!s.stripeWebhookSecret,
      })
      return handleCORS(NextResponse.json({ settings: out }))
    }

    if (route === '/admin/payment-settings' && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'super_admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const existing = await getPaymentSettings(db)
      const update = { updatedAt: new Date(), updatedBy: guard.user.id }
      const stringKeys = ['provider', 'mode', 'currency', 'statementDescriptor']
      for (const k of stringKeys) if (body[k] !== undefined) update[k] = String(body[k])
      const boolKeys = ['payoutsEnabled', 'marketplacePaymentsEnabled', 'jobsPaymentsEnabled', 'donationsEnabled']
      for (const k of boolKeys) if (body[k] !== undefined) update[k] = !!body[k]
      if (body.platformFeePercent !== undefined) {
        const n = Number(body.platformFeePercent)
        if (isNaN(n) || n < 0 || n > 50) return handleCORS(NextResponse.json({ error: 'Fee must be 0-50%' }, { status: 400 }))
        update.platformFeePercent = n
      }
      // Stripe keys — only update if the body explicitly sends a non-mask value
      const isMasked = (v) => typeof v === 'string' && v.includes('••')
      if (body.stripePublishableKey !== undefined && !isMasked(body.stripePublishableKey)) {
        update.stripePublishableKey = String(body.stripePublishableKey).trim()
      }
      if (body.stripeSecretKey !== undefined && !isMasked(body.stripeSecretKey)) {
        update.stripeSecretKey = String(body.stripeSecretKey).trim()
      }
      if (body.stripeWebhookSecret !== undefined && !isMasked(body.stripeWebhookSecret)) {
        update.stripeWebhookSecret = String(body.stripeWebhookSecret).trim()
      }
      // Clear option (explicit "")
      if (body.clearStripeSecretKey === true) update.stripeSecretKey = ''
      if (body.clearStripeWebhookSecret === true) update.stripeWebhookSecret = ''
      if (body.clearStripePublishableKey === true) update.stripePublishableKey = ''

      await db.collection('payment_settings').updateOne({ id: 'singleton' }, { $set: update }, { upsert: true })
      const fresh = await getPaymentSettings(db)
      // also sync platform_settings.modules.paymentsEnabled when configured + at least one module on
      const anyModuleOn = fresh.marketplacePaymentsEnabled || fresh.jobsPaymentsEnabled || fresh.donationsEnabled
      const cfg = isConfigured(fresh)
      await db.collection('platform_settings').updateOne(
        { id: 'singleton' },
        { $set: { 'modules.paymentsEnabled': !!(cfg && anyModuleOn), updatedAt: new Date() } },
        { upsert: true }
      )
      await logActivity(db, guard.user, 'payment_settings.update', { kind: 'payment_settings', id: 'singleton', label: 'payments' }, { fields: Object.keys(update) })
      // Return masked response
      const safe = clean({
        ...fresh,
        stripeSecretKey: fresh.stripeSecretKey ? maskSecret(fresh.stripeSecretKey) : '',
        stripeWebhookSecret: fresh.stripeWebhookSecret ? maskSecret(fresh.stripeWebhookSecret) : '',
        configured: cfg,
        publishableKeyLast4: fresh.stripePublishableKey ? fresh.stripePublishableKey.slice(-6) : '',
        hasSecretKey: !!fresh.stripeSecretKey,
        hasWebhookSecret: !!fresh.stripeWebhookSecret,
      })
      return handleCORS(NextResponse.json({ settings: safe }))
    }

    // Public read of payment status (only safe fields — no keys)
    if (route === '/payment-settings/public' && method === 'GET') {
      const s = await getPaymentSettings(db)
      const cfg = isConfigured(s)
      return handleCORS(NextResponse.json({
        settings: {
          configured: cfg,
          mode: s.mode,
          stripePublishableKey: cfg ? s.stripePublishableKey : '', // safe to expose publishable
          currency: s.currency,
          platformFeePercent: s.platformFeePercent,
          marketplacePaymentsEnabled: !!(cfg && s.marketplacePaymentsEnabled),
          jobsPaymentsEnabled: !!(cfg && s.jobsPaymentsEnabled),
          donationsEnabled: !!(cfg && s.donationsEnabled),
        },
      }))
    }

    // ============================================================
    // ============ PAYMENT HEALTH DASHBOARD (P2) =================
    // Read-only diagnostic surface for super-admins. Does NOT
    // process real payments — only inspects stored config +
    // historical donations + future webhook log + reports
    // failures via /test-connection and /verify-setup endpoints.
    // ============================================================

    if (route === '/admin/payment-health' && method === 'GET') {
      const guard = await requireStaff(request, db, 'super_admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const s = await getPaymentSettings(db)
      const cfg = isConfigured(s)

      // Donations (real revenue once Stripe is wired up)
      const [donations, intents] = await Promise.all([
        db.collection('donations').find({}).sort({ createdAt: -1 }).limit(1000).toArray().catch(() => []),
        db.collection('donation_intents').find({}).sort({ createdAt: -1 }).limit(1000).toArray().catch(() => []),
      ])

      // Marketplace + job payment volume (read from existing collections if present)
      const [mpVolume, jobVolume] = await Promise.all([
        db.collection('marketplace_orders').aggregate([
          { $match: { status: { $in: ['paid', 'completed'] } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]).toArray().catch(() => []),
        db.collection('job_payments').aggregate([
          { $match: { status: { $in: ['paid', 'completed'] } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]).toArray().catch(() => []),
      ])

      // Webhook event log (collection may not exist yet — that's fine)
      const [lastWebhook, failedWebhookCount, lastFailedWebhook] = await Promise.all([
        db.collection('stripe_webhook_events').find({}).sort({ receivedAt: -1 }).limit(1).toArray().catch(() => []),
        db.collection('stripe_webhook_events').countDocuments({ status: 'failed' }).catch(() => 0),
        db.collection('stripe_webhook_events').find({ status: 'failed' }).sort({ receivedAt: -1 }).limit(1).toArray().catch(() => []),
      ])

      // Failed donation intents (those queued because Stripe was off → after Stripe live, those that errored)
      const failedTransactionCount = await db.collection('donation_intents').countDocuments({ status: 'failed' }).catch(() => 0)

      // Aggregate metrics
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const yearStart = new Date(now.getFullYear(), 0, 1)
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      const totalDonationAmount = donations.reduce((s, d) => s + (Number(d.amount) || 0), 0)
      const thisMonthDonations = donations.filter((d) => new Date(d.createdAt) >= monthStart)
      const thisMonthAmount = thisMonthDonations.reduce((s, d) => s + (Number(d.amount) || 0), 0)
      const ytdAmount = donations.filter((d) => new Date(d.createdAt) >= yearStart).reduce((s, d) => s + (Number(d.amount) || 0), 0)
      const lastDonation = donations[0] || null
      const largestDonation = donations.reduce((max, d) => (Number(d.amount) > (max?.amount || 0) ? d : max), null)
      const averageDonation = donations.length ? totalDonationAmount / donations.length : 0
      const uniqueDonors = new Set(donations.map((d) => (d.email || '').toLowerCase()).filter(Boolean)).size
      const activeDonors90d = new Set(donations.filter((d) => new Date(d.createdAt) >= ninetyDaysAgo).map((d) => (d.email || '').toLowerCase()).filter(Boolean)).size

      // Goals (from payment_settings or sensible defaults)
      const monthlyGoal = Number(s.monthlyDonationGoal) || 5000
      const yearlyGoal = Number(s.yearlyDonationGoal) || 60000

      return handleCORS(NextResponse.json({
        stripe: {
          status: cfg ? 'connected' : 'disconnected',
          environment: s.mode || 'test',
          provider: 'stripe',
          configured: cfg,
          hasPublishableKey: !!s.stripePublishableKey,
          hasSecretKey: !!s.stripeSecretKey,
          hasWebhookSecret: !!s.stripeWebhookSecret,
          publishableKeyLast4: s.stripePublishableKey ? s.stripePublishableKey.slice(-6) : '',
        },
        webhooks: {
          lastReceivedAt: lastWebhook?.[0]?.receivedAt || null,
          lastReceivedType: lastWebhook?.[0]?.type || null,
          failedCount: failedWebhookCount,
          lastFailed: lastFailedWebhook?.[0] ? clean(lastFailedWebhook[0]) : null,
        },
        donations: {
          lifetimeAmount: totalDonationAmount,
          lifetimeCount: donations.length,
          thisMonthAmount,
          thisMonthCount: thisMonthDonations.length,
          ytdAmount,
          activeDonors90d,
          uniqueDonors,
          largestDonation: largestDonation ? { amount: largestDonation.amount, email: largestDonation.email, createdAt: largestDonation.createdAt } : null,
          averageDonation,
          lastDonation: lastDonation ? clean(lastDonation) : null,
          intentCount: intents.length,
          monthlyGoal,
          yearlyGoal,
          monthlyProgressPercent: monthlyGoal > 0 ? Math.min(100, Math.round((thisMonthAmount / monthlyGoal) * 100)) : 0,
          yearlyProgressPercent: yearlyGoal > 0 ? Math.min(100, Math.round((ytdAmount / yearlyGoal) * 100)) : 0,
        },
        marketplace: {
          volume: mpVolume?.[0]?.total || 0,
          count: mpVolume?.[0]?.count || 0,
        },
        jobs: {
          volume: jobVolume?.[0]?.total || 0,
          count: jobVolume?.[0]?.count || 0,
        },
        failures: {
          failedTransactions: failedTransactionCount,
          failedWebhooks: failedWebhookCount,
        },
        lastStripeSyncAt: s.lastStripeSyncAt || null,
      }))
    }

    // Run a live Stripe API ping using the stored secret key. Currently this is
    // a SCAFFOLD — we do not import the Stripe SDK yet (waiting on real keys).
    // The endpoint returns a structured response that the dashboard renders.
    if (route === '/admin/payment-health/test-connection' && method === 'POST') {
      const guard = await requireStaff(request, db, 'super_admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const s = await getPaymentSettings(db)
      const startedAt = Date.now()

      // 1) No secret key → cannot test
      if (!s.stripeSecretKey) {
        return handleCORS(NextResponse.json({
          ok: false,
          status: 'no_key',
          message: 'Stripe Secret Key is not configured. Add a key in the section above before running a connection test.',
          checkedAt: new Date(),
          durationMs: Date.now() - startedAt,
        }))
      }

      // 2) Secret key exists but shape is wrong (defensive heuristic)
      const keyPrefix = s.stripeSecretKey.slice(0, 8)
      const looksValidShape = /^sk_(test|live)_/.test(s.stripeSecretKey)
      if (!looksValidShape) {
        return handleCORS(NextResponse.json({
          ok: false,
          status: 'invalid_shape',
          message: `Secret key shape looks wrong (got "${keyPrefix}…"). Expected to start with sk_test_ or sk_live_.`,
          checkedAt: new Date(),
          durationMs: Date.now() - startedAt,
        }))
      }

      // 3) REAL Stripe SDK round-trip — calls stripe.balance.retrieve() to
      //    verify the key works against Stripe's API. Returns the live
      //    account environment and account ID for the dashboard.
      try {
        const { default: Stripe } = await import('stripe')
        const stripe = new Stripe(s.stripeSecretKey, { apiVersion: '2024-12-18.acacia' })
        const [balance, account] = await Promise.all([
          stripe.balance.retrieve(),
          stripe.accounts.retrieve().catch(() => null),
        ])
        await db.collection('payment_settings').updateOne(
          { id: 'singleton' },
          { $set: { lastStripeSyncAt: new Date() } }
        )
        return handleCORS(NextResponse.json({
          ok: true,
          status: 'connected',
          message: `Connected to Stripe in ${balance.livemode ? 'LIVE' : 'TEST'} mode${account?.business_profile?.name ? ` as "${account.business_profile.name}"` : ''}.`,
          keyEnvironment: balance.livemode ? 'live' : 'test',
          accountId: account?.id || null,
          accountCountry: account?.country || null,
          chargesEnabled: account?.charges_enabled ?? null,
          payoutsEnabled: account?.payouts_enabled ?? null,
          availableBalance: balance.available?.[0] ? { amount: balance.available[0].amount, currency: balance.available[0].currency } : null,
          pendingBalance: balance.pending?.[0] ? { amount: balance.pending[0].amount, currency: balance.pending[0].currency } : null,
          checkedAt: new Date(),
          durationMs: Date.now() - startedAt,
        }))
      } catch (e) {
        // Surface Stripe's error message verbatim — admins need to see it.
        const message = e?.raw?.message || e?.message || 'Unknown Stripe SDK error'
        const code = e?.code || e?.type || 'sdk_error'
        return handleCORS(NextResponse.json({
          ok: false,
          status: 'stripe_error',
          message: `Stripe API call failed: ${message}`,
          errorCode: code,
          keyEnvironment: s.stripeSecretKey.startsWith('sk_live_') ? 'live' : 'test',
          checkedAt: new Date(),
          durationMs: Date.now() - startedAt,
        }))
      }
    }

    // Per-key verification: returns shape / presence diagnostic per key.
    if (route === '/admin/payment-health/verify-setup' && method === 'POST') {
      const guard = await requireStaff(request, db, 'super_admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const s = await getPaymentSettings(db)
      const checks = [
        {
          key: 'publishable',
          label: 'Publishable Key',
          present: !!s.stripePublishableKey,
          shape: s.stripePublishableKey ? /^pk_(test|live)_/.test(s.stripePublishableKey) : null,
          environment: s.stripePublishableKey?.startsWith('pk_live_') ? 'live'
                      : s.stripePublishableKey?.startsWith('pk_test_') ? 'test' : null,
          ok: !!s.stripePublishableKey && /^pk_(test|live)_/.test(s.stripePublishableKey),
        },
        {
          key: 'secret',
          label: 'Secret Key',
          present: !!s.stripeSecretKey,
          shape: s.stripeSecretKey ? /^sk_(test|live)_/.test(s.stripeSecretKey) : null,
          environment: s.stripeSecretKey?.startsWith('sk_live_') ? 'live'
                      : s.stripeSecretKey?.startsWith('sk_test_') ? 'test' : null,
          ok: !!s.stripeSecretKey && /^sk_(test|live)_/.test(s.stripeSecretKey),
        },
        {
          key: 'webhook',
          label: 'Webhook Signing Secret',
          present: !!s.stripeWebhookSecret,
          shape: s.stripeWebhookSecret ? /^whsec_/.test(s.stripeWebhookSecret) : null,
          environment: null,
          ok: !!s.stripeWebhookSecret && /^whsec_/.test(s.stripeWebhookSecret),
        },
      ]
      // Environment mismatch warning
      const pkEnv = checks[0].environment
      const skEnv = checks[1].environment
      const envMismatch = pkEnv && skEnv && pkEnv !== skEnv
      return handleCORS(NextResponse.json({
        checks,
        allOk: checks.every((c) => c.ok),
        anyMissing: checks.some((c) => !c.present),
        environmentMismatch: envMismatch,
        currentMode: s.mode || 'test',
        checkedAt: new Date(),
      }))
    }

    // Sync historical Stripe events into DumpMaps donations
    // ---------------------------------------------------------------------
    // Super-admin only. Pulls completed Checkout Sessions + recent webhook
    // events directly from the Stripe API and back-fills any donations
    // that DumpMaps missed (e.g., due to webhook downtime, prior bugs,
    // or Stripe Dashboard "Send test event" flows). Idempotent — replays
    // are safe because we upsert on stripeCheckoutSessionId.
    //
    // POST body (all optional):
    //   { lookbackDays?: number   // default 30, max 90
    //     dryRun?: boolean        // default false; preview-only
    //   }
    if (route === '/admin/payment-health/sync-from-stripe' && method === 'POST') {
      const guard = await requireStaff(request, db, 'super_admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const startedAt = Date.now()
      const s = await getPaymentSettings(db)
      if (!s.stripeSecretKey) {
        return handleCORS(NextResponse.json({
          ok: false,
          status: 'no_key',
          message: 'Stripe Secret Key not configured. Cannot sync.',
        }, { status: 400 }))
      }

      const body = await request.json().catch(() => ({}))
      const lookbackDays = Math.min(Math.max(Number(body.lookbackDays) || 30, 1), 90)
      const dryRun = !!body.dryRun
      const sinceUnix = Math.floor((Date.now() - lookbackDays * 24 * 60 * 60 * 1000) / 1000)

      let stripe
      try {
        const { default: Stripe } = await import('stripe')
        stripe = new Stripe(s.stripeSecretKey, { apiVersion: '2024-12-18.acacia' })
      } catch (e) {
        return handleCORS(NextResponse.json({ ok: false, status: 'sdk_error', message: e?.message || 'Failed to init Stripe SDK' }, { status: 500 }))
      }

      const result = {
        ok: true,
        dryRun,
        lookbackDays,
        scannedSessions: 0,
        newDonations: 0,
        alreadyRecorded: 0,
        updatedExisting: 0,
        skippedIncomplete: 0,
        errors: [],
        details: [],
      }

      try {
        // Paginate through completed checkout sessions from the last N days.
        // Stripe caps per_page at 100 — auto_pagination via `for await`.
        const params = {
          limit: 100,
          created: { gte: sinceUnix },
          expand: ['data.payment_intent', 'data.customer_details'],
        }
        // eslint-disable-next-line no-restricted-syntax
        for await (const session of stripe.checkout.sessions.list(params)) {
          // Only count successful, payment-mode (one-time) or subscription sessions
          if (session.status !== 'complete' && session.payment_status !== 'paid') {
            result.skippedIncomplete += 1
            continue
          }
          result.scannedSessions += 1

          const existing = await db.collection('donations').findOne({ stripeCheckoutSessionId: session.id })
          if (existing) {
            result.alreadyRecorded += 1
            continue
          }

          if (dryRun) {
            result.newDonations += 1
            result.details.push({
              sessionId: session.id,
              amount: (session.amount_total || 0) / 100,
              email: session.customer_details?.email || session.customer_email || null,
              wouldInsert: true,
            })
            continue
          }

          // Look up matching intent if metadata points to one
          const intentIdStr =
            session.metadata?.donation_intent_id ||
            session.metadata?.intentId ||
            session.client_reference_id ||
            null
          const intentDoc = intentIdStr
            ? await db.collection('donation_intents').findOne({ id: intentIdStr })
            : null

          const email =
            (session.customer_details?.email || session.customer_email || session.metadata?.email || intentDoc?.email || '').toLowerCase() || null
          const name =
            session.metadata?.name || session.customer_details?.name || intentDoc?.name || ''
          const amount =
            session.amount_total != null
              ? Math.round(session.amount_total) / 100
              : Number(intentDoc?.amount) || 0
          const paymentIntentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id || null
          const customerId =
            typeof session.customer === 'string' ? session.customer : session.customer?.id || null

          await db.collection('donations').updateOne(
            { stripeCheckoutSessionId: session.id },
            {
              $setOnInsert: { id: uuidv4(), createdAt: session.created ? new Date(session.created * 1000) : new Date(), provider: 'stripe' },
              $set: {
                email, name, amount,
                currency: (session.currency || intentDoc?.currency || 'usd').toLowerCase(),
                tier: session.metadata?.tier || intentDoc?.tier || '',
                message: session.metadata?.message || intentDoc?.message || '',
                recurring: session.mode === 'subscription',
                userId: session.metadata?.userId || intentDoc?.userId || null,
                donationIntentId: intentIdStr,
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: paymentIntentId,
                stripeSubscriptionId: session.subscription || null,
                stripeCustomerId: customerId,
                status: 'succeeded',
                livemode: !!session.livemode,
                updatedAt: new Date(),
                backfilledFromStripeAt: new Date(),
                backfilledBy: guard.user?.email || 'admin',
              },
            },
            { upsert: true }
          )
          result.newDonations += 1

          // Mark intent converted if applicable
          if (intentDoc) {
            await db.collection('donation_intents').updateOne(
              { id: intentDoc.id },
              { $set: {
                  status: 'succeeded',
                  convertedStatus: 'paid',
                  stripeCheckoutSessionId: session.id,
                  stripePaymentIntentId: paymentIntentId,
                  convertedAt: new Date(),
                  updatedAt: new Date(),
                } }
            )
            result.updatedExisting += 1
          }

          result.details.push({
            sessionId: session.id,
            amount,
            email,
            paymentIntentId,
            backfilled: true,
          })
        }

        // Log the sync action for audit
        if (!dryRun) {
          await db.collection('payment_settings').updateOne(
            { id: 'singleton' },
            { $set: { lastStripeSyncAt: new Date(), lastStripeSyncBy: guard.user?.email || 'admin', lastStripeSyncResult: { scannedSessions: result.scannedSessions, newDonations: result.newDonations, alreadyRecorded: result.alreadyRecorded } } }
          )
        }
      } catch (e) {
        result.ok = false
        result.errors.push({ message: e?.raw?.message || e?.message || 'Unknown Stripe API error', code: e?.code || e?.type || 'stripe_error' })
      }

      result.durationMs = Date.now() - startedAt
      result.checkedAt = new Date()
      // Cap details to first 50 to keep response light
      result.details = result.details.slice(0, 50)
      return handleCORS(NextResponse.json(result))
    }

    // Update donation goals
    if (route === '/admin/payment-health/goals' && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'super_admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const update = { updatedAt: new Date() }
      if (body.monthlyDonationGoal !== undefined) {
        const n = Number(body.monthlyDonationGoal)
        if (isNaN(n) || n < 0) return handleCORS(NextResponse.json({ error: 'Monthly goal must be ≥ 0' }, { status: 400 }))
        update.monthlyDonationGoal = n
      }
      if (body.yearlyDonationGoal !== undefined) {
        const n = Number(body.yearlyDonationGoal)
        if (isNaN(n) || n < 0) return handleCORS(NextResponse.json({ error: 'Yearly goal must be ≥ 0' }, { status: 400 }))
        update.yearlyDonationGoal = n
      }
      await db.collection('payment_settings').updateOne({ id: 'singleton' }, { $set: update }, { upsert: true })
      return handleCORS(NextResponse.json({ ok: true, ...update }))
    }


    // ============================================================
    // ================ COMMUNITY MVP =============================
    // Operational hyper-local board: cleanup / hauling / reuse /
    // contractor coordination — NOT generic social media.
    // ============================================================

    // List posts with filters
    if (route === '/community/posts' && method === 'GET') {
      const auth = getAuth(request)
      const params = url.searchParams
      const category = params.get('category') || ''
      const q = params.get('q') || ''
      const mine = params.get('mine') === 'true'
      const urgency = params.get('urgency') || ''
      const official = params.get('official') === 'true'
      const sort = params.get('sort') || 'new'
      const limit = Math.min(parseInt(params.get('limit') || '50', 10), 200)
      const lat = parseFloat(params.get('lat') || 'NaN')
      const lng = parseFloat(params.get('lng') || 'NaN')
      const maxKm = parseFloat(params.get('maxKm') || 'NaN')
      const filter = { status: { $ne: 'removed' } }
      if (category) filter.category = category
      if (urgency) filter.urgency = urgency
      if (official) filter.isOfficial = true
      if (mine) {
        if (!auth) return handleCORS(NextResponse.json({ posts: [] }))
        filter.authorId = auth.id
      }
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        filter.$or = [{ title: rx }, { body: rx }, { tags: rx }, { city: rx }]
      }
      let posts = await db.collection('community_posts').find(filter).limit(limit * 2).toArray()
      // distance enrichment
      if (!isNaN(lat) && !isNaN(lng)) {
        posts = posts.map((p) => ({ ...p, distanceKm: (p.lat && p.lng) ? distanceKm(lat, lng, p.lat, p.lng) : null }))
        if (!isNaN(maxKm)) posts = posts.filter((p) => p.distanceKm == null || p.distanceKm <= maxKm)
      }
      // sort
      if (sort === 'top') {
        posts.sort((a, b) => ((b.reactionCount || 0) + (b.commentCount || 0)) - ((a.reactionCount || 0) + (a.commentCount || 0)))
      } else {
        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      }
      posts = posts.slice(0, limit)
      // enrich author
      const authorIds = [...new Set(posts.map((p) => p.authorId).filter(Boolean))]
      const authors = await db.collection('users').find({ id: { $in: authorIds } }).toArray()
      // ----- Resolve a community profile type, with legacy fallback -----
      const resolvePT = (u) => {
        if (!u) return 'resident'
        if (u.communityProfileType) return u.communityProfileType
        const legacy = u.primaryProfile || (Array.isArray(u.profileTypes) ? u.profileTypes[0] : '') || ''
        const map = { hauler: 'hauler', contractor: 'contractor', recycler: 'recycler', donor: 'volunteer', facility_owner: 'facility_owner', normal_user: 'resident' }
        return map[legacy] || u.accountType || 'resident'
      }
      const aMap = Object.fromEntries(authors.map((u) => [u.id, { id: u.id, name: u.name || u.email?.split('@')[0], profileType: resolvePT(u), verificationLevel: u.verificationLevel || 'normal_user', role: u.role || 'normal_user' }]))
      // my reactions
      const myReactions = {}
      if (auth) {
        const rxs = await db.collection('community_reactions').find({ userId: auth.id, targetKind: 'post', targetId: { $in: posts.map((p) => p.id) } }).toArray()
        for (const r of rxs) myReactions[r.targetId] = r.type
      }
      const out = posts.map((p) => ({ ...clean(p), author: aMap[p.authorId] || null, myReaction: myReactions[p.id] || null }))
      return handleCORS(NextResponse.json({ posts: out }))
    }

    // Trending (last 7d) - top 10
    if (route === '/community/trending' && method === 'GET') {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000)
      const posts = await db.collection('community_posts').find({ status: { $ne: 'removed' }, createdAt: { $gte: since } }).toArray()
      posts.sort((a, b) => ((b.reactionCount || 0) * 2 + (b.commentCount || 0) * 3 + (b.viewCount || 0)) - ((a.reactionCount || 0) * 2 + (a.commentCount || 0) * 3 + (a.viewCount || 0)))
      return handleCORS(NextResponse.json({ posts: posts.slice(0, 10).map(clean) }))
    }

    // Create post
    if (route === '/community/posts' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Login required to post' }, { status: 401 }))
      const body = await request.json()
      if (!body.title || !body.category) return handleCORS(NextResponse.json({ error: 'title and category required' }, { status: 400 }))
      // Agency notice can only be posted by staff or users flagged as agency
      if (body.category === 'agency_notice') {
        const u = await db.collection('users').findOne({ id: auth.id })
        const isAgency = u?.communityProfileType === 'agency' || u?.isAgency === true || isStaff(auth.role)
        if (!isAgency) return handleCORS(NextResponse.json({ error: 'Only verified agencies or staff may post agency notices' }, { status: 403 }))
      }
      const post = {
        id: uuidv4(),
        authorId: auth.id,
        category: body.category,
        title: String(body.title).slice(0, 160),
        body: String(body.body || '').slice(0, 4000),
        photos: Array.isArray(body.photos) ? body.photos.slice(0, 8) : [],
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 10) : [],
        location: body.location || '',
        city: body.city || '',
        state: body.state || '',
        zip: body.zip || '',
        lat: body.lat ? parseFloat(body.lat) : null,
        lng: body.lng ? parseFloat(body.lng) : null,
        urgency: ['low', 'normal', 'high'].includes(body.urgency) ? body.urgency : 'normal',
        relatedFacilityId: body.relatedFacilityId || null,
        groupId: body.groupId || null,
        isOfficial: isStaff(auth.role) && body.category === 'agency_notice',
        status: 'active',
        reactionCount: 0,
        reactions: {},
        commentCount: 0,
        viewCount: 0,
        reportCount: 0,
        pinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('community_posts').insertOne(post)
      return handleCORS(NextResponse.json({ post: clean(post) }))
    }

    // Get a single post (+ comments) — increments viewCount
    if (route.match(/^\/community\/posts\/[^/]+$/) && method === 'GET') {
      const id = route.split('/')[3]
      const auth = getAuth(request)
      const post = await db.collection('community_posts').findOne({ id })
      if (!post || post.status === 'removed') return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      await db.collection('community_posts').updateOne({ id }, { $inc: { viewCount: 1 } })
      const author = post.authorId ? await db.collection('users').findOne({ id: post.authorId }) : null
      const myReaction = auth ? await db.collection('community_reactions').findOne({ userId: auth.id, targetKind: 'post', targetId: id }) : null
      const comments = await db.collection('community_comments').find({ postId: id, status: { $ne: 'removed' } }).sort({ createdAt: 1 }).toArray()
      const cAuthorIds = [...new Set(comments.map((c) => c.authorId).filter(Boolean))]
      const cAuthors = cAuthorIds.length ? await db.collection('users').find({ id: { $in: cAuthorIds } }).toArray() : []
      const resolvePT2 = (u) => {
        if (!u) return 'resident'
        if (u.communityProfileType) return u.communityProfileType
        const legacy = u.primaryProfile || (Array.isArray(u.profileTypes) ? u.profileTypes[0] : '') || ''
        const map = { hauler: 'hauler', contractor: 'contractor', recycler: 'recycler', donor: 'volunteer', facility_owner: 'facility_owner', normal_user: 'resident' }
        return map[legacy] || u.accountType || 'resident'
      }
      const cMap = Object.fromEntries(cAuthors.map((u) => [u.id, { id: u.id, name: u.name || u.email?.split('@')[0], profileType: resolvePT2(u), verificationLevel: u.verificationLevel || 'normal_user' }]))
      const myCommentRx = {}
      if (auth) {
        const rxs = await db.collection('community_reactions').find({ userId: auth.id, targetKind: 'comment', targetId: { $in: comments.map((c) => c.id) } }).toArray()
        for (const r of rxs) myCommentRx[r.targetId] = r.type
      }
      return handleCORS(NextResponse.json({
        post: {
          ...clean(post),
          viewCount: (post.viewCount || 0) + 1,
          author: author ? { id: author.id, name: author.name || author.email?.split('@')[0], profileType: author.communityProfileType || (author.primaryProfile === 'hauler' ? 'hauler' : author.primaryProfile === 'contractor' ? 'contractor' : author.primaryProfile === 'recycler' ? 'recycler' : author.primaryProfile === 'donor' ? 'volunteer' : author.primaryProfile === 'facility_owner' ? 'facility_owner' : 'resident'), verificationLevel: author.verificationLevel || 'normal_user' } : null,
          myReaction: myReaction?.type || null,
        },
        comments: comments.map((c) => ({ ...clean(c), author: cMap[c.authorId] || null, myReaction: myCommentRx[c.id] || null })),
      }))
    }

    // Edit post (owner or staff)
    if (route.match(/^\/community\/posts\/[^/]+$/) && method === 'PATCH') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[3]
      const post = await db.collection('community_posts').findOne({ id })
      if (!post) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (post.authorId !== auth.id && !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const body = await request.json()
      const allowed = ['title', 'body', 'photos', 'tags', 'location', 'city', 'state', 'zip', 'lat', 'lng', 'urgency', 'status', 'pinned']
      const update = {}
      for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]
      // Only staff can pin / change status to removed
      if (!isStaff(auth.role)) { delete update.pinned; if (update.status === 'removed') delete update.status }
      update.updatedAt = new Date()
      await db.collection('community_posts').updateOne({ id }, { $set: update })
      const fresh = await db.collection('community_posts').findOne({ id })
      return handleCORS(NextResponse.json({ post: clean(fresh) }))
    }

    // Delete (soft) - owner or staff
    if (route.match(/^\/community\/posts\/[^/]+$/) && method === 'DELETE') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[3]
      const post = await db.collection('community_posts').findOne({ id })
      if (!post) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (post.authorId !== auth.id && !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      await db.collection('community_posts').updateOne({ id }, { $set: { status: 'removed', removedAt: new Date(), removedBy: auth.id } })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // React on post (toggle / change)
    if (route.match(/^\/community\/posts\/[^/]+\/react$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[3]
      const body = await request.json()
      const type = body.type
      const valid = ['helpful', 'thanks', 'concern', 'onit', 'fire', 'like']
      const post = await db.collection('community_posts').findOne({ id })
      if (!post) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const existing = await db.collection('community_reactions').findOne({ userId: auth.id, targetKind: 'post', targetId: id })
      if (existing) {
        // Same type → toggle off; different → switch
        if (existing.type === type || !type) {
          await db.collection('community_reactions').deleteOne({ id: existing.id })
          await db.collection('community_posts').updateOne({ id }, { $inc: { reactionCount: -1, [`reactions.${existing.type}`]: -1 } })
          return handleCORS(NextResponse.json({ ok: true, myReaction: null }))
        }
        if (!valid.includes(type)) return handleCORS(NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 }))
        await db.collection('community_reactions').updateOne({ id: existing.id }, { $set: { type, updatedAt: new Date() } })
        await db.collection('community_posts').updateOne({ id }, { $inc: { [`reactions.${existing.type}`]: -1, [`reactions.${type}`]: 1 } })
        return handleCORS(NextResponse.json({ ok: true, myReaction: type }))
      }
      if (!valid.includes(type)) return handleCORS(NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 }))
      await db.collection('community_reactions').insertOne({ id: uuidv4(), userId: auth.id, targetKind: 'post', targetId: id, type, createdAt: new Date() })
      await db.collection('community_posts').updateOne({ id }, { $inc: { reactionCount: 1, [`reactions.${type}`]: 1 } })
      return handleCORS(NextResponse.json({ ok: true, myReaction: type }))
    }

    // Save / unsave (bookmark) a post — toggle.
    // Mirrors the Activity Hub `/api/activity-hub/posts/:id/save` endpoint so
    // the legacy detail page UI keeps working without a code change.
    if (route.match(/^\/community\/posts\/[^/]+\/save$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[3]
      const post = await db.collection('community_posts').findOne({ id })
      if (!post) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const existing = await db.collection('community_saves').findOne({ userId: auth.id, postId: id })
      if (existing) {
        await db.collection('community_saves').deleteOne({ id: existing.id })
        await db.collection('community_posts').updateOne({ id }, { $inc: { saveCount: -1 } })
        return handleCORS(NextResponse.json({ saved: false, saveCount: Math.max(0, (post.saveCount || 1) - 1) }))
      }
      await db.collection('community_saves').insertOne({ id: uuidv4(), userId: auth.id, postId: id, createdAt: new Date() })
      await db.collection('community_posts').updateOne({ id }, { $inc: { saveCount: 1 } })
      return handleCORS(NextResponse.json({ saved: true, saveCount: (post.saveCount || 0) + 1 }))
    }


    // List comments
    if (route.match(/^\/community\/posts\/[^/]+\/comments$/) && method === 'GET') {
      const id = route.split('/')[3]
      const comments = await db.collection('community_comments').find({ postId: id, status: { $ne: 'removed' } }).sort({ createdAt: 1 }).toArray()
      return handleCORS(NextResponse.json({ comments: comments.map(clean) }))
    }

    // Create comment (flat — parentCommentId nullable for future threading)
    if (route.match(/^\/community\/posts\/[^/]+\/comments$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Login required to comment' }, { status: 401 }))
      const postId = route.split('/')[3]
      const post = await db.collection('community_posts').findOne({ id: postId })
      if (!post || post.status === 'removed') return handleCORS(NextResponse.json({ error: 'Post not found' }, { status: 404 }))
      const body = await request.json()
      if (!body.body || !String(body.body).trim()) return handleCORS(NextResponse.json({ error: 'Comment required' }, { status: 400 }))
      const comment = {
        id: uuidv4(),
        postId,
        authorId: auth.id,
        parentCommentId: body.parentCommentId || null,  // future threading
        body: String(body.body).slice(0, 2000),
        photos: Array.isArray(body.photos) ? body.photos.slice(0, 3) : [],
        reactionCount: 0,
        reactions: {},
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('community_comments').insertOne(comment)
      await db.collection('community_posts').updateOne({ id: postId }, { $inc: { commentCount: 1 } })
      const author = await db.collection('users').findOne({ id: auth.id })
      return handleCORS(NextResponse.json({ comment: { ...clean(comment), author: { id: author.id, name: author.name || author.email?.split('@')[0], profileType: author.communityProfileType || (author.primaryProfile === 'hauler' ? 'hauler' : author.primaryProfile === 'contractor' ? 'contractor' : author.primaryProfile === 'recycler' ? 'recycler' : author.primaryProfile === 'donor' ? 'volunteer' : author.primaryProfile === 'facility_owner' ? 'facility_owner' : 'resident'), verificationLevel: author.verificationLevel || 'normal_user' } } }))
    }

    // Delete comment (own or staff)
    if (route.match(/^\/community\/comments\/[^/]+$/) && method === 'DELETE') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[3]
      const c = await db.collection('community_comments').findOne({ id })
      if (!c) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (c.authorId !== auth.id && !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      await db.collection('community_comments').updateOne({ id }, { $set: { status: 'removed', removedAt: new Date() } })
      await db.collection('community_posts').updateOne({ id: c.postId }, { $inc: { commentCount: -1 } })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // Comment reaction
    if (route.match(/^\/community\/comments\/[^/]+\/react$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[3]
      const body = await request.json()
      const type = body.type
      const valid = ['helpful', 'thanks', 'concern', 'onit', 'fire']
      const c = await db.collection('community_comments').findOne({ id })
      if (!c) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const existing = await db.collection('community_reactions').findOne({ userId: auth.id, targetKind: 'comment', targetId: id })
      if (existing) {
        if (existing.type === type || !type) {
          await db.collection('community_reactions').deleteOne({ id: existing.id })
          await db.collection('community_comments').updateOne({ id }, { $inc: { reactionCount: -1, [`reactions.${existing.type}`]: -1 } })
          return handleCORS(NextResponse.json({ ok: true, myReaction: null }))
        }
        if (!valid.includes(type)) return handleCORS(NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 }))
        await db.collection('community_reactions').updateOne({ id: existing.id }, { $set: { type, updatedAt: new Date() } })
        await db.collection('community_comments').updateOne({ id }, { $inc: { [`reactions.${existing.type}`]: -1, [`reactions.${type}`]: 1 } })
        return handleCORS(NextResponse.json({ ok: true, myReaction: type }))
      }
      if (!valid.includes(type)) return handleCORS(NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 }))
      await db.collection('community_reactions').insertOne({ id: uuidv4(), userId: auth.id, targetKind: 'comment', targetId: id, type, createdAt: new Date() })
      await db.collection('community_comments').updateOne({ id }, { $inc: { reactionCount: 1, [`reactions.${type}`]: 1 } })
      return handleCORS(NextResponse.json({ ok: true, myReaction: type }))
    }

    // Admin: list / moderate community posts
    if (route === '/admin/community/posts' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const status = url.searchParams.get('status') || ''
      const filter = {}
      if (status) filter.status = status
      const posts = await db.collection('community_posts').find(filter).sort({ createdAt: -1 }).limit(300).toArray()
      return handleCORS(NextResponse.json({ posts: posts.map(clean) }))
    }

    if (route.match(/^\/admin\/community\/posts\/[^/]+$/) && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[4]
      const body = await request.json()
      const update = { updatedAt: new Date() }
      if (body.action === 'remove') update.status = 'removed'
      else if (body.action === 'restore') update.status = 'active'
      else if (body.action === 'pin') update.pinned = true
      else if (body.action === 'unpin') update.pinned = false
      else if (body.action === 'verify') { update.isOfficial = true; update.adminVerified = true }
      await db.collection('community_posts').updateOne({ id }, { $set: update })
      await logActivity(db, guard.user, `community_post.${body.action}`, { kind: 'community_post', id }, body)
      const fresh = await db.collection('community_posts').findOne({ id })
      return handleCORS(NextResponse.json({ post: clean(fresh) }))
    }

    // ============================================================
    // ================ COMMUNITY GROUPS ==========================
    // Hyper-local groups: South Bay Haulers, Hayward Cleanup Crew, etc.
    // Group organizer is auto-added as group_admin (can kick / pin / edit).
    // ============================================================

    const PREDEFINED_CITIES = [
      { key: 'hayward',      name: 'Hayward',      state: 'CA' },
      { key: 'san_jose',     name: 'San Jose',     state: 'CA' },
      { key: 'milpitas',     name: 'Milpitas',     state: 'CA' },
      { key: 'oakland',      name: 'Oakland',      state: 'CA' },
      { key: 'fremont',      name: 'Fremont',      state: 'CA' },
      { key: 'santa_clara',  name: 'Santa Clara',  state: 'CA' },
      { key: 'gilroy',       name: 'Gilroy',       state: 'CA' },
      { key: 'monterey',     name: 'Monterey',     state: 'CA' },
      { key: 'santa_cruz',   name: 'Santa Cruz',   state: 'CA' },
      { key: 'sacramento',   name: 'Sacramento',   state: 'CA' },
      { key: 'fresno',       name: 'Fresno',       state: 'CA' },
      { key: 'san_francisco',name: 'San Francisco',state: 'CA' },
    ]

    const GROUP_CATEGORIES = [
      { key: 'haulers',      label: 'Haulers' },
      { key: 'cleanup',      label: 'Cleanup Crew' },
      { key: 'reuse',        label: 'Reuse & Free Items' },
      { key: 'contractors',  label: 'Contractors' },
      { key: 'recycling',    label: 'Recycling' },
      { key: 'property',     label: 'Property Mgmt / Realtors' },
      { key: 'scrap',        label: 'Scrap Metal' },
      { key: 'donation',     label: 'Donation Network' },
      { key: 'agency',       label: 'Agency / Public Works' },
      { key: 'general',      label: 'General' },
    ]

    function slugify(s) {
      return String(s).toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60)
    }

    // Cities — counts of active community posts by city (last 30d)
    if (route === '/community/cities' && method === 'GET') {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
      const posts = await db.collection('community_posts').find({ status: { $ne: 'removed' }, createdAt: { $gte: since } }, { projection: { city: 1, category: 1 } }).toArray()
      const groups = await db.collection('community_groups').find({ status: { $ne: 'removed' } }, { projection: { city: 1 } }).toArray()
      const counts = {}
      for (const p of posts) { const k = (p.city || '').trim(); if (!k) continue; counts[k] = counts[k] || { posts: 0, groups: 0 }; counts[k].posts += 1 }
      for (const g of groups) { const k = (g.city || '').trim(); if (!k) continue; counts[k] = counts[k] || { posts: 0, groups: 0 }; counts[k].groups += 1 }
      const out = PREDEFINED_CITIES.map((c) => ({ ...c, posts: counts[c.name]?.posts || 0, groups: counts[c.name]?.groups || 0 }))
      // also include any user-submitted cities not in predefined list
      const extra = []
      for (const cityName of Object.keys(counts)) {
        if (!out.find((x) => x.name.toLowerCase() === cityName.toLowerCase())) {
          extra.push({ key: slugify(cityName), name: cityName, state: 'CA', posts: counts[cityName].posts, groups: counts[cityName].groups, custom: true })
        }
      }
      return handleCORS(NextResponse.json({ cities: [...out, ...extra].sort((a, b) => (b.posts + b.groups * 2) - (a.posts + a.groups * 2)) }))
    }

    // List groups
    if (route === '/community/groups' && method === 'GET') {
      const auth = getAuth(request)
      const params = url.searchParams
      const city = params.get('city') || ''
      const category = params.get('category') || ''
      const q = params.get('q') || ''
      const mine = params.get('mine') === 'true'
      const limit = Math.min(parseInt(params.get('limit') || '50', 10), 200)
      const filter = { status: { $ne: 'removed' } }
      if (city) filter.city = new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      if (category) filter.category = category
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        filter.$or = [{ name: rx }, { description: rx }, { tags: rx }]
      }
      let groups = await db.collection('community_groups').find(filter).sort({ memberCount: -1, createdAt: -1 }).limit(limit).toArray()
      if (mine && auth) {
        const memberships = await db.collection('community_group_members').find({ userId: auth.id }).toArray()
        const ids = new Set(memberships.map((m) => m.groupId))
        groups = groups.filter((g) => ids.has(g.id))
      }
      // enrich myMembership
      let myMap = {}
      if (auth) {
        const ms = await db.collection('community_group_members').find({ userId: auth.id, groupId: { $in: groups.map((g) => g.id) } }).toArray()
        myMap = Object.fromEntries(ms.map((m) => [m.groupId, m.role]))
      }
      return handleCORS(NextResponse.json({ groups: groups.map((g) => ({ ...clean(g), myRole: myMap[g.id] || null })) }))
    }

    // Create group
    if (route === '/community/groups' && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Login required' }, { status: 401 }))
      const body = await request.json()
      if (!body.name || !body.category) return handleCORS(NextResponse.json({ error: 'name and category required' }, { status: 400 }))
      if (!GROUP_CATEGORIES.find((c) => c.key === body.category)) return handleCORS(NextResponse.json({ error: 'Invalid category' }, { status: 400 }))
      const slug = slugify(body.name)
      // ensure slug uniqueness
      let uniqueSlug = slug
      let n = 1
      while (await db.collection('community_groups').findOne({ slug: uniqueSlug })) {
        uniqueSlug = `${slug}-${n++}`
        if (n > 50) break
      }
      const group = {
        id: uuidv4(),
        slug: uniqueSlug,
        name: String(body.name).slice(0, 80),
        description: String(body.description || '').slice(0, 1000),
        category: body.category,
        city: body.city || '',
        state: body.state || 'CA',
        photoUrl: body.photoUrl || '',
        bannerUrl: body.bannerUrl || '',
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 10) : [],
        isPublic: body.isPublic !== false,
        ownerId: auth.id,
        memberCount: 1,
        postCount: 0,
        status: 'active',
        rules: Array.isArray(body.rules) ? body.rules.slice(0, 10).map(String) : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('community_groups').insertOne(group)
      // owner becomes group_admin
      await db.collection('community_group_members').insertOne({
        id: uuidv4(),
        groupId: group.id,
        userId: auth.id,
        role: 'group_admin',
        joinedAt: new Date(),
      })
      return handleCORS(NextResponse.json({ group: { ...clean(group), myRole: 'group_admin' } }))
    }

    // Group detail (by id or slug)
    if (route.match(/^\/community\/groups\/[^/]+$/) && method === 'GET') {
      const key = route.split('/')[3]
      const auth = getAuth(request)
      const group = await db.collection('community_groups').findOne({ $or: [{ id: key }, { slug: key }] })
      if (!group || group.status === 'removed') return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const owner = await db.collection('users').findOne({ id: group.ownerId })
      const myMembership = auth ? await db.collection('community_group_members').findOne({ groupId: group.id, userId: auth.id }) : null
      const recentMembers = await db.collection('community_group_members').find({ groupId: group.id }).sort({ joinedAt: -1 }).limit(8).toArray()
      const mUsers = recentMembers.length ? await db.collection('users').find({ id: { $in: recentMembers.map((m) => m.userId) } }).toArray() : []
      const uMap = Object.fromEntries(mUsers.map((u) => [u.id, { id: u.id, name: u.name || u.email?.split('@')[0], communityProfileType: u.communityProfileType, primaryProfile: u.primaryProfile, profileTypes: u.profileTypes, verificationLevel: u.verificationLevel }]))
      return handleCORS(NextResponse.json({
        group: {
          ...clean(group),
          owner: owner ? { id: owner.id, name: owner.name || owner.email?.split('@')[0] } : null,
          myRole: myMembership?.role || null,
          recentMembers: recentMembers.map((m) => ({ ...uMap[m.userId], role: m.role, joinedAt: m.joinedAt })).filter(Boolean),
        },
      }))
    }

    // Update group (owner / group_admin / platform staff)
    if (route.match(/^\/community\/groups\/[^/]+$/) && method === 'PATCH') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[3]
      const group = await db.collection('community_groups').findOne({ $or: [{ id }, { slug: id }] })
      if (!group) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const my = await db.collection('community_group_members').findOne({ groupId: group.id, userId: auth.id })
      const canEdit = group.ownerId === auth.id || my?.role === 'group_admin' || isStaff(auth.role)
      if (!canEdit) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const body = await request.json()
      const allowed = ['name', 'description', 'category', 'city', 'state', 'photoUrl', 'bannerUrl', 'tags', 'isPublic', 'rules']
      const update = {}
      for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]
      update.updatedAt = new Date()
      await db.collection('community_groups').updateOne({ id: group.id }, { $set: update })
      const fresh = await db.collection('community_groups').findOne({ id: group.id })
      return handleCORS(NextResponse.json({ group: clean(fresh) }))
    }

    // Delete group (owner or staff)
    if (route.match(/^\/community\/groups\/[^/]+$/) && method === 'DELETE') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[3]
      const group = await db.collection('community_groups').findOne({ $or: [{ id }, { slug: id }] })
      if (!group) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (group.ownerId !== auth.id && !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      await db.collection('community_groups').updateOne({ id: group.id }, { $set: { status: 'removed', removedAt: new Date(), removedBy: auth.id } })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // Join
    if (route.match(/^\/community\/groups\/[^/]+\/join$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Login required' }, { status: 401 }))
      const id = route.split('/')[3]
      const group = await db.collection('community_groups').findOne({ $or: [{ id }, { slug: id }] })
      if (!group || group.status === 'removed') return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const existing = await db.collection('community_group_members').findOne({ groupId: group.id, userId: auth.id })
      if (existing) return handleCORS(NextResponse.json({ ok: true, role: existing.role }))
      await db.collection('community_group_members').insertOne({ id: uuidv4(), groupId: group.id, userId: auth.id, role: 'member', joinedAt: new Date() })
      await db.collection('community_groups').updateOne({ id: group.id }, { $inc: { memberCount: 1 } })
      return handleCORS(NextResponse.json({ ok: true, role: 'member' }))
    }

    // Leave
    if (route.match(/^\/community\/groups\/[^/]+\/leave$/) && method === 'POST') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const id = route.split('/')[3]
      const group = await db.collection('community_groups').findOne({ $or: [{ id }, { slug: id }] })
      if (!group) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (group.ownerId === auth.id) return handleCORS(NextResponse.json({ error: 'Owner must transfer ownership before leaving' }, { status: 400 }))
      const existing = await db.collection('community_group_members').findOne({ groupId: group.id, userId: auth.id })
      if (!existing) return handleCORS(NextResponse.json({ ok: true }))
      await db.collection('community_group_members').deleteOne({ id: existing.id })
      await db.collection('community_groups').updateOne({ id: group.id }, { $inc: { memberCount: -1 } })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // List members
    if (route.match(/^\/community\/groups\/[^/]+\/members$/) && method === 'GET') {
      const id = route.split('/')[3]
      const group = await db.collection('community_groups').findOne({ $or: [{ id }, { slug: id }] })
      if (!group) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500)
      const members = await db.collection('community_group_members').find({ groupId: group.id }).sort({ joinedAt: -1 }).limit(limit).toArray()
      const users = members.length ? await db.collection('users').find({ id: { $in: members.map((m) => m.userId) } }).toArray() : []
      const uMap = Object.fromEntries(users.map((u) => [u.id, { id: u.id, name: u.name || u.email?.split('@')[0], communityProfileType: u.communityProfileType, primaryProfile: u.primaryProfile, profileTypes: u.profileTypes, verificationLevel: u.verificationLevel }]))
      return handleCORS(NextResponse.json({ members: members.map((m) => ({ ...uMap[m.userId], role: m.role, joinedAt: m.joinedAt })).filter(Boolean) }))
    }

    // Kick member (group_admin or platform staff). Cannot kick owner.
    if (route.match(/^\/community\/groups\/[^/]+\/members\/[^/]+$/) && method === 'DELETE') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const parts = route.split('/')
      const id = parts[3]
      const userId = parts[5]
      const group = await db.collection('community_groups').findOne({ $or: [{ id }, { slug: id }] })
      if (!group) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (group.ownerId === userId) return handleCORS(NextResponse.json({ error: 'Cannot remove owner' }, { status: 400 }))
      const my = await db.collection('community_group_members').findOne({ groupId: group.id, userId: auth.id })
      const canKick = group.ownerId === auth.id || my?.role === 'group_admin' || isStaff(auth.role)
      if (!canKick) return handleCORS(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      const existing = await db.collection('community_group_members').findOne({ groupId: group.id, userId })
      if (!existing) return handleCORS(NextResponse.json({ ok: true }))
      await db.collection('community_group_members').deleteOne({ id: existing.id })
      await db.collection('community_groups').updateOne({ id: group.id }, { $inc: { memberCount: -1 } })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // Promote/demote member role (owner or staff only)
    if (route.match(/^\/community\/groups\/[^/]+\/members\/[^/]+\/role$/) && method === 'PATCH') {
      const auth = getAuth(request)
      if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
      const parts = route.split('/')
      const id = parts[3]
      const userId = parts[5]
      const group = await db.collection('community_groups').findOne({ $or: [{ id }, { slug: id }] })
      if (!group) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      if (group.ownerId !== auth.id && !isStaff(auth.role)) return handleCORS(NextResponse.json({ error: 'Owner / staff only' }, { status: 403 }))
      const body = await request.json()
      const role = ['group_admin', 'member'].includes(body.role) ? body.role : null
      if (!role) return handleCORS(NextResponse.json({ error: 'role must be group_admin or member' }, { status: 400 }))
      await db.collection('community_group_members').updateOne({ groupId: group.id, userId }, { $set: { role } })
      return handleCORS(NextResponse.json({ ok: true, role }))
    }

    // Group posts (filter community_posts where groupId = group.id)
    if (route.match(/^\/community\/groups\/[^/]+\/posts$/) && method === 'GET') {
      const id = route.split('/')[3]
      const group = await db.collection('community_groups').findOne({ $or: [{ id }, { slug: id }] })
      if (!group) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
      const posts = await db.collection('community_posts').find({ groupId: group.id, status: { $ne: 'removed' } }).sort({ pinned: -1, createdAt: -1 }).limit(limit).toArray()
      const authorIds = [...new Set(posts.map((p) => p.authorId).filter(Boolean))]
      const authors = authorIds.length ? await db.collection('users').find({ id: { $in: authorIds } }).toArray() : []
      const resolvePT = (u) => {
        if (!u) return 'resident'
        if (u.communityProfileType) return u.communityProfileType
        const legacy = u.primaryProfile || (Array.isArray(u.profileTypes) ? u.profileTypes[0] : '') || ''
        const map = { hauler: 'hauler', contractor: 'contractor', recycler: 'recycler', donor: 'volunteer', facility_owner: 'facility_owner', normal_user: 'resident' }
        return map[legacy] || u.accountType || 'resident'
      }
      const aMap = Object.fromEntries(authors.map((u) => [u.id, { id: u.id, name: u.name || u.email?.split('@')[0], profileType: resolvePT(u), verificationLevel: u.verificationLevel || 'normal_user' }]))
      return handleCORS(NextResponse.json({ posts: posts.map((p) => ({ ...clean(p), author: aMap[p.authorId] || null })) }))
    }

    // Admin: list / moderate community groups
    if (route === '/admin/community/groups' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const status = url.searchParams.get('status') || ''
      const filter = {}
      if (status) filter.status = status
      const groups = await db.collection('community_groups').find(filter).sort({ createdAt: -1 }).limit(300).toArray()
      return handleCORS(NextResponse.json({ groups: groups.map(clean) }))
    }

    if (route.match(/^\/admin\/community\/groups\/[^/]+$/) && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[4]
      const body = await request.json()
      const update = { updatedAt: new Date() }
      if (body.action === 'suspend') update.status = 'suspended'
      else if (body.action === 'restore') update.status = 'active'
      else if (body.action === 'remove') update.status = 'removed'
      else if (body.action === 'verify') update.adminVerified = true
      else if (body.action === 'feature') update.featured = true
      else if (body.action === 'unfeature') update.featured = false
      await db.collection('community_groups').updateOne({ id }, { $set: update })
      await logActivity(db, guard.user, `community_group.${body.action}`, { kind: 'community_group', id }, body)
      const fresh = await db.collection('community_groups').findOne({ id })
      return handleCORS(NextResponse.json({ group: clean(fresh) }))
    }

    // Admin community stats overview
    if (route === '/admin/community/stats' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const now = Date.now()
      const since7 = new Date(now - 7 * 24 * 3600 * 1000)
      const since30 = new Date(now - 30 * 24 * 3600 * 1000)
      const totalPosts = await db.collection('community_posts').countDocuments({ status: { $ne: 'removed' } })
      const postsLast7 = await db.collection('community_posts').countDocuments({ status: { $ne: 'removed' }, createdAt: { $gte: since7 } })
      const postsLast30 = await db.collection('community_posts').countDocuments({ status: { $ne: 'removed' }, createdAt: { $gte: since30 } })
      const removedPosts = await db.collection('community_posts').countDocuments({ status: 'removed' })
      const totalComments = await db.collection('community_comments').countDocuments({ status: { $ne: 'removed' } })
      const totalReactions = await db.collection('community_reactions').countDocuments({})
      const totalGroups = await db.collection('community_groups').countDocuments({ status: { $ne: 'removed' } })
      const totalMembers = await db.collection('community_group_members').countDocuments({})
      const byCategory = await db.collection('community_posts').aggregate([
        { $match: { status: { $ne: 'removed' } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray()
      const topGroups = await db.collection('community_groups').find({ status: { $ne: 'removed' } }).sort({ memberCount: -1 }).limit(8).toArray()
      return handleCORS(NextResponse.json({
        posts: { total: totalPosts, last7: postsLast7, last30: postsLast30, removed: removedPosts },
        comments: { total: totalComments },
        reactions: { total: totalReactions },
        groups: { total: totalGroups, members: totalMembers },
        categories: byCategory.map((c) => ({ key: c._id, count: c.count })),
        topGroups: topGroups.map((g) => ({ id: g.id, name: g.name, city: g.city, memberCount: g.memberCount, postCount: g.postCount })),
      }))
    }

    // ============================================================
    // =========== ADMIN NOTIFICATION COUNTS ======================
    // Returns counts for every admin sidebar tab + Needs Attention.
    // Polled every 12s by AdminShell.
    // ============================================================
    if (route === '/admin/notification-counts' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const since24h = new Date(Date.now() - 24 * 3600 * 1000)
      const [
        pendingUsers, newUsers24h,
        pendingFacilities, pendingClaims,
        pendingMarketplace, reportedMarketplace,
        pendingJobs, reportedJobs,
        recentAlerts,
        reportedPosts, recentPosts24h,
        unresolvedReports, highRiskFlags,
        pendingContractorVerify, pendingOwnerRequests,
        failedPayments,
        newDonations24h,
        failedEmails,
        recentActivity,
        reportedGroups,
        pendingFacilityImports,
      ] = await Promise.all([
        db.collection('users').countDocuments({ verificationLevel: 'pending' }).catch(() => 0),
        db.collection('users').countDocuments({ createdAt: { $gte: since24h } }).catch(() => 0),
        db.collection('facilities').countDocuments({ status: 'pending' }).catch(() => 0),
        db.collection('facility_claims').countDocuments({ status: 'pending' }).catch(() => 0),
        db.collection('marketplace_listings').countDocuments({ status: 'pending' }).catch(() => 0),
        db.collection('marketplace_listings').countDocuments({ reportCount: { $gt: 0 } }).catch(() => 0),
        db.collection('jobs').countDocuments({ status: 'pending' }).catch(() => 0),
        db.collection('jobs').countDocuments({ reportCount: { $gt: 0 } }).catch(() => 0),
        db.collection('alerts').countDocuments({ createdAt: { $gte: since24h } }).catch(() => 0),
        db.collection('community_posts').countDocuments({ reportCount: { $gt: 0 }, status: { $ne: 'removed' } }).catch(() => 0),
        db.collection('community_posts').countDocuments({ createdAt: { $gte: since24h }, status: { $ne: 'removed' } }).catch(() => 0),
        db.collection('reports').countDocuments({ status: { $in: ['open', 'pending', 'new'] } }).catch(() => 0),
        db.collection('reports').countDocuments({ severity: 'high', status: { $ne: 'resolved' } }).catch(() => 0),
        db.collection('contractor_verifications').countDocuments({ status: 'pending' }).catch(() => 0),
        db.collection('facility_owner_requests').countDocuments({ status: 'pending' }).catch(() => 0),
        db.collection('donations').countDocuments({ status: { $in: ['failed', 'requires_action'] } }).catch(() => 0),
        db.collection('donations').countDocuments({ createdAt: { $gte: since24h }, status: { $ne: 'failed' } }).catch(() => 0),
        db.collection('email_logs').countDocuments({ status: 'failed' }).catch(() => 0),
        db.collection('activity_logs').countDocuments({ createdAt: { $gte: since24h } }).catch(() => 0),
        db.collection('community_groups').countDocuments({ reportCount: { $gt: 0 }, status: { $ne: 'removed' } }).catch(() => 0),
        db.collection('facility_imports').countDocuments({ status: 'pending' }).catch(() => 0),
      ])

      const counts = {
        users:                 { count: pendingUsers + newUsers24h, urgent: pendingUsers > 0, pending: pendingUsers, recent: newUsers24h },
        facilities:            { count: pendingFacilities, urgent: pendingFacilities > 0 },
        facility_claims:       { count: pendingClaims, urgent: pendingClaims > 0 },
        marketplace:           { count: pendingMarketplace + reportedMarketplace, urgent: reportedMarketplace > 0, pending: pendingMarketplace, reported: reportedMarketplace },
        jobs:                  { count: pendingJobs + reportedJobs, urgent: reportedJobs > 0, pending: pendingJobs, reported: reportedJobs },
        alerts:                { count: recentAlerts, urgent: false },
        community:             { count: reportedPosts + reportedGroups, urgent: reportedPosts + reportedGroups > 0, reportedPosts, recentPosts: recentPosts24h, reportedGroups },
        reports:               { count: unresolvedReports, urgent: highRiskFlags > 0 },
        trust_safety:          { count: highRiskFlags, urgent: highRiskFlags > 0 },
        contractor_verify:     { count: pendingContractorVerify, urgent: pendingContractorVerify > 0 },
        facility_owners:       { count: pendingOwnerRequests, urgent: pendingOwnerRequests > 0 },
        payments:              { count: failedPayments, urgent: failedPayments > 0 },
        donations:             { count: newDonations24h, urgent: false },
        email_notifications:   { count: failedEmails, urgent: failedEmails > 0 },
        activity_log:          { count: recentActivity, urgent: false },
        facility_imports:      { count: pendingFacilityImports, urgent: pendingFacilityImports > 10 },
      }

      // Needs Attention panel — only items that genuinely need action
      const needsAttention = [
        { key: 'pending_facilities',     label: 'Pending facility submissions', count: pendingFacilities,    href: '/admin/facilities?status=pending',         urgent: pendingFacilities > 0 },
        { key: 'pending_facility_imports', label: 'Pending facility imports',   count: pendingFacilityImports, href: '/admin/facility-imports',                   urgent: pendingFacilityImports > 10 },
        { key: 'pending_claims',         label: 'Pending facility claims',      count: pendingClaims,         href: '/admin/facility-claims',                    urgent: pendingClaims > 0 },
        { key: 'reported_posts',         label: 'Reported community posts',     count: reportedPosts,         href: '/admin/community?tab=posts',                urgent: reportedPosts > 0 },
        { key: 'pending_contractors',    label: 'Pending contractor verifications', count: pendingContractorVerify, href: '/admin/contractor-verification',     urgent: pendingContractorVerify > 0 },
        { key: 'unresolved_reports',     label: 'Unresolved reports',           count: unresolvedReports,     href: '/admin/reports',                            urgent: highRiskFlags > 0 },
        { key: 'failed_payments',        label: 'Failed payments',              count: failedPayments,        href: '/admin/payments',                           urgent: failedPayments > 0 },
        { key: 'new_users',              label: 'New users (24h)',              count: newUsers24h,           href: '/admin/users',                              urgent: false },
        { key: 'hot_spots',              label: 'High-urgency hot spots (24h)', count: 0,                     href: '/admin/community?tab=posts',                urgent: false },
      ]
      // Replace hot_spots count with actual value
      const hotSpots = await db.collection('community_posts').countDocuments({ category: 'illegal_dumping', urgency: 'high', createdAt: { $gte: since24h }, status: { $ne: 'removed' } }).catch(() => 0)
      needsAttention.find((n) => n.key === 'hot_spots').count = hotSpots
      needsAttention.find((n) => n.key === 'hot_spots').urgent = hotSpots > 0

      const totalUrgent = needsAttention.filter((n) => n.urgent).reduce((s, n) => s + n.count, 0)
      const totalAll = needsAttention.reduce((s, n) => s + n.count, 0)

      return handleCORS(NextResponse.json({
        counts,
        needsAttention,
        totals: { urgent: totalUrgent, all: totalAll },
        generatedAt: new Date().toISOString(),
      }))
    }

    // ============================================================
    // =========== FACILITY IMPORT PIPELINE =======================
    // CSV / manual / API-source imports with confidence scoring,
    // duplicate detection, and admin review queue.
    // ============================================================
    function normalizeName(s) {
      return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
    }
    function normalizeAddr(s) {
      return String(s || '').toLowerCase()
        .replace(/\b(street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|highway|hwy\.?|lane|ln\.?|court|ct\.?|place|pl\.?|parkway|pkwy\.?|circle|cir\.?|terrace|ter\.?|suite|ste\.?|apt\.?|#)\b/g, '')
        .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
    }
    function jaccardSimilarity(a, b) {
      const sa = new Set(a.split(' ').filter(Boolean))
      const sb = new Set(b.split(' ').filter(Boolean))
      if (!sa.size && !sb.size) return 0
      let inter = 0; for (const t of sa) if (sb.has(t)) inter++
      return inter / (sa.size + sb.size - inter)
    }
    async function findDuplicates(db, record) {
      const nName = normalizeName(record.name)
      const nAddr = normalizeAddr(record.address)
      // Pull candidates by city OR rough name match
      const candidates = await db.collection('facilities').find({
        $or: [
          { city: new RegExp(`^${(record.city || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          ...(record.name ? [{ name: new RegExp(record.name.split(' ')[0]?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || '', 'i') }] : []),
        ],
      }).limit(50).toArray()
      const matches = []
      for (const c of candidates) {
        const nameSim = jaccardSimilarity(nName, normalizeName(c.name))
        const addrSim = jaccardSimilarity(nAddr, normalizeAddr(c.address))
        const score = nameSim * 0.6 + addrSim * 0.4
        if (score > 0.45) matches.push({ id: c.id, name: c.name, address: c.address, city: c.city, similarity: Math.round(score * 100), nameSim: Math.round(nameSim * 100), addrSim: Math.round(addrSim * 100) })
      }
      matches.sort((a, b) => b.similarity - a.similarity)
      return matches.slice(0, 5)
    }
    function computeConfidence(record) {
      let s = 30
      if (record.sourceUrl) s += 15
      if (record.sourceType === 'calrecycle' || record.sourceType === 'gov_official') s += 20
      else if (record.sourceType === 'official_website') s += 12
      else if (record.sourceType === 'csv_curated') s += 10
      if (record.lat && record.lng) s += 8
      if (record.phone) s += 5
      if (record.website) s += 5
      if (Array.isArray(record.accepted) && record.accepted.length > 0) s += 5
      if (record.hours) s += 5
      if (record.lastVerifiedAt) s += 7
      return Math.min(100, s)
    }
    function parseCsv(text) {
      // Robust CSV parser supporting quoted fields and escaped quotes
      const rows = []; let row = []; let cur = ''; let i = 0; let inQ = false
      while (i < text.length) {
        const ch = text[i]
        if (inQ) {
          if (ch === '"' && text[i + 1] === '"') { cur += '"'; i += 2; continue }
          if (ch === '"') { inQ = false; i++; continue }
          cur += ch; i++; continue
        }
        if (ch === '"') { inQ = true; i++; continue }
        if (ch === ',') { row.push(cur); cur = ''; i++; continue }
        if (ch === '\n' || ch === '\r') {
          row.push(cur); cur = ''
          if (row.length > 1 || row[0]) rows.push(row)
          row = []
          // skip CRLF
          if (ch === '\r' && text[i + 1] === '\n') i++
          i++; continue
        }
        cur += ch; i++
      }
      if (cur || row.length) { row.push(cur); rows.push(row) }
      if (!rows.length) return []
      const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
      return rows.slice(1).filter((r) => r.some((c) => String(c).trim())).map((r) => {
        const obj = {}
        for (let j = 0; j < header.length; j++) obj[header[j]] = (r[j] || '').trim()
        return obj
      })
    }
    function normalizeImportRecord(raw) {
      const splitList = (v) => String(v || '').split(/[;|,]/).map((x) => x.trim()).filter(Boolean)
      const lat = parseFloat(raw.lat || raw.latitude || '')
      const lng = parseFloat(raw.lng || raw.longitude || raw.lon || '')
      return {
        name: raw.name || raw.facility_name || raw.site_name || '',
        typeKey: (raw.type || raw.facility_type || raw.typekey || '').toLowerCase().replace(/\s+/g, '_') || 'transfer_station',
        address: raw.address || raw.street || raw.site_address || '',
        city: raw.city || '',
        county: raw.county || '',
        state: raw.state || 'CA',
        zip: raw.zip || raw.zipcode || raw.postal_code || '',
        lat: !isNaN(lat) ? lat : null,
        lng: !isNaN(lng) ? lng : null,
        phone: raw.phone || '',
        website: raw.website || raw.url || '',
        hours: raw.hours || '',
        accepted: splitList(raw.accepted || raw.accepted_materials || ''),
        notAccepted: splitList(raw.not_accepted || raw.notaccepted || ''),
        pricingNotes: raw.pricing || raw.pricing_notes || '',
        paymentMethods: splitList(raw.payment || raw.payment_methods || ''),
        scaleRequired: ['yes', 'true', '1'].includes(String(raw.scale_required || raw.scale || '').toLowerCase()),
        contractorFriendly: ['yes', 'true', '1'].includes(String(raw.contractor_friendly || raw.contractor || '').toLowerCase()),
        sourceUrl: raw.source_url || raw.source || '',
        sourceType: raw.source_type || 'csv_curated',
        notes: raw.notes || '',
      }
    }

    // CSV upload (admin moderator+)
    if (route === '/admin/facility-imports/csv' && method === 'POST') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      if (!body.csv) return handleCORS(NextResponse.json({ error: 'csv text required in body.csv' }, { status: 400 }))
      const parsed = parseCsv(body.csv)
      if (!parsed.length) return handleCORS(NextResponse.json({ error: 'No rows parsed' }, { status: 400 }))
      let created = 0; const dupesFound = []
      for (const raw of parsed) {
        const normalized = normalizeImportRecord(raw)
        if (!normalized.name || !normalized.address) continue
        const dupes = await findDuplicates(db, normalized)
        const confidence = computeConfidence({ ...normalized, lastVerifiedAt: new Date() })
        const importDoc = {
          id: uuidv4(),
          sourceType: normalized.sourceType,
          sourceUrl: normalized.sourceUrl,
          rawData: raw,
          normalizedData: normalized,
          confidenceScore: confidence,
          status: 'pending',
          duplicateMatches: dupes,
          duplicateOfId: dupes[0]?.similarity >= 85 ? dupes[0].id : null,
          lastVerifiedAt: new Date(),
          importedBy: guard.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        await db.collection('facility_imports').insertOne(importDoc)
        created++
        if (dupes.length) dupesFound.push({ name: normalized.name, dupes })
      }
      await logActivity(db, guard.user, 'facility_imports.csv_upload', { kind: 'facility_import', label: 'csv' }, { count: created })
      return handleCORS(NextResponse.json({ created, totalRows: parsed.length, dupesFound: dupesFound.length }))
    }

    // Manual single record
    if (route === '/admin/facility-imports' && method === 'POST') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const normalized = normalizeImportRecord(body)
      if (!normalized.name || !normalized.address) return handleCORS(NextResponse.json({ error: 'name and address required' }, { status: 400 }))
      const dupes = await findDuplicates(db, normalized)
      const confidence = computeConfidence({ ...normalized, lastVerifiedAt: new Date() })
      const importDoc = {
        id: uuidv4(),
        sourceType: normalized.sourceType,
        sourceUrl: normalized.sourceUrl,
        rawData: body,
        normalizedData: normalized,
        confidenceScore: confidence,
        status: 'pending',
        duplicateMatches: dupes,
        duplicateOfId: dupes[0]?.similarity >= 85 ? dupes[0].id : null,
        lastVerifiedAt: new Date(),
        importedBy: guard.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('facility_imports').insertOne(importDoc)
      return handleCORS(NextResponse.json({ import: clean(importDoc) }))
    }

    // List imports
    if (route === '/admin/facility-imports' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const status = url.searchParams.get('status') || 'pending'
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500)
      const filter = {}
      if (status !== 'all') filter.status = status
      const imports = await db.collection('facility_imports').find(filter).sort({ createdAt: -1 }).limit(limit).toArray()
      const counts = await db.collection('facility_imports').aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray()
      const countsMap = Object.fromEntries(counts.map((c) => [c._id || 'unknown', c.count]))
      // Productivity metrics
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
      const [approvedToday, rejectedToday, needsDetailsCount, duplicatesFound] = await Promise.all([
        db.collection('facility_imports').countDocuments({ status: 'approved', publishedAt: { $gte: startOfDay } }).catch(() => 0),
        db.collection('facility_imports').countDocuments({ status: 'rejected', rejectedAt: { $gte: startOfDay } }).catch(() => 0),
        db.collection('facility_imports').countDocuments({ status: 'needs_details' }).catch(() => 0),
        db.collection('facility_imports').countDocuments({ 'duplicateMatches.0': { $exists: true }, status: { $in: ['pending', 'needs_details'] } }).catch(() => 0),
      ])
      return handleCORS(NextResponse.json({
        imports: imports.map(clean),
        counts: { ...countsMap, needs_details: countsMap.needs_details || needsDetailsCount },
        metrics: { approvedToday, rejectedToday, needsDetailsCount, duplicatesFound },
      }))
    }

    // Duplicate check (preview before manual save) — MUST come before detail route
    if (route === '/admin/facility-imports/duplicate-check' && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const name = url.searchParams.get('name') || ''
      const address = url.searchParams.get('address') || ''
      const city = url.searchParams.get('city') || ''
      const dupes = await findDuplicates(db, { name, address, city })
      return handleCORS(NextResponse.json({ dupes }))
    }

    // Reseed all curated batches — idempotent (skips already-queued by sourceRecordKey)
    if (route === '/admin/facility-imports/seed' && method === 'POST') {
      const guard = await requireStaff(request, db, 'admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const batchKeys = ['calrecycle-norcal-v1', 'calrecycle-socal-v1', 'pacific-northwest-v1', 'nevada-v1']
      const before = await db.collection('facility_imports').countDocuments({ importBatch: { $in: batchKeys } })
      await seedCalrecyclePendingImports(db)
      const norcal = await db.collection('facility_imports').countDocuments({ importBatch: 'calrecycle-norcal-v1' })
      const socal = await db.collection('facility_imports').countDocuments({ importBatch: 'calrecycle-socal-v1' })
      const pacnw = await db.collection('facility_imports').countDocuments({ importBatch: 'pacific-northwest-v1' })
      const nevada = await db.collection('facility_imports').countDocuments({ importBatch: 'nevada-v1' })
      const after = norcal + socal + pacnw + nevada
      await logActivity(db, guard.user, 'facility_imports.seed_calrecycle', { kind: 'facility_import', label: 'all-batches' }, { added: after - before, norcal, socal, pacnw, nevada })
      return handleCORS(NextResponse.json({ ok: true, added: after - before, totalBatch: after, norcal, socal, pacnw, nevada }))
    }

    // Create a draft import from a single official source URL.
    // This does NOT scrape the web — it creates a placeholder draft pre-tagged with sourceUrl/sourceType
    // so admin can fill in fields knowing the provenance up-front.
    if (route === '/admin/facility-imports/from-url' && method === 'POST') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const sourceUrl = body.sourceUrl || ''
      if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
        return handleCORS(NextResponse.json({ error: 'Valid http(s) sourceUrl required' }, { status: 400 }))
      }
      // Detect known sources by domain heuristics
      const lowerUrl = sourceUrl.toLowerCase()
      let detectedType = body.sourceType || 'other'
      if (lowerUrl.includes('calrecycle.ca.gov')) detectedType = 'calrecycle'
      else if (lowerUrl.includes('.gov') || lowerUrl.includes('.ca.us') || lowerUrl.includes('santaclaracounty') || lowerUrl.includes('stopwaste') || lowerUrl.includes('sanjoseca')) detectedType = 'gov_official'
      else if (lowerUrl.includes('wm.com') || lowerUrl.includes('republicservices') || lowerUrl.includes('recology') || lowerUrl.includes('greenwaste') || lowerUrl.includes('goodwill') || lowerUrl.includes('habitat')) detectedType = 'official_website'
      const normalized = {
        name: body.name || '',
        typeKey: body.typeKey || 'transfer_station',
        address: body.address || '',
        city: body.city || '',
        county: body.county || '',
        state: body.state || 'CA',
        zip: body.zip || '',
        lat: body.lat || null,
        lng: body.lng || null,
        phone: body.phone || '',
        website: body.website || '',
        hours: body.hours || '',
        accepted: Array.isArray(body.accepted) ? body.accepted : (body.accepted ? String(body.accepted).split(/[;,]/).map((s) => s.trim()).filter(Boolean) : []),
        notAccepted: Array.isArray(body.notAccepted) ? body.notAccepted : [],
        pricingNotes: body.pricingNotes || '',
        paymentMethods: Array.isArray(body.paymentMethods) ? body.paymentMethods : [],
        scaleRequired: !!body.scaleRequired,
        contractorFriendly: !!body.contractorFriendly,
        sourceUrl,
        sourceType: detectedType,
        notes: body.notes || `Draft created from source URL on ${new Date().toLocaleDateString()}`,
      }
      const dupes = normalized.name && normalized.address ? await findDuplicates(db, normalized) : []
      const confidence = computeConfidence({ ...normalized, lastVerifiedAt: new Date() })
      const importDoc = {
        id: uuidv4(),
        sourceType: normalized.sourceType,
        sourceUrl,
        rawData: body,
        normalizedData: normalized,
        confidenceScore: confidence,
        status: 'pending',
        duplicateMatches: dupes,
        duplicateOfId: dupes[0]?.similarity >= 85 ? dupes[0].id : null,
        lastVerifiedAt: new Date(),
        importedBy: guard.user.id,
        importBatch: 'from-url-' + new Date().toISOString().slice(0, 10),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('facility_imports').insertOne(importDoc)
      await logActivity(db, guard.user, 'facility_imports.from_url', { kind: 'facility_import', id: importDoc.id }, { sourceUrl, detectedType })
      return handleCORS(NextResponse.json({ import: clean(importDoc), detectedSourceType: detectedType }))
    }

    // Bulk approve multiple high-confidence imports at once
    if (route === '/admin/facility-imports/bulk-approve' && method === 'POST') {
      const guard = await requireStaff(request, db, 'admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const ids = Array.isArray(body.ids) ? body.ids : []
      if (!ids.length) return handleCORS(NextResponse.json({ error: 'ids array required' }, { status: 400 }))
      let approved = 0; let skipped = 0; const created = []
      for (const id of ids) {
        // Allow approving from pending OR needs_details
        const doc = await db.collection('facility_imports').findOne({ id, status: { $in: ['pending', 'needs_details'] } })
        if (!doc) { skipped++; continue }
        const n = doc.normalizedData
        const facility = {
          id: uuidv4(),
          name: n.name,
          typeKey: n.typeKey || 'transfer_station',
          address: n.address,
          city: n.city, county: n.county, state: n.state || 'CA', zip: n.zip,
          lat: n.lat, lng: n.lng,
          phone: n.phone, website: n.website, hours: n.hours,
          accepted: n.accepted || [], notAccepted: n.notAccepted || [],
          pricing: { notes: n.pricingNotes || '' },
          paymentMethods: n.paymentMethods || [],
          scaleRequired: !!n.scaleRequired,
          contractorFriendly: !!n.contractorFriendly,
          sourceUrl: n.sourceUrl || '',
          sourceType: n.sourceType || 'csv_curated',
          confidenceScore: doc.confidenceScore,
          lastVerifiedAt: doc.lastVerifiedAt,
          verificationStatus: 'staff_imported',
          needsVerification: doc.confidenceScore < 70 || !n.hours || !(n.pricingNotes || '').trim(),
          status: 'active',
          verified: doc.confidenceScore >= 80,
          claimed: false,
          claimedByUserId: null,
          createdAt: new Date(), updatedAt: new Date(),
          importedFromId: doc.id,
        }
        await db.collection('facilities').insertOne(facility)
        await db.collection('facility_imports').updateOne({ id }, { $set: { status: 'approved', publishedFacilityId: facility.id, publishedAt: new Date(), updatedAt: new Date() } })
        approved++
        created.push({ id: facility.id, name: facility.name })
      }
      await logActivity(db, guard.user, 'facility_imports.bulk_approve', { kind: 'facility_import', label: 'bulk' }, { approved, skipped })
      return handleCORS(NextResponse.json({ ok: true, approved, skipped, created }))
    }

    // Bulk reject
    if (route === '/admin/facility-imports/bulk-reject' && method === 'POST') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const ids = Array.isArray(body.ids) ? body.ids : []
      const reason = body.reason || ''
      if (!ids.length) return handleCORS(NextResponse.json({ error: 'ids array required' }, { status: 400 }))
      const res = await db.collection('facility_imports').updateMany(
        { id: { $in: ids }, status: { $in: ['pending', 'needs_details'] } },
        { $set: { status: 'rejected', rejectedReason: reason, rejectedAt: new Date(), updatedAt: new Date() } }
      )
      await logActivity(db, guard.user, 'facility_imports.bulk_reject', { kind: 'facility_import', label: 'bulk' }, { count: res.modifiedCount, reason })
      return handleCORS(NextResponse.json({ ok: true, rejected: res.modifiedCount, skipped: ids.length - res.modifiedCount }))
    }

    // Bulk mark "needs details"
    if (route === '/admin/facility-imports/bulk-needs-details' && method === 'POST') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const ids = Array.isArray(body.ids) ? body.ids : []
      const reasons = Array.isArray(body.reasons) ? body.reasons : []
      const notes = body.notes || ''
      if (!ids.length) return handleCORS(NextResponse.json({ error: 'ids array required' }, { status: 400 }))
      const res = await db.collection('facility_imports').updateMany(
        { id: { $in: ids }, status: { $in: ['pending', 'needs_details'] } },
        { $set: { status: 'needs_details', needsDetailsReasons: reasons, needsDetailsNotes: notes, needsDetailsAt: new Date(), needsDetailsBy: guard.user.id, updatedAt: new Date() } }
      )
      await logActivity(db, guard.user, 'facility_imports.bulk_needs_details', { kind: 'facility_import', label: 'bulk' }, { count: res.modifiedCount, reasons })
      return handleCORS(NextResponse.json({ ok: true, flagged: res.modifiedCount, skipped: ids.length - res.modifiedCount }))
    }

    // Bulk merge — merges each of the provided imports into the FIRST suggested duplicate
    if (route === '/admin/facility-imports/bulk-merge' && method === 'POST') {
      const guard = await requireStaff(request, db, 'admin')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const body = await request.json()
      const ids = Array.isArray(body.ids) ? body.ids : []
      if (!ids.length) return handleCORS(NextResponse.json({ error: 'ids array required' }, { status: 400 }))
      let merged = 0; let skipped = 0; const results = []
      for (const id of ids) {
        const doc = await db.collection('facility_imports').findOne({ id, status: { $in: ['pending', 'needs_details'] } })
        if (!doc) { skipped++; continue }
        const dupes = doc.duplicateMatches || []
        if (!dupes.length) { skipped++; results.push({ id, skipped: 'no_duplicate' }); continue }
        const target = dupes[0]
        const targetFac = await db.collection('facilities').findOne({ id: target.id })
        if (!targetFac) { skipped++; continue }
        const n = doc.normalizedData
        const updates = {}; const filled = []
        const fields = ['phone', 'website', 'hours', 'pricingNotes', 'lat', 'lng', 'zip', 'county']
        for (const f of fields) {
          if ((!targetFac[f] || targetFac[f] === '') && n[f]) { updates[f] = n[f]; filled.push(f) }
        }
        // Union arrays
        for (const af of ['accepted', 'notAccepted', 'paymentMethods']) {
          if (Array.isArray(n[af]) && n[af].length) {
            const existing = Array.isArray(targetFac[af]) ? targetFac[af] : []
            const unioned = Array.from(new Set([...existing, ...n[af]]))
            if (unioned.length > existing.length) { updates[af] = unioned; filled.push(af) }
          }
        }
        // Update provenance
        updates.sourceUrl = targetFac.sourceUrl || n.sourceUrl || ''
        updates.sourceType = targetFac.sourceType || n.sourceType || 'csv_curated'
        updates.confidenceScore = Math.max(targetFac.confidenceScore || 0, doc.confidenceScore || 0)
        updates.lastVerifiedAt = new Date()
        updates.updatedAt = new Date()
        await db.collection('facilities').updateOne({ id: target.id }, { $set: updates })
        await db.collection('facility_imports').updateOne({ id }, { $set: { status: 'merged', mergedIntoFacilityId: target.id, mergedAt: new Date(), updatedAt: new Date() } })
        merged++
        results.push({ id, mergedInto: target.id, targetName: target.name, fieldsFilled: filled })
      }
      await logActivity(db, guard.user, 'facility_imports.bulk_merge', { kind: 'facility_import', label: 'bulk' }, { merged, skipped })
      return handleCORS(NextResponse.json({ ok: true, merged, skipped, results }))
    }

    // Detail
    if (route.match(/^\/admin\/facility-imports\/[^/]+$/) && method === 'GET') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[3]
      const doc = await db.collection('facility_imports').findOne({ id })
      if (!doc) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      // refresh duplicate matches
      const dupes = await findDuplicates(db, doc.normalizedData)
      await db.collection('facility_imports').updateOne({ id }, { $set: { duplicateMatches: dupes } })
      return handleCORS(NextResponse.json({ import: clean({ ...doc, duplicateMatches: dupes }) }))
    }

    // PATCH — actions: approve / reject / merge / edit
    if (route.match(/^\/admin\/facility-imports\/[^/]+$/) && method === 'PATCH') {
      const guard = await requireStaff(request, db, 'moderator')
      if (guard.error) return handleCORS(NextResponse.json({ error: guard.error }, { status: guard.status }))
      const id = route.split('/')[3]
      const doc = await db.collection('facility_imports').findOne({ id })
      if (!doc) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const body = await request.json()
      const action = body.action
      const update = { updatedAt: new Date() }

      if (action === 'edit') {
        if (body.normalizedData) {
          update.normalizedData = { ...doc.normalizedData, ...body.normalizedData }
          update.confidenceScore = computeConfidence({ ...update.normalizedData, lastVerifiedAt: doc.lastVerifiedAt })
        }
        await db.collection('facility_imports').updateOne({ id }, { $set: update })
        const fresh = await db.collection('facility_imports').findOne({ id })
        return handleCORS(NextResponse.json({ import: clean(fresh) }))
      }

      if (action === 'reject') {
        update.status = 'rejected'
        update.rejectedReason = body.reason || ''
        update.rejectedAt = new Date()
        await db.collection('facility_imports').updateOne({ id }, { $set: update })
        await logActivity(db, guard.user, 'facility_imports.reject', { kind: 'facility_import', id }, { reason: body.reason })
        return handleCORS(NextResponse.json({ ok: true, status: 'rejected' }))
      }

      if (action === 'needs_details') {
        update.status = 'needs_details'
        update.needsDetailsReasons = Array.isArray(body.reasons) ? body.reasons : []
        update.needsDetailsNotes = body.notes || ''
        update.needsDetailsAt = new Date()
        update.needsDetailsBy = guard.user.id
        await db.collection('facility_imports').updateOne({ id }, { $set: update })
        await logActivity(db, guard.user, 'facility_imports.needs_details', { kind: 'facility_import', id }, { reasons: update.needsDetailsReasons })
        return handleCORS(NextResponse.json({ ok: true, status: 'needs_details', reasons: update.needsDetailsReasons }))
      }

      if (action === 'approve') {
        // Publish into facilities collection (new doc)
        const n = doc.normalizedData
        const facility = {
          id: uuidv4(),
          name: n.name,
          typeKey: n.typeKey || 'transfer_station',
          address: n.address,
          city: n.city,
          county: n.county,
          state: n.state || 'CA',
          zip: n.zip,
          lat: n.lat,
          lng: n.lng,
          phone: n.phone,
          website: n.website,
          hours: n.hours,
          accepted: n.accepted || [],
          notAccepted: n.notAccepted || [],
          pricing: { notes: n.pricingNotes || '' },
          paymentMethods: n.paymentMethods || [],
          scaleRequired: !!n.scaleRequired,
          contractorFriendly: !!n.contractorFriendly,
          // Provenance
          sourceUrl: n.sourceUrl || '',
          sourceType: n.sourceType || 'csv_curated',
          confidenceScore: doc.confidenceScore,
          lastVerifiedAt: doc.lastVerifiedAt,
          verificationStatus: 'staff_imported',
          needsVerification: doc.confidenceScore < 70 || !n.hours || (n.pricingNotes || '').toLowerCase().includes('unknown'),
          // Defaults
          status: 'active',
          verified: doc.confidenceScore >= 80,
          claimed: false,
          claimedByUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          importedFromId: doc.id,
        }
        await db.collection('facilities').insertOne(facility)
        update.status = 'approved'
        update.publishedFacilityId = facility.id
        update.publishedAt = new Date()
        await db.collection('facility_imports').updateOne({ id }, { $set: update })
        await logActivity(db, guard.user, 'facility_imports.approve', { kind: 'facility_import', id, label: facility.name }, { facilityId: facility.id })
        return handleCORS(NextResponse.json({ ok: true, status: 'approved', facility: clean(facility) }))
      }

      if (action === 'merge') {
        const targetId = body.targetFacilityId
        if (!targetId) return handleCORS(NextResponse.json({ error: 'targetFacilityId required' }, { status: 400 }))
        const target = await db.collection('facilities').findOne({ id: targetId })
        if (!target) return handleCORS(NextResponse.json({ error: 'Target facility not found' }, { status: 404 }))
        const n = doc.normalizedData
        const mergeFields = body.mergeFields || ['phone', 'website', 'hours', 'accepted', 'notAccepted', 'pricingNotes', 'paymentMethods', 'lat', 'lng', 'zip']
        const updates = {}
        for (const f of mergeFields) {
          if (f === 'pricingNotes') {
            if (n.pricingNotes && (!target.pricing?.notes || target.pricing.notes.length < n.pricingNotes.length)) {
              updates.pricing = { ...(target.pricing || {}), notes: n.pricingNotes }
            }
          } else if (Array.isArray(n[f])) {
            const merged = [...new Set([...(target[f] || []), ...n[f]])]
            if (merged.length > (target[f] || []).length) updates[f] = merged
          } else if (n[f] && !target[f]) {
            updates[f] = n[f]
          }
        }
        updates.sourceUrl = updates.sourceUrl || n.sourceUrl || target.sourceUrl
        updates.lastVerifiedAt = new Date()
        updates.confidenceScore = Math.max(target.confidenceScore || 0, doc.confidenceScore)
        updates.needsVerification = (updates.confidenceScore < 70)
        updates.updatedAt = new Date()
        await db.collection('facilities').updateOne({ id: targetId }, { $set: updates })
        update.status = 'merged'
        update.mergedIntoFacilityId = targetId
        update.mergedAt = new Date()
        await db.collection('facility_imports').updateOne({ id }, { $set: update })
        await logActivity(db, guard.user, 'facility_imports.merge', { kind: 'facility_import', id }, { targetFacilityId: targetId, fields: Object.keys(updates) })
        return handleCORS(NextResponse.json({ ok: true, status: 'merged', mergedInto: targetId, fields: Object.keys(updates) }))
      }

      return handleCORS(NextResponse.json({ error: 'Unknown action — use approve|reject|merge|edit' }, { status: 400 }))
    }

    // ============================================================
    return handleCORS(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ error: 'Internal server error', detail: String(error) }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
