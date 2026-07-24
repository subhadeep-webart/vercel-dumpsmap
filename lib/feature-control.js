// lib/feature-control.js
// ---------------------------------------------------------------------------
// Phase A — Super Admin Feature Control System (foundation).
//
// Two storage collections (created lazily by the admin handler):
//   • feature_flags       — global per-feature config (one row per FEATURES key)
//   • feature_grants      — per-account overrides (scope = 'user'|'facility')
//   • feature_audit_log   — every change recorded (writer in the handler)
//
// One source of truth:
//   canAccessFeature(user, featureKey, { facility } = {}, flag, grant)
//      → { allowed, reason, status, viaTrial, isExpired, requiresUpgrade,
//          requiresApply, lockedState }
//
// Design rules (locked):
//   1. Additive gate — feature access requires BOTH:
//        a) the feature is globally Live OR Beta (or Demo for super-admin)
//        b) the user's role is in `allowedRoles` (or they have a per-account
//           grant overriding) AND meets `requiredMembershipTier`
//   2. A per-account grant in `feature_grants` overrides global allowedRoles
//      for that user/facility only.
//   3. Trial: a grant may carry { trialStartAt, trialEndAt } — lazy expiry
//      check happens here (no cron). When expired, `isExpired=true` and
//      `requiresUpgrade=true`.
//   4. Pausing a feature globally hides it for ALL users (admins still see UI
//      but with a "Paused" badge). Data is preserved.
//   5. Not Active globally → hidden entirely, no UI, no API.
//   6. Demo globally → super-admin-only; sample-data preview surface.

const FEATURE_STATUSES = ['demo', 'beta', 'live', 'paused', 'not_active']
const TRIAL_LENGTHS_DAYS = [15, 25, 45] // plus 'custom'
const GRANT_STATUSES = ['active', 'trial', 'paused', 'expired', 'revoked']
const SCOPES = ['user', 'facility'] // 'company' deferred to Phase E

// Membership tier ordering (higher index = higher tier)
const MEMBERSHIP_TIERS = ['free', 'verified_commercial', 'pro_commercial', 'enterprise']

// Built-in feature registry — these are the 10 modules the platform manages.
// `seedDefaults` is the initial state if `feature_flags` collection has no
// row for this key (created on first GET of /admin/feature-flags).
const FEATURES = [
  {
    key: 'timeClock',
    name: 'Contractor Time Clock',
    description: 'Track shift hours, breaks, and job/facility assignments. Submit time entries for approval.',
    category: 'contractor',
    seedDefaults: {
      globalStatus: 'live',
      visibleToUsers: true,
      allowedRoles: ['contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'free',
      trialEligible: false,
      defaultTrialDays: 0,
      notes: 'Already in production. Gate added 2026-06.',
    },
  },
  {
    key: 'commercialB2B',
    name: 'Commercial B2B Marketplace',
    description: 'B2B listings, commercial pricing, application-gated access for verified businesses.',
    category: 'marketplace',
    seedDefaults: {
      globalStatus: 'live',
      visibleToUsers: true,
      allowedRoles: ['user', 'contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'verified_commercial',
      trialEligible: true,
      defaultTrialDays: 25,
      notes: 'Live in production. Membership tier verified_commercial+ required.',
    },
  },
  {
    key: 'membershipPlans',
    name: 'Membership Plans',
    description: 'Verified commercial, Pro commercial, Enterprise membership tiers.',
    category: 'monetization',
    seedDefaults: {
      globalStatus: 'live',
      visibleToUsers: true,
      allowedRoles: ['user', 'contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'free',
      trialEligible: false,
      defaultTrialDays: 0,
      notes: 'Always visible to all users.',
    },
  },
  {
    key: 'rewardsEngine',
    name: 'Rewards Engine',
    description: 'Core rewards platform — verified environmental actions translate to DumpPoints earned at participating facilities.',
    category: 'rewards',
    seedDefaults: {
      globalStatus: 'demo',
      visibleToUsers: false,
      allowedRoles: ['admin', 'super_admin'],
      requiredMembershipTier: 'free',
      trialEligible: true,
      defaultTrialDays: 45,
      notes: 'In design. Visible to Super Admin only as Demo.',
    },
  },
  {
    key: 'rewardsCashout',
    name: 'Rewards Cashout',
    description: 'Convert DumpPoints to cash payouts. Requires Stripe Connect or check disbursement integration.',
    category: 'rewards',
    seedDefaults: {
      globalStatus: 'demo',
      visibleToUsers: false,
      allowedRoles: ['admin', 'super_admin'],
      requiredMembershipTier: 'free',
      trialEligible: false,
      defaultTrialDays: 0,
      notes: 'Cannot go Live until payout rails are wired.',
    },
  },
  {
    key: 'ocrReceiptScanner',
    name: 'AI Receipt Scanner (OCR)',
    description: 'OCR-extract receipt fields from photos (facility, date, weight, total). Powers Rewards Engine.',
    category: 'contractor',
    seedDefaults: {
      globalStatus: 'beta',
      visibleToUsers: true,
      allowedRoles: ['user', 'contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'verified_commercial',
      trialEligible: true,
      defaultTrialDays: 25,
      notes: 'Beta — granted users only see it during testing. Super Admin always. Powered by Gemini 2.5 Flash via Emergent LLM key.',
    },
  },
  {
    key: 'contractorImpactDashboard',
    name: 'Contractor Impact Dashboard',
    description: 'Tons diverted, donations redirected, e-waste recycled, rewards earned, lifetime environmental impact.',
    category: 'contractor',
    seedDefaults: {
      globalStatus: 'demo',
      visibleToUsers: false,
      allowedRoles: ['contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'verified_commercial',
      trialEligible: true,
      defaultTrialDays: 25,
      notes: 'Depends on OCR + Rewards data flows.',
    },
  },
  {
    key: 'fleetManagement',
    name: 'Fleet Management',
    description: 'Multi-vehicle tracking, assignments, fleet-wide vehicle inspections, fleet-wide time clock rollups.',
    category: 'enterprise',
    seedDefaults: {
      globalStatus: 'demo',
      visibleToUsers: false,
      allowedRoles: ['admin', 'super_admin'],
      requiredMembershipTier: 'pro_commercial',
      trialEligible: true,
      defaultTrialDays: 45,
      notes: 'Pro Commercial+ tier required.',
    },
  },
  {
    key: 'enterpriseTeamManagement',
    name: 'Enterprise Team Management',
    description: 'Company-level admin, team seats, role assignments, billing roll-up. Requires companies collection (Phase E).',
    category: 'enterprise',
    seedDefaults: {
      globalStatus: 'demo',
      visibleToUsers: false,
      allowedRoles: ['admin', 'super_admin'],
      requiredMembershipTier: 'enterprise',
      trialEligible: true,
      defaultTrialDays: 45,
      notes: 'Requires companies collection — Phase E.',
    },
  },
  {
    key: 'paymentMethods',
    name: 'Payment Method Profiles',
    description: 'Save cards-on-file with Stripe for marketplace checkouts, memberships, and contractor charges. Cards are tokenized via Stripe SetupIntents — DumpMaps never stores raw card data.',
    category: 'monetization',
    seedDefaults: {
      globalStatus: 'live',
      visibleToUsers: true,
      allowedRoles: ['user', 'contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'free',
      trialEligible: false,
      defaultTrialDays: 0,
      notes: 'Live for all authenticated users. Stripe SetupIntents + lazy-created customer.',
    },
  },
  {
    key: 'facilityRewardsProgram',
    name: 'Facility Rewards Program',
    description: 'Participating facility setting: turn on rewards, set %/fixed/bonus, monthly budget, expiration window.',
    category: 'rewards',
    seedDefaults: {
      globalStatus: 'demo',
      visibleToUsers: false,
      allowedRoles: ['admin', 'super_admin'],
      requiredMembershipTier: 'verified_commercial',
      trialEligible: true,
      defaultTrialDays: 45,
      notes: 'Facility owners self-toggle ONLY if granted by Super Admin AND rewardsEngine is Beta/Live.',
    },
  },
  // ------------------------------------------------------------------
  // Nav-level page visibility controls (added 2026-06).
  // These keys gate the major navigation pages so Super Admin can hide,
  // pause, beta-gate, or fully disable any page without code changes.
  // ------------------------------------------------------------------
  {
    key: 'activityHub',
    name: 'Activity Hub',
    description: 'Unified community feed merging Live Feed + Community posts. Anchors public browsing.',
    category: 'navigation',
    seedDefaults: {
      globalStatus: 'live',
      visibleToUsers: true,
      allowedRoles: ['guest', 'user', 'contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'free',
      trialEligible: false,
      defaultTrialDays: 0,
      notes: 'Public landing surface. Hidden only in extreme rollback scenarios.',
    },
  },
  {
    key: 'facilities',
    name: 'Facilities Directory',
    description: 'Public-browseable directory of recycling, donation, transfer, and disposal facilities. Powers the map experience.',
    category: 'navigation',
    seedDefaults: {
      globalStatus: 'live',
      visibleToUsers: true,
      allowedRoles: ['guest', 'user', 'contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'free',
      trialEligible: false,
      defaultTrialDays: 0,
      notes: 'Public. Disabling hides Map + Facilities tab + Facility detail pages.',
    },
  },
  {
    key: 'marketplace',
    name: 'Marketplace',
    description: 'P2P marketplace (the whole module). Disable to hide all listings, post flow, and detail pages.',
    category: 'navigation',
    seedDefaults: {
      globalStatus: 'live',
      visibleToUsers: true,
      allowedRoles: ['guest', 'user', 'contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'free',
      trialEligible: false,
      defaultTrialDays: 0,
      notes: 'Distinct from commercialB2B which only gates the B2B tab.',
    },
  },
  {
    key: 'jobs',
    name: 'Jobs Board',
    description: 'Public job postings + bid flow + contractor inquiry. Auto-creates Work Orders when accepted.',
    category: 'navigation',
    seedDefaults: {
      globalStatus: 'live',
      visibleToUsers: true,
      allowedRoles: ['guest', 'user', 'contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'free',
      trialEligible: false,
      defaultTrialDays: 0,
      notes: 'Public. Engagement (Bid/Post) is auth-gated; visibility itself is open.',
    },
  },
  {
    key: 'bounties',
    name: 'Bounties',
    description: 'Community-funded cleanup bounties for illegal dumping sites. Contribute / Claim flow.',
    category: 'navigation',
    seedDefaults: {
      globalStatus: 'live',
      visibleToUsers: true,
      allowedRoles: ['guest', 'user', 'contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'free',
      trialEligible: false,
      defaultTrialDays: 0,
      notes: 'Pause to stop new contributions while preserving existing data.',
    },
  },
  {
    key: 'receipts',
    name: 'Receipts Module',
    description: 'Receipt upload, OCR processing, and the user-facing Receipts list. Powers rewards triggers.',
    category: 'contractor',
    seedDefaults: {
      globalStatus: 'live',
      visibleToUsers: true,
      allowedRoles: ['user', 'contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'free',
      trialEligible: false,
      defaultTrialDays: 0,
      notes: 'Distinct from ocrReceiptScanner which only gates the OCR scanner UI.',
    },
  },
  {
    key: 'workOrders',
    name: 'Work Orders',
    description: 'Contractor work order surface — accepted jobs, claimed bounties, scheduled visits, completion proofs.',
    category: 'contractor',
    seedDefaults: {
      globalStatus: 'live',
      visibleToUsers: true,
      allowedRoles: ['contractor', 'admin', 'super_admin'],
      requiredMembershipTier: 'free',
      trialEligible: false,
      defaultTrialDays: 0,
      notes: 'Contractor-only by default.',
    },
  },
]

const FEATURES_BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.key, f]))
const FEATURE_KEYS = FEATURES.map((f) => f.key)

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
function tierAtLeast(userTier, requiredTier) {
  const u = MEMBERSHIP_TIERS.indexOf(String(userTier || 'free'))
  const r = MEMBERSHIP_TIERS.indexOf(String(requiredTier || 'free'))
  if (u === -1) return r === 0 // unknown tier → only ok for free requirement
  return u >= (r === -1 ? 0 : r)
}

function roleAllowed(userRole, allowedRoles) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true
  const role = String(userRole || '').toLowerCase()
  const norm = allowedRoles.map((r) => String(r).toLowerCase())
  return norm.includes(role)
}

function isSuperAdmin(role) {
  return ['super_admin', 'superadmin'].includes(String(role || '').toLowerCase())
}

function isStaff(role) {
  return ['admin', 'super_admin', 'superadmin', 'moderator'].includes(String(role || '').toLowerCase())
}

// Compute lazy trial expiry on a grant. Mutates a returned copy.
function withTrialExpiryComputed(grant) {
  if (!grant) return null
  const now = Date.now()
  const trialEnd = grant.trialEndAt ? new Date(grant.trialEndAt).getTime() : null
  const isTrial = !!trialEnd
  const isExpired = isTrial && now > trialEnd
  let effectiveStatus = grant.status || 'active'
  if (effectiveStatus === 'trial' && isExpired) effectiveStatus = 'expired'
  return {
    ...grant,
    effectiveStatus,
    isExpired,
    daysRemainingInTrial: isTrial && !isExpired ? Math.ceil((trialEnd - now) / 86400000) : null,
  }
}

// ---------------------------------------------------------------------------
// canAccessFeature — the gate
// ---------------------------------------------------------------------------
//   user        — the authenticated user row (or null for guest)
//   featureKey  — one of FEATURE_KEYS
//   flag        — the feature_flags row for this key (may be null → use seed)
//   grant       — the feature_grants row for (scope=user, scopeId=user.id) or
//                 (scope=facility, scopeId=facility.id) — pass whichever the
//                 caller cares about. Pre-loaded by the caller.
//   opts.facility — optional facility context (for facility-scoped features)
//
// Returns object — NEVER throws. Designed for both server gating and UI
// surface decisions.
function canAccessFeature(user, featureKey, opts = {}, flag = null, grant = null) {
  const def = FEATURES_BY_KEY[featureKey]
  if (!def) {
    return { allowed: false, reason: 'unknown_feature', status: 'not_active', viaTrial: false, isExpired: false, requiresUpgrade: false, requiresApply: false, lockedState: 'unknown' }
  }
  const merged = { ...def.seedDefaults, ...(flag || {}) }
  const status = merged.globalStatus || 'not_active'
  const computedGrant = withTrialExpiryComputed(grant)
  const grantStatus = computedGrant?.effectiveStatus || null
  const isExpired = !!computedGrant?.isExpired
  const viaTrial = !!(computedGrant && computedGrant.trialEndAt && grantStatus === 'trial')

  // Super admin always passes (visibility — they can see Demo/Paused/Not Active surfaces).
  if (user && isSuperAdmin(user.role)) {
    return {
      allowed: true,
      reason: 'super_admin',
      status,
      viaTrial,
      isExpired,
      requiresUpgrade: false,
      requiresApply: false,
      lockedState: null,
      grant: computedGrant,
    }
  }

  // Global status checks
  if (status === 'not_active') {
    return { allowed: false, reason: 'feature_not_active', status, viaTrial, isExpired, requiresUpgrade: false, requiresApply: false, lockedState: 'hidden' }
  }
  if (status === 'demo') {
    return { allowed: false, reason: 'demo_super_admin_only', status, viaTrial, isExpired, requiresUpgrade: false, requiresApply: false, lockedState: 'hidden' }
  }
  if (status === 'paused') {
    // Existing users with active grants keep visibility (read-only); new users locked.
    if (computedGrant && grantStatus === 'active') {
      return { allowed: true, reason: 'paused_but_granted_readonly', status, viaTrial, isExpired, requiresUpgrade: false, requiresApply: false, lockedState: 'readonly', grant: computedGrant }
    }
    return { allowed: false, reason: 'feature_paused', status, viaTrial, isExpired, requiresUpgrade: false, requiresApply: false, lockedState: 'paused' }
  }

  // Beta: only granted accounts pass (+ super admin above)
  if (status === 'beta') {
    if (!computedGrant) {
      return { allowed: false, reason: 'beta_not_granted', status, viaTrial, isExpired, requiresUpgrade: false, requiresApply: true, lockedState: 'apply' }
    }
    if (grantStatus === 'revoked' || grantStatus === 'expired') {
      return { allowed: false, reason: `grant_${grantStatus}`, status, viaTrial, isExpired, requiresUpgrade: true, requiresApply: false, lockedState: 'upgrade', grant: computedGrant }
    }
    if (grantStatus === 'paused') {
      return { allowed: false, reason: 'grant_paused', status, viaTrial, isExpired, requiresUpgrade: false, requiresApply: false, lockedState: 'paused', grant: computedGrant }
    }
    return { allowed: true, reason: `beta_granted_${grantStatus || 'active'}`, status, viaTrial, isExpired, requiresUpgrade: false, requiresApply: false, lockedState: null, grant: computedGrant }
  }

  // Live: role + tier gate (or per-account grant overrides)
  // status === 'live'
  if (computedGrant) {
    if (grantStatus === 'revoked' || grantStatus === 'expired') {
      return { allowed: false, reason: `grant_${grantStatus}`, status, viaTrial, isExpired, requiresUpgrade: true, requiresApply: false, lockedState: 'upgrade', grant: computedGrant }
    }
    if (grantStatus === 'paused') {
      return { allowed: false, reason: 'grant_paused', status, viaTrial, isExpired, requiresUpgrade: false, requiresApply: false, lockedState: 'paused', grant: computedGrant }
    }
    // Active/trial grant: overrides role + tier
    return { allowed: true, reason: `granted_${grantStatus || 'active'}`, status, viaTrial, isExpired, requiresUpgrade: false, requiresApply: false, lockedState: null, grant: computedGrant }
  }
  // Public surfaces — when 'guest' is in allowedRoles, anonymous users pass.
  // This lets Super Admin keep pages like Activity Hub, Facilities, Marketplace,
  // Jobs, Bounties, Rewards publicly browseable while still allowing them to
  // hide / pause / beta-gate the same surfaces without a redeploy.
  const guestAllowed = Array.isArray(merged.allowedRoles) && merged.allowedRoles.some((r) => String(r).toLowerCase() === 'guest')
  if (!user) {
    if (guestAllowed) {
      return { allowed: true, reason: 'live_guest_allowed', status, viaTrial: false, isExpired: false, requiresUpgrade: false, requiresApply: false, lockedState: null }
    }
    return { allowed: false, reason: 'auth_required', status, viaTrial, isExpired, requiresUpgrade: false, requiresApply: false, lockedState: 'auth' }
  }
  if (!roleAllowed(user.role, merged.allowedRoles)) {
    return { allowed: false, reason: 'role_not_allowed', status, viaTrial, isExpired, requiresUpgrade: false, requiresApply: true, lockedState: 'apply' }
  }
  const userTier = user.commercialMembership || user.membership || 'free'
  if (!tierAtLeast(userTier, merged.requiredMembershipTier || 'free')) {
    return { allowed: false, reason: 'tier_too_low', status, viaTrial, isExpired, requiresUpgrade: true, requiresApply: false, lockedState: 'upgrade', requiredTier: merged.requiredMembershipTier }
  }
  return { allowed: true, reason: 'live_role_and_tier', status, viaTrial: false, isExpired: false, requiresUpgrade: false, requiresApply: false, lockedState: null }
}

// CommonJS + ESM dual export
const moduleApi = {
  FEATURES,
  FEATURES_BY_KEY,
  FEATURE_KEYS,
  FEATURE_STATUSES,
  TRIAL_LENGTHS_DAYS,
  GRANT_STATUSES,
  SCOPES,
  MEMBERSHIP_TIERS,
  canAccessFeature,
  withTrialExpiryComputed,
  tierAtLeast,
  roleAllowed,
  isSuperAdmin,
  isStaff,
}

if (typeof module !== 'undefined' && module.exports) module.exports = moduleApi

export {
  FEATURES,
  FEATURES_BY_KEY,
  FEATURE_KEYS,
  FEATURE_STATUSES,
  TRIAL_LENGTHS_DAYS,
  GRANT_STATUSES,
  SCOPES,
  MEMBERSHIP_TIERS,
  canAccessFeature,
  withTrialExpiryComputed,
  tierAtLeast,
  roleAllowed,
  isSuperAdmin,
  isStaff,
}
export default moduleApi
