/**
 * Marketplace seeder — inserts demo listings into `marketplace_listings`.
 *
 * Reads MONGO_URL / DB_NAME from .env (no dotenv dependency — parsed manually).
 * Attaches each listing to a real user in the `users` collection so the seller
 * badge / name renders on the cards. Idempotent-ish: pass --fresh to wipe seeded
 * listings first (only ones tagged { seedTag: 'demo-marketplace' }).
 *
 * Usage:
 *   node scripts/seed-marketplace.js          # insert demo listings
 *   node scripts/seed-marketplace.js --fresh  # remove previous demo listings, then insert
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { MongoClient } = require('mongodb')

// ---- tiny .env parser (avoids a dotenv dependency) ----
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  const out = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

const uuid = () => crypto.randomUUID()
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)
const minsFromNow = (n) => new Date(Date.now() + n * 60 * 1000)
const SEED_TAG = 'demo-marketplace'

// ---- listing factory: fills every field the API's POST handler writes ----
function makeListing(seller, o) {
  const now = new Date()
  const createdAt = o.createdAt || daysAgo(Math.random() * 12)
  return {
    id: uuid(),
    sellerId: seller.id,
    segment: o.segment || 'residential',
    kind: o.kind || 'sell',
    title: o.title,
    category: o.category,
    condition: o.condition || 'good',
    description: o.description || '',
    photos: o.photos || [],
    price: o.price ?? null,
    priceType: o.priceType || 'fixed',
    acceptsOffers: !!o.acceptsOffers,
    donationPreferred: !!o.donationPreferred,
    currency: 'USD',
    quantity: o.quantity || 1,
    dimensions: o.dimensions || '',
    location: o.location || '',
    city: o.city || '',
    state: o.state || 'CA',
    zip: o.zip || '',
    lat: o.lat ?? null,
    lng: o.lng ?? null,
    pickupWindow: o.pickupWindow || '',
    itemStatus: o.itemStatus || 'available',
    leavingAt: o.leavingAt || null,
    reservation: null,
    deliveryOptions: o.deliveryOptions || ['pickup'],
    materialTags: o.materialTags || [],
    contactPreference: 'in_app',
    status: 'active',
    sold: !!o.sold,
    soldAt: o.sold ? now : null,
    featured: !!o.featured,
    viewCount: o.viewCount ?? Math.floor(Math.random() * 120),
    savedByUserIds: [],
    reportCount: 0,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt,
    updatedAt: createdAt,
    seedTag: SEED_TAG,
  }
}

// Bay Area coordinates so the distance/sort features have something to chew on.
const CITIES = [
  { city: 'San Jose',       zip: '95112', lat: 37.3382, lng: -121.8863 },
  { city: 'Oakland',        zip: '94607', lat: 37.8044, lng: -122.2712 },
  { city: 'San Francisco',  zip: '94103', lat: 37.7749, lng: -122.4194 },
  { city: 'Fremont',        zip: '94538', lat: 37.5485, lng: -121.9886 },
  { city: 'Santa Clara',    zip: '95050', lat: 37.3541, lng: -121.9552 },
  { city: 'Palo Alto',      zip: '94301', lat: 37.4419, lng: -122.1430 },
  { city: 'Hayward',        zip: '94541', lat: 37.6688, lng: -122.0808 },
]
const pickCity = (i) => CITIES[i % CITIES.length]

// ---- listing blueprints (photos use Unsplash source URLs — external, render as <img>) ----
const IMG = (id, w = 800) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const BLUEPRINTS = [
  // ---- Residential: for sale ----
  { title: 'IKEA Kallax 4x4 Shelf Unit — White', category: 'Furniture', condition: 'like_new', price: 65, priceType: 'obo', acceptsOffers: true,
    description: 'Barely used Kallax shelf, no scratches. Great for records, books or bins. Disassembled and ready for pickup.', featured: true,
    photos: [IMG('1594620302200-9a762244a156')], materialTags: ['ikea', 'shelf', 'storage'], itemStatus: 'available' },
  { title: 'Whirlpool Front-Load Washer (works great)', category: 'Appliances', condition: 'good', price: 220, priceType: 'fixed',
    description: 'Upgrading to a stacked unit. This one runs quiet and clean. You haul — it is on the ground floor.',
    photos: [IMG('1626806787461-102c1bfaaea1')], materialTags: ['washer', 'laundry'], itemStatus: 'at_site' },
  { title: 'Dell 27" 1440p Monitor', category: 'Electronics', condition: 'like_new', price: 95, priceType: 'fixed',
    description: 'Crisp QHD panel, USB-C, no dead pixels. Comes with stand and power cable.',
    photos: [IMG('1527443224154-c4a3942d3acf')], materialTags: ['monitor', 'dell'], itemStatus: 'available' },
  { title: 'Milwaukee M18 Drill + 2 Batteries', category: 'Tools', condition: 'good', price: 130, priceType: 'obo', acceptsOffers: true,
    description: 'Solid cordless drill, both batteries hold charge. Charger included.',
    photos: [IMG('1504148455328-c376907d081c')], materialTags: ['milwaukee', 'power tools'], itemStatus: 'on_truck' },
  { title: 'Mid-Century Teak Dining Table', category: 'Furniture', condition: 'good', price: 340, priceType: 'obo', acceptsOffers: true, featured: true,
    description: 'Beautiful teak table, seats 6. Some light wear on the surface, very solid. Chairs not included.',
    photos: [IMG('1533090481720-856c6e3c1fdc')], materialTags: ['teak', 'dining', 'midcentury'], itemStatus: 'available' },

  // ---- Residential: free / donation ----
  { title: 'Free Moving Boxes (approx 20)', category: 'Household Goods', condition: 'good', price: 0, priceType: 'free', kind: 'free',
    description: 'Just moved in. Assorted sizes, all in good shape. Come grab them before recycling day!',
    photos: [IMG('1607166452427-7e4477079cb9')], materialTags: ['boxes', 'moving'], itemStatus: 'last_chance', leavingAt: minsFromNow(25) },
  { title: 'Free Sofa — Grey 3-Seater (pet-free home)', category: 'Furniture', condition: 'fair', price: 0, priceType: 'free', kind: 'free',
    description: 'Comfortable couch, one small tear on the arm. Free to a good home, must pick up this weekend.',
    photos: [IMG('1555041469-a586c61ea9bc')], materialTags: ['sofa', 'couch'], itemStatus: 'available' },
  { title: 'Kids Books & Toys Bundle — Donation', category: 'Toys & Games', condition: 'good', price: null, priceType: 'donation', kind: 'free', donationPreferred: true,
    description: 'Big box of gently used kids books and toys. Would love it to go to a family or shelter.',
    photos: [IMG('1503919545889-aef636e10ad4')], materialTags: ['kids', 'toys', 'books'], itemStatus: 'available' },

  // ---- Residential: trade ----
  { title: 'Trade: Road Bike for Mountain Bike', category: 'Sporting Goods', condition: 'good', price: null, priceType: 'trade', kind: 'trade',
    description: '54cm aluminum road bike, recently tuned. Looking to trade for a medium hardtail MTB.',
    photos: [IMG('1485965120184-e220f721d03e')], materialTags: ['bike', 'cycling'], itemStatus: 'available' },

  // ---- Residential: on truck / last chance (DumpMaps-specific statuses) ----
  { title: 'Solid Oak Dresser — On the truck now', category: 'Furniture', condition: 'good', price: 80, priceType: 'obo', acceptsOffers: true,
    description: 'Cleared from a job site today, on the truck. Grab it before it hits the transfer station!',
    photos: [IMG('1595428774223-ef52624120d2')], materialTags: ['dresser', 'oak'], itemStatus: 'on_truck', leavingAt: minsFromNow(90) },
  { title: 'Patio Set (table + 4 chairs) — Last Chance', category: 'Household Goods', condition: 'fair', price: 45, priceType: 'obo', acceptsOffers: true,
    description: 'Metal patio set, some rust but very usable. Heading to the dump tomorrow unless someone wants it.',
    photos: [IMG('1600585154340-be6161a56a0c')], materialTags: ['patio', 'outdoor'], itemStatus: 'last_chance', leavingAt: minsFromNow(15), featured: true },

  // ---- Residential: sold (for seller dashboard stats) ----
  { title: 'Vintage Record Player', category: 'Electronics', condition: 'good', price: 110, priceType: 'fixed', sold: true,
    description: 'Working turntable, warm sound. Sold — thanks!',
    photos: [IMG('1461360370896-922624d12aa1')], materialTags: ['turntable', 'vinyl'], itemStatus: 'sold' },

  // ---- Commercial / B2B ----
  { title: 'Wooden Pallets — 40 available', category: 'Pallets', segment: 'commercial', condition: 'good', price: 4, priceType: 'fixed', quantity: 40,
    description: 'Standard 48x40 GMA pallets, heat-treated. Bulk pickup preferred. Forklift on site.',
    photos: [IMG('1553413077-190dd305871c')], materialTags: ['pallets', 'shipping', 'bulk'], itemStatus: 'available', deliveryOptions: ['pickup', 'local_delivery'] },
  { title: 'Restaurant Prep Tables — Stainless (x3)', category: 'Restaurant Equipment', segment: 'commercial', condition: 'good', price: 180, priceType: 'obo', acceptsOffers: true, quantity: 3,
    description: 'Closing a kitchen. Three NSF stainless prep tables, minor dents. Priced each.',
    photos: [IMG('1556910103-1c02745aae4d')], materialTags: ['stainless', 'commercial kitchen'], itemStatus: 'at_site', featured: true },
  { title: 'Gondola Shelving Units — Store Fixtures', category: 'Fixtures', segment: 'commercial', condition: 'good', price: 55, priceType: 'fixed', quantity: 12,
    description: 'Retail gondola shelving from a store remodel. Double-sided, adjustable shelves. Take one or all.',
    photos: [IMG('1441986300917-64674bd600d8')], materialTags: ['shelving', 'retail', 'fixtures'], itemStatus: 'available' },
  { title: 'Reclaimed Construction Lumber — 2x4 lot', category: 'Construction Materials', segment: 'commercial', condition: 'fair', price: null, priceType: 'contact', kind: 'sell',
    description: 'Large lot of reclaimed framing lumber from a teardown. Denailed. Contact for volume pricing.',
    photos: [IMG('1504328345606-18bbc8c9d7d1')], materialTags: ['lumber', 'reclaimed', 'construction'], itemStatus: 'on_truck' },
  { title: 'Scrap Steel & Copper — Bulk Lot', category: 'Scrap Metal', segment: 'commercial', condition: 'for_parts', price: null, priceType: 'contact',
    description: 'Mixed ferrous and non-ferrous scrap from a demo. Weigh-and-pay, loader available.',
    photos: [IMG('1605152276897-4f618f831968')], materialTags: ['scrap', 'metal', 'copper', 'steel'], itemStatus: 'available' },
]

async function main() {
  const env = loadEnv()
  if (!env.MONGO_URL || !env.DB_NAME) {
    console.error('Missing MONGO_URL / DB_NAME in .env')
    process.exit(1)
  }
  const fresh = process.argv.includes('--fresh')

  const client = new MongoClient(env.MONGO_URL)
  await client.connect()
  const db = client.db(env.DB_NAME)

  const users = await db.collection('users').find({}).limit(20).toArray()
  if (users.length === 0) {
    console.error('No users found — create at least one account before seeding.')
    process.exit(1)
  }
  // Prefer hauler/vendor-ish profiles first so cards show varied seller badges.
  users.sort((a, b) => {
    const rank = (u) => {
      const p = (u.primaryProfile || u.userRole || '').toLowerCase()
      if (p.includes('hauler')) return 0
      if (p.includes('vendor') || p.includes('recycler')) return 1
      return 2
    }
    return rank(a) - rank(b)
  })

  if (fresh) {
    const del = await db.collection('marketplace_listings').deleteMany({ seedTag: SEED_TAG })
    console.log(`Removed ${del.deletedCount} previously-seeded demo listings.`)
  }

  const docs = BLUEPRINTS.map((bp, i) => {
    const seller = users[i % users.length]
    const loc = pickCity(i)
    return makeListing(seller, {
      ...bp,
      city: bp.city || loc.city,
      zip: bp.zip || loc.zip,
      lat: bp.lat ?? loc.lat,
      lng: bp.lng ?? loc.lng,
      location: bp.location || `${loc.city} area`,
    })
  })

  const res = await db.collection('marketplace_listings').insertMany(docs)
  console.log(`Inserted ${res.insertedCount} marketplace listings.`)

  // quick summary
  const bySeg = {}
  for (const d of docs) bySeg[d.segment] = (bySeg[d.segment] || 0) + 1
  console.log('By segment:', bySeg)
  console.log('Total listings in collection now:', await db.collection('marketplace_listings').countDocuments())

  await client.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
