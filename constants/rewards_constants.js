// rewards_constants.js
// ---------------------------------------------------------------------------
// Constants for the Rewards page (app/(app)/rewards/page.js) and its hooks.
// Extracted so the page, its sub-components, and the data/action hooks share a
// single source of truth for the earn tiles, redemption tiers, redemption
// status metadata, the points-source labels, and the cashout-method form
// options. Hoisted out of the component so these arrays/maps aren't re-created
// on every render.

import {
  Award, MapPin, Receipt, Users, Recycle, Loader2, CheckCircle2, XCircle,
} from 'lucide-react'

// "How to earn" tiles. Each references a lucide icon component + its point value.
export const EARN_TILES = [
  { icon: MapPin,  label: 'Facility check-in',      pts: 25, hint: 'When you visit a partner site' },
  { icon: Receipt, label: 'Verified receipt',       pts: 50, hint: 'Drop-off / disposal proof' },
  { icon: Recycle, label: 'E-waste / donation',     pts: 75, hint: 'Bonus for high-impact items' },
  { icon: Award,   label: 'First visit bonus',      pts: 100, hint: 'Once per facility' },
  { icon: Users,   label: 'Community post',         pts: 10, hint: 'Wait times, hot spots, tips' },
  { icon: Users,   label: 'Referral',               pts: 250, hint: 'Friends join and check in' },
]

// Cash-out tiers shown on the redemption grid + used by the redeem dialog.
export const REDEMPTION_TIERS = [
  { points: 1000, dollars: 10,  blurb: 'Coffee on us' },
  { points: 2500, dollars: 25,  blurb: 'Fill the tank' },
  { points: 5000, dollars: 50,  blurb: 'Family dinner' },
  { points: 10000, dollars: 100, blurb: 'Pro reward' },
]

// Redemption status → pill colour + icon + label, keyed by redemption.status.
export const STATUS_META = {
  pending:    { tone: 'bg-amber-100 text-amber-800', icon: Loader2, label: 'Pending review' },
  processing: { tone: 'bg-blue-100 text-blue-800',   icon: Loader2, label: 'Processing payout' },
  paid:       { tone: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2, label: 'Paid' },
  rejected:   { tone: 'bg-red-100 text-red-800',     icon: XCircle, label: 'Rejected' },
  cancelled:  { tone: 'bg-neutral-200 text-neutral-700', icon: XCircle, label: 'Cancelled' },
}

// Human labels for ledger `source` codes shown in the activity history.
export const SOURCE_LABELS = {
  facility_check_in:    'Facility check-in',
  receipt_verified:     'Verified receipt',
  first_visit_bonus:    'First-visit bonus',
  donation_receipt:     'Donation receipt',
  ewaste_receipt:       'E-waste receipt',
  transfer_station_receipt: 'Transfer station receipt',
  partner_facility_bonus: 'Partner facility bonus',
  community_post:       'Community post',
  illegal_dump_report:  'Illegal dump report',
  cleanup_event:        'Cleanup event',
  referral_bonus:       'Referral bonus',
  admin_adjustment:     'Admin adjustment',
  redemption:           'Redemption',
}

// Cashout-method type <select> options in the "add method" form.
export const CASHOUT_METHOD_TYPES = [
  { value: 'venmo',           label: 'Venmo' },
  { value: 'cashapp',         label: 'Cash App' },
  { value: 'check',           label: 'Mailed check' },
  { value: 'facility_credit', label: 'Facility credit' },
]

// Default (empty) "add cashout method" form.
export const EMPTY_CASHOUT_METHOD = { type: 'venmo', label: '', email: '' }

// Number of history entries to request for the activity list.
export const HISTORY_LIMIT = 20
