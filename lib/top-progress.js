'use client'

// top-progress
// ---------------------------------------------------------------------------
// Tiny imperative controller for the global <TopProgressBar>. Lets any part of
// the app start/finish the top loading bar without prop-drilling — e.g. a
// data/access check that wants to signal "work in progress" via the same slim
// bar used for route changes, instead of blanking the page with a spinner.
//
// Usage:
//   import { startProgress, stopProgress } from '@/lib/top-progress'
//   startProgress('feature-access')   // begin (keyed so concurrent callers don't fight)
//   ...await work...
//   stopProgress('feature-access')    // end
//
// Keys are ref-counted: the bar stays active until EVERY active key has
// stopped, so two overlapping checks won't cut each other's bar short.

const EVT = 'dm:top-progress'
const active = new Set()

function emit() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVT, { detail: { count: active.size } }))
}

export function startProgress(key = 'default') {
  if (typeof window === 'undefined') return
  active.add(key)
  emit()
}

export function stopProgress(key = 'default') {
  if (typeof window === 'undefined') return
  active.delete(key)
  emit()
}

export function subscribeProgress(handler) {
  if (typeof window === 'undefined') return () => {}
  const fn = (e) => handler(e.detail?.count ?? 0)
  window.addEventListener(EVT, fn)
  return () => window.removeEventListener(EVT, fn)
}

export const TOP_PROGRESS_EVENT = EVT
