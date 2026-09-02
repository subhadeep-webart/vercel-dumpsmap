'use client'

// ComposerPrompt — the "Share an update…" bar at the top of the feed that opens
// the composer. Purely presentational; the click handler is passed in.
//
// The whole bar is the click target, so the quick icons and the Post button are
// decorative affordances rather than separate actions — they all open the same
// composer. They're marked aria-hidden and the bar carries the single button
// role so screen readers announce one control, not six.

import { Image, Video, BarChart3, MapPin } from 'lucide-react'

// Bare (un-pilled) icons, each keeping its own accent colour.
const QUICK_ICONS = [
  { Icon: Image,     tone: 'text-blue-500' },
  { Icon: Video,     tone: 'text-purple-500' },
  { Icon: BarChart3, tone: 'text-orange-500' },
  { Icon: MapPin,    tone: 'text-red-500' },
]

export default function ComposerPrompt({ user, onOpen, className = '' }) {
  const label = user ? 'Share an update…' : 'Sign in to share an update…'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      aria-label={label}
      className={`flex cursor-pointer items-center gap-3 rounded-[16px] border border-[#E0EBE2] bg-white px-4 py-3 transition hover:border-green-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${className}`}
    >
      <span className="flex-1 truncate text-[16px] font-normal leading-[24px] text-neutral-500">
        {label}
      </span>

      <span aria-hidden className="hidden items-center gap-3 sm:flex">
        {QUICK_ICONS.map(({ Icon, tone }, i) => (
          <Icon key={i} className={`h-5 w-5 ${tone}`} strokeWidth={1.8} />
        ))}
      </span>

      <span
        aria-hidden
        className="ml-1 shrink-0 rounded-md bg-green-800 px-4 py-1.5 text-[14px] font-normal text-white"
      >
        Post
      </span>
    </div>
  )
}
