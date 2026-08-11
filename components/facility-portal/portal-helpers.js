'use client'

// Pure formatting + derivation helpers for the Facility Portal. Kept side-effect
// free (no hooks, no fetch) so cards can import them without duplicating logic —
// per the cleanup rules. Data-loading lives in hooks/use-facility-portal.js.

import { timeAgo } from '@/lib/community-categories'
import { CAPACITY_TONE, STRENGTH_FIELDS } from '@/constants/facility_portal_constants'

// Re-export so components import one "portal helpers" surface rather than reaching
// into lib/community-categories directly.
export { timeAgo }

// Format a number as whole-dollar currency. Non-numeric → em dash.
export function money(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

// "Today, 12:35 PM" / "Aug 3, 12:35 PM" — the freshness stamp used across the
// status strip and cards. Falsy/invalid → 'Not yet'.
export function timestamp(d) {
  if (!d) return 'Not yet'
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return 'Not yet'
  const time = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const today = new Date()
  const sameDay =
    dt.getDate() === today.getDate() &&
    dt.getMonth() === today.getMonth() &&
    dt.getFullYear() === today.getFullYear()
  if (sameDay) return `Today, ${time}`
  return `${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}

// "Member since Jan 2024" from a createdAt timestamp.
export function memberSince(d) {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Map a facility's capacity percent → { label, className } using the shared
// buckets. Undefined percent → neutral.
export function capacityTone(pct) {
  const v = Number(pct)
  if (!Number.isFinite(v)) return { label: '—', className: 'text-neutral-500' }
  return CAPACITY_TONE.find((b) => v < b.max) || CAPACITY_TONE[CAPACITY_TONE.length - 1]
}

// Profile Strength: run each checklist item against the facility and return a
// percent + the list of unmet items (used to nudge completion). Empty facility →
// 0%. Kept here (not in the card) so the meter and the nudges agree.
export function profileStrength(facility) {
  if (!facility) return { percent: 0, done: 0, total: STRENGTH_FIELDS.length, missing: STRENGTH_FIELDS }
  const done = STRENGTH_FIELDS.filter((f) => {
    try { return f.test(facility) } catch { return false }
  })
  const missing = STRENGTH_FIELDS.filter((f) => !done.includes(f))
  return {
    percent: Math.round((done.length / STRENGTH_FIELDS.length) * 100),
    done: done.length,
    total: STRENGTH_FIELDS.length,
    missing,
  }
}

// Normalize the many pricing shapes into rate tiles the Pricing card renders:
//   [{ material, rate, unit }]. Prefers pricing.materialPricing[], falls back to
//   a single pricePerTon "General" rate. Empty → [].
export function pricingTiles(facility) {
  const p = facility?.pricing || {}
  const list = Array.isArray(p.materialPricing) ? p.materialPricing : []
  if (list.length) {
    return list.map((m) => ({
      material: m.material || m.name || 'Material',
      rate: m.price ?? m.rate ?? m.pricePerTon,
      unit: m.unit || 'ton',
    }))
  }
  if (p.pricePerTon != null) {
    return [{ material: 'General', rate: p.pricePerTon, unit: 'ton' }]
  }
  return []
}

// Materials accepted → display chips. Returns { visible, extra } so the card can
// show "+N more". `limit` mirrors the mock-up (6 chips + overflow count).
export function materialChips(facility, limit = 6) {
  const all = Array.isArray(facility?.accepted) ? facility.accepted.filter(Boolean) : []
  return { visible: all.slice(0, limit), extra: Math.max(0, all.length - limit), total: all.length }
}

// A facility's display status ('open' | 'busy' | 'closed'), tolerating the couple
// of field names the record has used over time. Defaults to 'open'.
export function facilityStatus(facility) {
  const raw = String(facility?.currentStatus || facility?.liveStatus || 'open').toLowerCase()
  if (raw.includes('clos')) return 'closed'
  if (raw.includes('busy') || raw.includes('wait')) return 'busy'
  return 'open'
}
