// PR-2b: Demo contractor seed handler (admin-only).
// Endpoint: POST /api/admin/seed/demo-contractors  (idempotent)

const DEMO = [
  { name: 'Bay Area Junk Pros', city: 'San Jose', state: 'CA', bio: 'Same-day junk removal, garage cleanouts, e-waste pickups. Insured & verified.', services: ['Junk removal', 'Garage cleanout', 'E-waste'], rating: 4.8, reviewCount: 12 },
  { name: 'Golden State Haulers', city: 'Oakland', state: 'CA', bio: 'Family-owned hauling co. Construction debris specialists.', services: ['Construction debris', 'Demolition', 'Pallet pickup'], rating: 4.6, reviewCount: 9 },
  { name: 'Peninsula Donation Movers', city: 'Palo Alto', state: 'CA', bio: 'We pick up donations and route them to local charities. 100% nonprofit-friendly.', services: ['Donation pickup', 'Furniture removal'], rating: 4.9, reviewCount: 21 },
  { name: 'SoCal Cleanouts', city: 'Los Angeles', state: 'CA', bio: 'Apartment trash-outs, hoarding cleanups, estate clearances. Discreet & fast.', services: ['Apartment trash-out', 'Hoarding cleanup', 'Estate clearance'], rating: 4.4, reviewCount: 7 },
  { name: 'Sacramento Recycle Crew', city: 'Sacramento', state: 'CA', bio: 'We sort + divert. Up to 85% of your load can be recycled.', services: ['Sorted hauling', 'Recycling', 'Commercial cleanout'], rating: 4.7, reviewCount: 14 },
]

const SAMPLE_REVIEWERS = [
  { name: 'Marcus T.', email: 'demo.marcus@dumpmaps.org' },
  { name: 'Jenna L.', email: 'demo.jenna@dumpmaps.org' },
  { name: 'Carlos R.', email: 'demo.carlos@dumpmaps.org' },
  { name: 'Priya S.', email: 'demo.priya@dumpmaps.org' },
  { name: 'Dee W.', email: 'demo.dee@dumpmaps.org' },
]

const REVIEW_SNIPPETS = [
  'Showed up on time, hauled away everything in the garage. Will use again.',
  'Quick quote, fair pricing, no surprise fees.',
  "Great communication — texted updates so I didn't have to wait around.",
  'Crew was respectful and careful with my walls.',
  'Got the donation pickup done in under an hour. Beats Junk King for the price.',
  'Handled a sketchy attic cleanout without complaint.',
]

export async function handle(ctx) {
  const { route, method, request, db, requireStaff, uuidv4, NextResponse, handleCORS } = ctx

  if (route !== '/admin/seed/demo-contractors' || method !== 'POST') return null

  const staff = await requireStaff(request, db)
  if (staff instanceof Response) return staff

  // Ensure reviewer users exist
  const reviewerIds = []
  for (const r of SAMPLE_REVIEWERS) {
    let u = await db.collection('users').findOne({ email: r.email })
    if (!u) {
      u = {
        id: uuidv4(), email: r.email, name: r.name,
        role: 'normal_user', accountType: 'resident', accountStatus: 'active',
        karma: 5 + Math.floor(Math.random() * 20),
        createdAt: new Date(),
        isDemo: true,
      }
      await db.collection('users').insertOne(u)
    }
    reviewerIds.push(u.id)
  }

  let createdUsers = 0
  let createdReviews = 0
  for (const d of DEMO) {
    const email = `demo.${d.name.toLowerCase().replace(/[^a-z]+/g, '_')}@dumpmaps.org`
    let user = await db.collection('users').findOne({ email })
    if (!user) {
      user = {
        id: uuidv4(),
        email,
        name: d.name,
        role: 'normal_user',
        accountType: 'contractor',
        primaryProfile: 'contractor',
        communityProfileType: 'contractor',
        profileTypes: ['contractor'],
        city: d.city,
        state: d.state,
        bio: d.bio,
        contractorServices: d.services,
        verificationLevel: 'verified_contractor',
        isVerified: true,
        completedJobs: 25 + Math.floor(Math.random() * 75),
        karma: 50 + Math.floor(Math.random() * 100),
        accountStatus: 'active',
        isDemo: true,
        createdAt: new Date(),
      }
      await db.collection('users').insertOne(user)
      createdUsers += 1
    } else {
      await db.collection('users').updateOne({ id: user.id }, { $set: {
        primaryProfile: 'contractor', communityProfileType: 'contractor', profileTypes: ['contractor'],
        city: d.city, state: d.state, bio: d.bio, contractorServices: d.services,
        verificationLevel: 'verified_contractor', isVerified: true, accountStatus: 'active', isDemo: true,
      } })
    }
    const targetCount = Math.min(d.reviewCount, reviewerIds.length)
    const existing = await db.collection('reviews').countDocuments({ contractorUserId: user.id })
    for (let i = existing; i < targetCount; i++) {
      const rid = reviewerIds[i % reviewerIds.length]
      const reviewer = await db.collection('users').findOne({ id: rid })
      if (!reviewer) continue
      const rating = Math.max(3, Math.min(5, Math.round(d.rating + (Math.random() - 0.4))))
      await db.collection('reviews').insertOne({
        id: uuidv4(),
        contractorUserId: user.id,
        target: 'contractor',
        rating,
        text: REVIEW_SNIPPETS[Math.floor(Math.random() * REVIEW_SNIPPETS.length)],
        jobType: d.services[Math.floor(Math.random() * d.services.length)],
        authorId: rid,
        authorName: reviewer.name,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 86400000)),
      })
      createdReviews += 1
    }
    const all = await db.collection('reviews').find({ contractorUserId: user.id }).toArray()
    const avg = all.length ? all.reduce((s, r) => s + (r.rating || 0), 0) / all.length : 0
    await db.collection('users').updateOne(
      { id: user.id },
      { $set: { contractorRating: Math.round(avg * 10) / 10, contractorReviewCount: all.length } },
    )
  }

  return handleCORS(NextResponse.json({ ok: true, createdUsers, createdReviews, demoContractors: DEMO.length }))
}
