'use client'

// HubLayout
// ---------------------------------------------------------------------------
// Facebook / LinkedIn style three-column shell for the Activity Hub.
//
//   ┌───────────┬──────────────────────┬───────────┐
//   │  left     │       feed           │   right   │
//   │  (sticky) │   (scrolls)          │  (sticky) │
//   └───────────┴──────────────────────┴───────────┘
//
// Breakpoints:
//   < lg   → feed only (rails hidden; their content belongs in the mobile nav
//            / sheets, not stacked above the feed)
//   lg     → all three columns, rails at their narrow widths
//   xl     → same three, rails widen and the feed gets its full 640px
//
// Both rails are sticky under the AppHeader (Facebook-style): they pin in place
// while the feed scrolls, so the composer, the filters and the nearby list stay
// reachable no matter how far down the feed you are.
//
// The sticky element must NOT be given its own max-height + overflow-y:auto —
// that turns each rail into a private scroll container, which is what made them
// appear to scroll away with the page. Instead the rail is left at its natural
// height and simply pinned. The only case needing a scrollbar is a rail TALLER
// than the viewport, so the overflow rule is applied conditionally via
// `max-h`/`overflow` only at that point (see RAIL_STICKY).
//
// Props:
//   left      — ReactNode for the left rail
//   right     — ReactNode for the right rail
//   children  — the feed column

import React from 'react'

// Sticky offset = AppHeader height (h-14 = 3.5rem) + a little breathing room.
//
// `overflow-y-auto` only bites once the content exceeds max-h, so a short rail
// pins cleanly with no scrollbar while a tall one can still reach its own
// bottom. `overscroll-contain` stops a scroll gesture that bottoms out inside a
// tall rail from chaining onward and yanking the whole page.
const RAIL_STICKY =
  'sticky top-[4.5rem] max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain [scrollbar-width:thin]'

export default function HubLayout({ left, right, children }) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] justify-center gap-4 xl:gap-6">
      {/* Left rail — from lg up.
          NOTE: the asides intentionally inherit the flex row's default
          `items-stretch`. With `items-start` each aside shrink-wraps to its own
          content height, leaving the sticky div inside it nowhere to travel —
          the rail would unpin the moment you scrolled past its height, which
          read as "the panels scroll away with the feed". */}
      <aside className="hidden w-[220px] shrink-0 lg:block xl:w-[280px]">
        <div className={`${RAIL_STICKY} hub-rail space-y-3 pb-6`}>
          {left}
        </div>
      </aside>

      {/* Feed column — always visible, the only column that grows the page */}
      <div className="w-full min-w-0 max-w-[640px] flex-1">
        {children}
      </div>

      {/* Right rail — from lg up, same stretch rule as the left */}
      <aside className="hidden w-[240px] shrink-0 lg:block xl:w-[300px]">
        <div className={`${RAIL_STICKY} hub-rail space-y-3 pb-6`}>
          {right}
        </div>
      </aside>
    </div>
  )
}

// RailCard — shared container for anything dropped into either rail, so the two
// sides stay visually consistent as we fill them in.
export function RailCard({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-neutral-100 px-3.5 py-2.5">
          {title && <h2 className="text-[13px] font-semibold text-neutral-900">{title}</h2>}
          {action}
        </header>
      )}
      <div className="px-3.5 py-3">{children}</div>
    </section>
  )
}
