'use client'

// components/SoftLoginModal.jsx
//
// Standalone soft-login modal + a `useRequireAuth()` hook used everywhere
// across the app to gate engagement actions for logged-out users.
//
// Usage:
//   import { useRequireAuth, SoftLoginModal } from '@/components/SoftLoginModal'
//
//   function MyPage() {
//     const { user, requireAuth, softLogin, setSoftLogin } = useRequireAuth()
//     return (
//       <>
//         <Button onClick={() => { if (requireAuth('save')) doSave() }}>Save</Button>
//         <SoftLoginModal action={softLogin} onClose={() => setSoftLogin(null)} />
//       </>
//     )
//   }
//
// Action keys (auto-mapped to friendly headlines):
//   post / like / save / bid / contribute / upload / message / claim / redeem /
//   check-in / comment / share / default

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { api, getAuthToken } from '@/lib/api-client'

const HEADLINES = {
  post: 'Sign in to share a post',
  like: 'Sign in to like posts',
  comment: 'Sign in to comment',
  share: 'Sign in to share',
  save: 'Sign in to save items',
  bid:  'Sign in to bid on jobs',
  contribute: 'Sign in to contribute to bounties',
  upload: 'Sign in to upload',
  message: 'Sign in to send messages',
  claim: 'Sign in to claim',
  redeem: 'Sign in to redeem rewards',
  'check-in': 'Sign in to check in',
  default: 'Sign in to continue',
}

/**
 * Hook: returns { user, requireAuth, softLogin, setSoftLogin }
 * - `user` is auto-loaded from /api/auth/me once on mount.
 * - `requireAuth(action)` returns true when authed, otherwise opens the modal.
 */
export function useRequireAuth() {
  const [user, setUser] = useState(null)
  const [softLogin, setSoftLogin] = useState(null)

  useEffect(() => {
    let cancelled = false
    const token = getAuthToken()
    if (!token) return undefined
    api.get('/api/auth/me')
      .then((j) => { if (!cancelled && j?.user) setUser(j.user) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const requireAuth = (action = 'default') => {
    if (user) return true
    setSoftLogin(action)
    return false
  }

  return { user, requireAuth, softLogin, setSoftLogin }
}

/**
 * Bottom-sheet modal with three actions: Sign in · Create account · Continue
 * browsing. Render this anywhere on the page; toggle via `action` prop.
 */
export function SoftLoginModal({ action, onClose }) {
  const router = useRouter()
  if (!action) return null

  const headline = HEADLINES[action] || HEADLINES.default
  const returnTo = typeof window !== 'undefined' ? window.location.pathname : '/'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="mt-3 text-center text-lg font-extrabold text-neutral-900">{headline}</h2>
        <p className="mt-1 text-center text-sm text-neutral-600">Create a free account or sign in to engage with the community.</p>
        <div className="mt-5 space-y-2">
          <Button className="w-full bg-green-700 hover:bg-green-800" onClick={() => router.push(`/?login=1&returnTo=${encodeURIComponent(returnTo)}`)}>
            Sign in
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.push(`/?signup=1&returnTo=${encodeURIComponent(returnTo)}`)}>
            Create account
          </Button>
          <button onClick={onClose} className="block w-full py-2 text-center text-xs font-semibold text-neutral-500 hover:text-neutral-800">
            Continue browsing
          </button>
        </div>
      </div>
    </div>
  )
}

export default SoftLoginModal
