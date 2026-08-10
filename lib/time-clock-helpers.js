// time-clock-helpers.js
// ---------------------------------------------------------------------------
// Pure helper functions for the Time Clock page. These were previously inlined
// at the top and bottom of app/(app)/time-clock/page.js; hoisting them here
// keeps the page/view components focused on rendering and lets the data/action
// hooks share the same formatting + derivation logic.
//
// Everything here is pure (no React, no I/O): given the same input it returns
// the same output, so it's safe to call in render and trivial to unit-test.

import { MANAGER_ROLES } from '@/constants/time_clock_constants'

// --- Duration / time formatting --------------------------------------------

// Minutes → "2h 05m".
export function fmtMinutes(m = 0) {
  const total = Math.max(0, Math.round(m))
  const h = Math.floor(total / 60)
  const mm = total % 60
  return `${h}h ${String(mm).padStart(2, '0')}m`
}

// Seconds → "HH:MM:SS" for the live running clock.
export function fmtClockHM(sec) {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

// ISO string → localized time ("9:05 AM"), or an em dash when absent/invalid.
export function fmtTime(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }
  catch { return '—' }
}

// ISO string → localized short date ("Aug 5").
export function fmtDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) }
  catch { return '—' }
}

// --- Date-key helpers -------------------------------------------------------

// A date → 'YYYY-MM-DD' key (matches entry.date from the API).
export function ymd(d = new Date()) {
  return new Date(d).toISOString().slice(0, 10)
}

// datetime-local <input> wants 'YYYY-MM-DDTHH:mm' in local time (no trailing Z).
export function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// datetime-local value → ISO string (or null when empty).
export function fromLocalInput(v) {
  return v ? new Date(v).toISOString() : null
}

// Monday (00:00 local) of the week containing d.
export function mondayOf(d) {
  const day = d.getDay() // 0 = Sun
  const offset = (day + 6) % 7
  const m = new Date(d)
  m.setDate(d.getDate() - offset)
  m.setHours(0, 0, 0, 0)
  return m
}

// d shifted by n days (new Date, non-mutating).
export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// --- Domain derivations -----------------------------------------------------

// Is this user a manager (unlocks the approval queue)?
export function isManagerUser(user) {
  if (!user) return false
  return (
    MANAGER_ROLES.includes(user.role) ||
    MANAGER_ROLES.includes(user.profileType) ||
    user.isManager === true
  )
}

// The currently-open break on an active entry (started, not yet ended), or null.
export function openBreakOf(active) {
  if (!active || !Array.isArray(active.breaks)) return null
  return active.breaks.find((b) => b && !b.endAt) || null
}

// Live worked-seconds for an active entry: wall time since clock-in minus the
// duration of every break (open breaks count up to `now`). `now` is a
// millisecond timestamp so the caller controls the ticking cadence.
export function elapsedSecondsOf(active, now) {
  if (!active) return 0
  const startMs = new Date(active.clockInAt).getTime()
  let breakMs = 0
  for (const b of active.breaks || []) {
    if (!b?.startAt) continue
    const bs = new Date(b.startAt).getTime()
    const be = b.endAt ? new Date(b.endAt).getTime() : now
    if (be > bs) breakMs += be - bs
  }
  return Math.max(0, (now - startMs - breakMs) / 1000)
}

// Sum of netMinutes over an array of entries.
export function sumNetMinutes(entries = []) {
  return entries.reduce((a, e) => a + (e?.netMinutes || 0), 0)
}
