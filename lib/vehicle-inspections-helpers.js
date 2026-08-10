// vehicle-inspections-helpers.js
// ---------------------------------------------------------------------------
// Pure helpers for the Vehicle Inspections pages. Previously inlined in the
// list / detail / new-form components; hoisted here so the three pages and their
// hooks share the same formatting + derivation logic.
//
// Everything here is pure (no React, no I/O): same input → same output, safe to
// call in render and trivial to test.

import { CHECKLIST } from '@/constants/vehicle_inspections_constants'

// phase value → display label ("Pre + Post" / "Post-shift" / "Pre-shift").
export function phaseLabel(phase) {
  return phase === 'both' ? 'Pre + Post' : phase === 'post_shift' ? 'Post-shift' : 'Pre-shift'
}

// checklist camelCase key → sentence-cased label ("backupCamera" → "Backup camera").
export function humanizeChecklistKey(k) {
  return k.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, (c) => c.toUpperCase())
}

// underscore-joined token → spaced label ("check_engine" → "check engine").
export function humanizeToken(s) {
  return String(s || '').replace(/_/g, ' ')
}

// A free-text label ("Check engine") → its stored key ("check_engine").
export function labelToKey(label) {
  return label.toLowerCase().replace(/[^a-z]+/g, '_')
}

// Miles driven from a start/end mileage pair (strings from form inputs). Returns
// 0 unless end is present and >= start.
export function computeMilesDriven(mileageStart, mileageEnd) {
  const a = Number(mileageStart) || 0
  const b = mileageEnd === '' ? null : (Number(mileageEnd) || 0)
  return b != null && b >= a ? b - a : 0
}

// Today's date as 'YYYY-MM-DD' (matches the API's date field).
export function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

// The initial new-inspection form state. Checklist defaults every item to true.
export function emptyInspectionForm() {
  return {
    vehicleNumber: '', vehicleType: '', licensePlate: '', driverName: '',
    date: todayYmd(),
    startTime: '', endTime: '',
    phase: 'pre_shift',
    mileageStart: '', mileageEnd: '',
    fuelStart: 'full', fuelEnd: '',
    dashboardLightsReported: false, dashboardLights: [],
    damageReported: false, damageDescription: '', damageLocations: [], damagePhotos: [],
    loadStatus: 'empty',
    cleanliness: 'clean',
    checklist: Object.fromEntries(CHECKLIST.map(([k]) => [k, true])),
    notes: '',
  }
}

// Coerce the new-inspection form into the create payload (numeric mileage).
export function buildCreatePayload(form) {
  return {
    ...form,
    mileageStart: Number(form.mileageStart) || 0,
    mileageEnd: form.mileageEnd === '' ? null : (Number(form.mileageEnd) || 0),
  }
}

// Coerce the detail "add end-of-shift" draft into the PATCH payload. `existing`
// is the current inspection (used to preserve phase when incomplete).
export function buildEndShiftPayload(draft, existing) {
  return {
    mileageEnd: draft.mileageEnd === '' ? null : Number(draft.mileageEnd) || 0,
    fuelEnd: draft.fuelEnd || null,
    endTime: draft.endTime || '',
    phase: draft.mileageEnd && draft.fuelEnd ? 'both' : existing.phase,
  }
}
