'use client'

// useStickyCollapse — "has the page scrolled past this point?"
//
// Returns a ref to place on a zero-height sentinel plus a `collapsed` boolean
// that flips true once that sentinel has scrolled up out of view. Used by the
// Activity Hub to shrink its hero + composer panel into a compact sticky bar.
//
// An IntersectionObserver rather than a scroll listener: the browser does the
// work off the main thread and we re-render only on the two transitions,
// instead of on every scroll frame. Same pattern the feed's infinite-scroll
// sentinel already uses.
//
// `rootMargin` shifts the trip point up by the height of whatever is pinned
// above (the sticky AppHeader), so the collapse fires as the sentinel meets the
// bottom of the header rather than the top of the viewport.

import { useEffect, useRef, useState } from 'react'

export function useStickyCollapse({ rootMargin = '0px' } = {}) {
  const sentinelRef = useRef(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { rootMargin, threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])

  return { sentinelRef, collapsed }
}
