// lib/facility-hours.js
// Best-effort parser for the free-text `hours` field on facility docs.
// The field can be shaped very inconsistently:
//   \"Mon-Fri 8am-5pm\"           \u2192 single range
//   \"Mon-Sat 7am-4pm\"
//   \"M-F 7:30\u20135:00\"
//   \"24/7\"                       \u2192 always open
//   \"Closed\"                     \u2192 always closed
//   \"Mon-Fri 8am-5pm, Sat 9am-2pm\" \u2192 multi-range (best-effort; picks the one that matches today)
//
// Return shape:
//   {
//     isOpen: bool | null,        // null = unknown, couldn't parse
//     todayClose:    '4:00 PM',   // when open now
//     todayOpen:     '7:30 AM',   // when closed but opens later today
//     nextOpenDay:   'Monday',    // when closed today entirely
//     nextOpenTime:  '7:00 AM',
//     raw: '<original string>',   // always present for fallback rendering
//   }
//
// The parser errs on the side of returning { isOpen: null, raw } so the
// caller can gracefully fall back to \"Hours: <raw>\" for unparseable input.

const DAY_TOKENS = {
  sun:  0, sunday:    0, su: 0,
  mon:  1, monday:    1, m:  1,
  tue:  2, tues:      2, tuesday: 2, t: 2,
  wed:  3, weds:      3, wednesday: 3, w: 3,
  thu:  4, thur:      4, thurs:     4, thursday: 4, th: 4, r: 4,
  fri:  5, friday:    5, f:  5,
  sat:  6, saturday:  6, sa: 6,
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function toMinutes(str) {
  // Accepts \"8\", \"8am\", \"08:30\", \"08:30 PM\", \"5pm\", \"17:00\", \"7:30\".
  if (!str) return null
  const s = String(str).trim().toLowerCase().replace(/\s+/g, '')
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ap = m[3]
  if (ap === 'pm' && h < 12) h += 12
  else if (ap === 'am' && h === 12) h = 0
  // Assume 24-hour if no am/pm and h > 12 (e.g. \"17:00\").
  if (!ap && h > 12) { /* already 24h */ }
  if (h < 0 || h > 24 || min < 0 || min > 59) return null
  return h * 60 + min
}

function fmtTime(mins) {
  if (mins == null) return ''
  const h24 = Math.floor(mins / 60) % 24
  const m = mins % 60
  const ap = h24 >= 12 ? 'PM' : 'AM'
  const h12 = ((h24 % 12) === 0) ? 12 : (h24 % 12)
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

// Parse a day token or day-range \"Mon-Fri\" \u2192 [1..5]. Returns null if not a day token.
function parseDayRange(tok) {
  const t = String(tok || '').toLowerCase().trim()
  if (!t) return null
  if (t.includes('-') || t.includes('\u2013') || t.includes('to')) {
    const parts = t.split(/[-\u2013]|to/).map((p) => p.trim())
    if (parts.length === 2) {
      const a = DAY_TOKENS[parts[0]]
      const b = DAY_TOKENS[parts[1]]
      if (a != null && b != null) {
        const out = []
        let i = a
        while (true) { out.push(i); if (i === b) break; i = (i + 1) % 7; if (out.length > 7) break }
        return out
      }
    }
  }
  const single = DAY_TOKENS[t]
  if (single != null) return [single]
  return null
}

// Parse one \"Mon-Fri 8am-5pm\" segment. Returns { days:[0..6], openMin, closeMin }
// or null if unparseable.
function parseSegment(seg) {
  const s = String(seg || '').trim()
  if (!s) return null
  // Find a time range like \"8am-5pm\" or \"7:30-17:00\".
  const rangeMatch = s.match(/([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)\s*[-\u2013]\s*([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)/i)
  if (!rangeMatch) return null
  const openMin  = toMinutes(rangeMatch[1])
  const closeMin = toMinutes(rangeMatch[2])
  if (openMin == null || closeMin == null) return null

  // Day range is everything before the time range.
  const dayPart = s.slice(0, rangeMatch.index).trim()
  const days = parseDayRange(dayPart) || [1, 2, 3, 4, 5] // default weekdays
  return { days, openMin, closeMin }
}

export function parseHours(raw) {
  const out = { isOpen: null, todayClose: '', todayOpen: '', nextOpenDay: '', nextOpenTime: '', raw: raw || '' }
  if (!raw) return out
  const s = String(raw).trim()
  if (!s) return out
  const lower = s.toLowerCase()

  if (/24\s*[\/x]\s*7|24 hours|always open|open 24/i.test(lower)) {
    return { ...out, isOpen: true, todayClose: 'Open 24 hours' }
  }
  if (/^closed\b|permanently closed/i.test(lower)) {
    return { ...out, isOpen: false }
  }

  // Split by comma OR semicolon OR " and " into segments.
  const segments = s.split(/[,;]|\band\b/i).map((x) => x.trim()).filter(Boolean)
  const parsed = segments.map(parseSegment).filter(Boolean)
  if (parsed.length === 0) return out // unparseable — caller falls back to raw

  const now = new Date()
  const today = now.getDay()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  // Check today first.
  for (const seg of parsed) {
    if (seg.days.includes(today)) {
      if (nowMin >= seg.openMin && nowMin < seg.closeMin) {
        return { ...out, isOpen: true, todayClose: fmtTime(seg.closeMin) }
      }
      if (nowMin < seg.openMin) {
        return { ...out, isOpen: false, todayOpen: fmtTime(seg.openMin) }
      }
    }
  }

  // Not open today \u2014 look for next day with hours.
  for (let i = 1; i <= 7; i++) {
    const d = (today + i) % 7
    for (const seg of parsed) {
      if (seg.days.includes(d)) {
        return { ...out, isOpen: false, nextOpenDay: DAY_NAMES[d], nextOpenTime: fmtTime(seg.openMin) }
      }
    }
  }
  return { ...out, isOpen: false }
}

// Convenience: return a single short status line for a facility card.
//   \"\ud83d\udfe2 Open \u00b7 Closes 5:00 PM\"
//   \"\ud83d\udd34 Closed \u00b7 Opens 7:30 AM\"
//   \"\ud83d\udd34 Closed \u00b7 Opens Monday 7:00 AM\"
//   \"Hours: <raw>\"          (fallback when parser can't understand)
//   \"\u2014\"                    (when no hours field at all)
export function getOpenStatusLine(rawHours) {
  if (!rawHours || !String(rawHours).trim()) return { label: '\u2014', tone: 'neutral' }
  const p = parseHours(rawHours)
  if (p.isOpen === true) {
    if (p.todayClose === 'Open 24 hours') return { label: 'Open 24 hours', tone: 'open' }
    return { label: `Open \u00b7 Closes ${p.todayClose}`, tone: 'open' }
  }
  if (p.isOpen === false) {
    if (p.todayOpen)     return { label: `Closed \u00b7 Opens ${p.todayOpen}`, tone: 'closed' }
    if (p.nextOpenDay)   return { label: `Closed \u00b7 Opens ${p.nextOpenDay} at ${p.nextOpenTime}`, tone: 'closed' }
    return { label: 'Closed', tone: 'closed' }
  }
  // Couldn't parse \u2014 show the raw string verbatim so the user still sees it.
  return { label: rawHours, tone: 'neutral' }
}
