'use client'

// useCountUp
// ---------------------------------------------------------------------------
// Animates a number from 0 up to `target` once its element scrolls into view.
// Returns { ref, value } — attach `ref` to the element you want observed, and
// render `value` (the current animated number).
//
// Kept dependency-free: uses IntersectionObserver + requestAnimationFrame with
// an ease-out curve, so no extra CSS or libraries are needed.

import { useEffect, useRef, useState } from 'react'

export function useCountUp(target, { duration = 2600, startOnView = true } = {}) {
  const ref = useRef(null)
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || started.current) return

    // Respect users who prefer reduced motion — jump straight to the target.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setValue(target); started.current = true; return }

    const run = () => {
      if (started.current) return
      started.current = true
      let rafId
      let startTs = null
      const tick = (ts) => {
        if (startTs === null) startTs = ts
        const progress = Math.min((ts - startTs) / duration, 1)
        // easeOutExpo — long, smooth deceleration into the final value.
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
        setValue(Math.round(target * eased))
        if (progress < 1) rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(rafId)
    }

    if (!startOnView) { run(); return }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          run()
          observer.disconnect()
        }
      },
      { threshold: 0.35 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration, startOnView])

  return { ref, value }
}
