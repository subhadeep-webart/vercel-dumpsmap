// Wait-time helpers shared by any surface that shows "how long is the queue".
//
// Wait times aren't a field on the facility — they arrive as active `alerts`
// carrying `waitMinutes`, attached to each facility doc by the API's
// attachActiveAlerts(). These helpers pull the freshest such alert out and turn
// its minutes into the banded label the designs use ("0–5 min wait" rather than
// a spuriously precise "3 min wait").

// Bands are inclusive of `max`. The last band has no max and renders as "60+".
const WAIT_BANDS = [
  { max: 5,  label: '0-5 min wait',   tone: 'text-green-700' },
  { max: 15, label: '5-15 min wait',  tone: 'text-green-700' },
  { max: 30, label: '15-30 min wait', tone: 'text-amber-600' },
  { max: 60, label: '30-60 min wait', tone: 'text-amber-600' },
  { max: Infinity, label: '60+ min wait', tone: 'text-red-600' },
]

// The most recent active alert that actually reports a wait. activeAlerts is
// already sorted newest-first by the API.
export function findWaitAlert(facility) {
  return (facility?.activeAlerts || []).find((a) => a.waitMinutes != null) || null
}

// → { label, tone } for a facility, or null when no active alert reports a wait.
// Callers decide what to render in the null case (the rail card shows the
// facility's open/closed line instead).
export function getWaitBand(facility) {
  const alert = findWaitAlert(facility)
  if (!alert) return null
  const mins = Number(alert.waitMinutes)
  if (!Number.isFinite(mins) || mins < 0) return null
  return WAIT_BANDS.find((b) => mins <= b.max) || null
}

// Distance for a compact one-line display: "2.1m" is miles, matching the
// designs. The API returns kilometres, so convert.
const KM_PER_MILE = 1.609344

export function formatDistanceMi(distanceKm) {
  if (distanceKm == null || !Number.isFinite(Number(distanceKm))) return null
  const mi = Number(distanceKm) / KM_PER_MILE
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)}m`
}
