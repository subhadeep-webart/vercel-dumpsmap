'use client'

// Shared small building blocks for the Activity Hub feed cards.

import SafeImage from '@/components/SafeImage'

// Compact icon+count action used in the user-post card footer (like / save /
// share). `active` swaps in `activeTone`; when the tone includes a `fill-*`
// class the icon fills too.
export function ActionButton({ onClick, active, icon: Icon, label, activeTone }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition ${active ? activeTone : 'text-neutral-600'} hover:bg-neutral-100`}
    >
      <Icon className={`h-4 w-4 ${active && /fill-/.test(activeTone) ? 'fill-current' : ''}`} />
      {label !== '' && <span>{label}</span>}
    </button>
  )
}

// Author avatar with an initials fallback. A 58px rounded square (8px radius),
// per the feed-card design — squared off rather than the circle used elsewhere
// in the app. The spec's 59x58 is squared to 58 on both axes: a 1px difference
// is invisible as intent and reads as a rendering slip.
export function AuthorAvatar({ author }) {
  const url = author?.avatarUrl
  const initials = ((author?.name || 'U')[0] || 'U').toUpperCase()
  return (
    <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-100 text-base font-bold text-brand-700 ring-1 ring-black/5 sm:h-[58px] sm:w-[58px] sm:text-lg">
      {url ? <SafeImage src={url} alt="" kind="avatar" fallbackWhenEmpty="none" className="h-full w-full object-cover" /> : initials}
    </div>
  )
}

// Terse relative time: now, 5m, 3h, 2d, 4mo, 1y.
export function timeAgoShort(d) {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  const s = Math.round(ms / 1000)
  if (s < 60) return 'now'
  const m = Math.round(s / 60); if (m < 60) return `${m}m`
  const h = Math.round(m / 60); if (h < 24) return `${h}h`
  const day = Math.round(h / 24); if (day < 30) return `${day}d`
  const mo = Math.round(day / 30); if (mo < 12) return `${mo}mo`
  return `${Math.round(mo / 12)}y`
}

// Long-form relative time for the feed-card footer: "Just now", "15 min ago",
// "3 hours ago", "2 days ago".
//
// Distinct from timeAgoShort() above, which is the terse "15m" form used where
// space is tight. This one carries its own "ago" (and omits it for "Just now",
// which reads wrong with a suffix), so callers render it verbatim rather than
// appending anything.
export function timeAgoLong(d) {
  if (!d) return ''
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'Just now'

  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`

  const h = Math.round(m / 60)
  if (h < 24) return plural(h, 'hour')

  const day = Math.round(h / 24)
  if (day < 30) return plural(day, 'day')

  const mo = Math.round(day / 30)
  if (mo < 12) return plural(mo, 'month')

  return plural(Math.round(mo / 12), 'year')
}

function plural(n, unit) {
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`
}

// Compact engagement counts for the feed-card pills: abbreviate thousands
// ("1.3k") and millions ("2.4m"), and pad single digits to two ("09") so the
// pills keep a steady width at low counts.
//
// Zero returns null, NOT "00" — a pill with no engagement shows just its icon,
// the way every social feed does. Callers render `formatCount(n)` straight into
// the label; ReactionPill drops a null/'' label.
export function formatCount(n) {
  const v = Number(n) || 0
  if (v === 0) return null
  if (v >= 1_000_000) return `${trimZero(v / 1_000_000)}m`
  if (v >= 1_000) return `${trimZero(v / 1_000)}k`
  return v < 10 ? String(v).padStart(2, '0') : String(v)
}

// 1.0k → 1k, 1.3k stays 1.3k.
function trimZero(v) {
  const s = v.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

// Pill-shaped engagement button used in the feed-card footer (like / comment /
// share). Outlined by default; `active` swaps in the filled tone.
export function ReactionPill({ onClick, active, icon: Icon, label, activeTone = '', title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[13px] ${
        active
          ? `border-transparent ${activeTone}`
          : 'border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
      }`}
    >
      <Icon className={`h-4 w-4 ${active && /fill-/.test(activeTone) ? 'fill-current' : ''}`} />
      {label !== '' && label != null && <span>{label}</span>}
    </button>
  )
}
