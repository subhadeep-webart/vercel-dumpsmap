'use client'

// TopProgressBar
// ---------------------------------------------------------------------------
// A slim, YouTube/GitHub-style progress bar pinned to the very top of the
// viewport that animates during page navigations. Gives every route change a
// polished "something is happening" cue instead of a dead pause.
//
// Why a hand-rolled bar (no nprogress dependency):
//   The Next.js App Router intentionally does NOT expose router events
//   (routeChangeStart/Complete were a Pages-Router API). So we detect the START
//   of a navigation ourselves — from clicks on internal <a> links and from
//   browser back/forward (popstate) — trickle the bar forward while the next
//   route streams in, then FINISH it when usePathname()/useSearchParams()
//   report the URL actually changed.
//
// Mounted once, globally, from app/layout.js so it covers the whole app.

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { subscribeProgress } from '@/lib/top-progress'

export default function TopProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // width 0..100; visible toggles the fade in/out. `active` guards the trickle.
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const activeRef = useRef(false)
  const trickleRef = useRef(null)
  const doneTimerRef = useRef(null)

  const clearTimers = () => {
    if (trickleRef.current) { clearInterval(trickleRef.current); trickleRef.current = null }
    if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null }
  }

  const start = () => {
    if (activeRef.current) return
    activeRef.current = true
    clearTimers()
    setVisible(true)
    setWidth(8)
    // Trickle toward ~90% while we wait for the route to resolve. Slows as it
    // approaches the ceiling so it never visually "finishes" before the page.
    trickleRef.current = setInterval(() => {
      setWidth((w) => {
        if (w >= 90) return w
        const remaining = 90 - w
        return w + Math.max(0.5, remaining * 0.08)
      })
    }, 200)
  }

  const done = () => {
    if (!activeRef.current) return
    activeRef.current = false
    clearTimers()
    setWidth(100)
    // Hold the full bar a beat, then fade out and reset for the next nav.
    doneTimerRef.current = setTimeout(() => {
      setVisible(false)
      doneTimerRef.current = setTimeout(() => setWidth(0), 250)
    }, 200)
  }

  // Kick the bar off when the user initiates an in-app navigation.
  useEffect(() => {
    const onClick = (e) => {
      // Ignore modified clicks (new tab / download) and non-primary buttons.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target?.closest?.('a')
      if (!a) return
      const href = a.getAttribute('href')
      if (!href || href.startsWith('#') || a.target === '_blank' || a.hasAttribute('download')) return
      // Same-page anchors / external links shouldn't trigger the bar.
      let url
      try { url = new URL(a.href, window.location.href) } catch { return }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      start()
    }
    const onPopState = () => start()

    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPopState)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  // Imperative callers (e.g. FeatureLock's access check) can drive the same bar
  // via startProgress()/stopProgress(). count>0 → work in flight → start;
  // count===0 → all callers done → finish.
  useEffect(() => {
    return subscribeProgress((count) => {
      if (count > 0) start()
      else done()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the resolved URL changes, the navigation has landed — finish the bar.
  useEffect(() => {
    done()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // Tidy up any pending timers on unmount.
  useEffect(() => () => clearTimers(), [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 250ms ease' }}
    >
      <div
        className="h-full rounded-r-full bg-gradient-to-r from-green-600 via-emerald-500 to-blue-600 shadow-[0_0_10px_rgba(16,185,129,0.7)]"
        style={{
          width: `${width}%`,
          transition: 'width 200ms ease',
        }}
      />
    </div>
  )
}
