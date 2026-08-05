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

// Round author avatar with an initials fallback.
export function AuthorAvatar({ author }) {
  const url = author?.avatarUrl
  const initials = ((author?.name || 'U')[0] || 'U').toUpperCase()
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-bold text-brand-700 ring-1 ring-black/5">
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
