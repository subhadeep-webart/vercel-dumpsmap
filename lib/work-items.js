// lib/work-items.js
// ----------------------------------------------------------------------------
// Sprint A — Foundation for the three distinct work modules:
//
//   JOBS                    — funded → bid → award → work_order → complete
//   BOUNTIES                — community-funded → goal reached → contractor claim
//                              → work_order → verified payout
//   VOLUNTEER EVENTS        — no payout → participation → rewards points
//
// All three modules share these subdocuments:
//
//   photos[]        — { url, caption?, uploadedBy, uploadedAt }
//   messages[]      — handled via existing /api/dm/* threads (referenced by id)
//   workOrderId     — once awarded/claimed, a Work Order is auto-created
//   receipts[]      — receipt IDs linked via /api/receipts
//   rewardsAwards[] — ledger entry IDs from rewards engine
//   verified        — contractor verification level required
//
// This file is the canonical SCHEMA + STATE MACHINE definition. The handlers
// in handlers/workItems.js implement only the foundational CRUD endpoints. Full
// flow UIs ship in Sprints C (Jobs), D (Bounties), G (Volunteer Events).
// ----------------------------------------------------------------------------

// ─── States ──────────────────────────────────────────────────────────────────

const JOB_STATES = [
  'draft',           // poster is still composing
  'open',            // accepting bids
  'in_review',       // poster reviewing bids
  'awarded',         // a contractor was chosen → work_order created
  'in_progress',     // work order active
  'completed',       // work confirmed by poster
  'cancelled',       // closed without completion
  'disputed',        // flagged for admin review
]

const BOUNTY_STATES = [
  'draft',
  'funding',         // open for community contributions
  'goal_reached',    // funding threshold met → opens to contractors
  'claimed',         // a contractor accepted → work_order created
  'in_progress',
  'verified',        // proof verified, payout released
  'cancelled',
  'expired',         // funding window closed without hitting goal
]

const VOLUNTEER_STATES = [
  'draft',
  'scheduled',       // open for sign-ups
  'in_progress',     // event happening
  'completed',       // points awarded
  'cancelled',
]

// Min required contractor verification per work-item.
const VERIFICATION_LEVELS = ['basic', 'verified', 'pro', 'elite']

// ─── Default shapes (used by handlers when creating new docs) ───────────────

function newJobDoc({ id, posterId, ...input }) {
  return {
    id,
    kind: 'job',                // discriminator
    posterId,
    title: input.title || '',
    description: input.description || '',
    jobType: input.jobType || 'cleanup',
    location: input.location || { addressLine1: '', city: '', state: '', zip: '', lat: null, lng: null },
    budget: Number(input.budget) || 0,
    negotiable: !!input.negotiable,
    requiredVerification: VERIFICATION_LEVELS.includes(input.requiredVerification) ? input.requiredVerification : 'basic',
    photos: [],
    bids: [],
    awardedContractorId: null,
    workOrderId: null,
    receiptIds: [],
    rewardsAwardIds: [],
    state: 'draft',
    stateHistory: [{ state: 'draft', at: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function newBountyDoc({ id, posterId, ...input }) {
  return {
    id,
    kind: 'bounty',
    posterId,
    title: input.title || '',
    description: input.description || '',
    issueType: input.issueType || 'illegal_dumping',
    location: input.location || { addressLine1: '', city: '', state: '', zip: '', lat: null, lng: null },
    fundingGoalUsd: Number(input.fundingGoalUsd) || 0,
    fundedUsd: 0,
    contributors: [],     // [{ userId, amountUsd, contributedAt }]
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    requiredVerification: VERIFICATION_LEVELS.includes(input.requiredVerification) ? input.requiredVerification : 'verified',
    photos: [],
    claimedContractorId: null,
    workOrderId: null,
    receiptIds: [],
    rewardsAwardIds: [],
    state: 'draft',
    stateHistory: [{ state: 'draft', at: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function newVolunteerEventDoc({ id, organizerId, ...input }) {
  return {
    id,
    kind: 'volunteer_event',
    organizerId,
    title: input.title || '',
    description: input.description || '',
    location: input.location || { addressLine1: '', city: '', state: '', zip: '', lat: null, lng: null },
    scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
    durationMinutes: Number(input.durationMinutes) || 120,
    pointsPerAttendee: Number(input.pointsPerAttendee) || 100,
    capacity: Number(input.capacity) || 0, // 0 = unlimited
    signups: [],          // [{ userId, signedUpAt }]
    checkIns: [],         // [{ userId, checkedInAt, pointsAwarded }]
    photos: [],
    rewardsAwardIds: [],
    state: 'draft',
    stateHistory: [{ state: 'draft', at: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// Standard work-order document — created automatically when a job/bounty is
// awarded/claimed. Reused across both modules.
function newWorkOrderDoc({ id, sourceKind, sourceId, posterId, contractorId, scope, budget }) {
  return {
    id,
    sourceKind,                   // 'job' | 'bounty'
    sourceId,                     // job/bounty id
    posterId,
    contractorId,
    scope: scope || '',
    budget: Number(budget) || 0,
    beforePhotos: [],
    afterPhotos: [],
    timeEntries: [],              // references to time_entries
    receiptIds: [],
    messageThreadId: null,
    signature: null,
    state: 'open',                // open → in_progress → submitted → completed → closed
    stateHistory: [{ state: 'open', at: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// Allowed transitions (server-side guard for state machines)
const JOB_TRANSITIONS = {
  draft: ['open', 'cancelled'],
  open: ['in_review', 'cancelled'],
  in_review: ['awarded', 'open', 'cancelled'],
  awarded: ['in_progress', 'cancelled', 'disputed'],
  in_progress: ['completed', 'disputed', 'cancelled'],
  disputed: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
}
const BOUNTY_TRANSITIONS = {
  draft: ['funding', 'cancelled'],
  funding: ['goal_reached', 'expired', 'cancelled'],
  goal_reached: ['claimed', 'cancelled'],
  claimed: ['in_progress', 'cancelled'],
  in_progress: ['verified', 'cancelled'],
  verified: [],
  expired: [],
  cancelled: [],
}
const VOLUNTEER_TRANSITIONS = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export {
  JOB_STATES, BOUNTY_STATES, VOLUNTEER_STATES, VERIFICATION_LEVELS,
  JOB_TRANSITIONS, BOUNTY_TRANSITIONS, VOLUNTEER_TRANSITIONS,
  newJobDoc, newBountyDoc, newVolunteerEventDoc, newWorkOrderDoc,
}
