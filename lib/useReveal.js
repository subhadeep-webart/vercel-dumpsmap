'use client'

// useReveal
// ---------------------------------------------------------------------------
// Fades + slides an element into view once, the first time it scrolls into the
// viewport. Returns { ref, shown } — attach `ref` to the element you want
// observed, and use `shown` to toggle the "revealed" state.
//
// Dependency-free: uses IntersectionObserver, so the browser does the work
// off the main thread and there is no scroll-listener cost. The actual motion
// is a plain CSS opacity + transform transition (both GPU-accelerated), so
// this adds no measurable performance overhead.

import { useEffect, useRef, useState } from 'react'

export function useReveal({ threshold = 0.15, once = true } = {}) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect users who prefer reduced motion — show immediately, no animation.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setShown(true); return }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setShown(false)
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, once])

  return { ref, shown }
}
