'use client'

// useProfile — all data loading + saving for the /profile editor.
//
// The page component used to inline the whole bootstrap lifecycle in a
// useEffect: read the token, fetch /api/users/me/profile through an
// AbortController with an 8s watchdog, branch auth failures into a redirect,
// hydrate the editable `form`, and run a hand-rolled loading/timeout/error
// state machine. That put a lot of heavy async plumbing in the render path and
// made the page hard to read. This hook owns all of it and hands the page back
// a flat, ready-to-render result.
//
// Fetching goes through SWR (keyed on the profile endpoint) so the request is
// cached and deduped, revalidates on focus/reconnect, and — crucially — gives
// us a `mutate` we can push the PATCH response into, keeping the cache and the
// rendered profile in lock-step without a manual reload.
//
// `form` is deliberately NOT SWR state: it's the editable draft backing the
// controlled inputs (saved on blur). We seed it once from the first server
// snapshot, then it's user-owned; `save()` writes to the API and folds the
// normalised server response back into both `form` and the SWR cache.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { clearAuthToken } from '@/hooks/use-logout'
import { DEFAULT_NOTIFICATIONS } from '@/constants/profile_constants'
import { resolveAvatar } from '@/components/profile/primitives'

const PROFILE_KEY = '/api/users/me/profile'
const LOGIN_REDIRECT = '/?login=1&returnTo=/profile'

const fetcher = (path) => api.get(path)

// Value equality for the save() dirty check. Handles the shapes the tabs write:
// strings, numbers, arrays (zip codes, payment methods, documents), and the
// notifications object. Empty string, null, and undefined are treated as the
// same "unset" value, so a never-set server field (undefined) doesn't read as
// different from an empty input ('').
function isEqual(a, b) {
  const emptyA = a === '' || a === null || a === undefined
  const emptyB = b === '' || b === null || b === undefined
  if (emptyA && emptyB) return true
  if (typeof a === 'object' || typeof b === 'object') {
    try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
  }
  return a === b
}

// Map a raw user record → the editable form draft. Every field is coerced to a
// safe default so the inputs stay controlled from the first render.
function toForm(u) {
  return {
    name: u.name || '',
    email: u.email || '',
    phone: u.phone || '',
    addressLine1: u.addressLine1 || '',
    addressLine2: u.addressLine2 || '',
    city: u.city || '',
    state: u.state || '',
    zip: u.zip || '',
    bio: u.bio || '',
    companyName: u.companyName || '',
    website: u.website || '',
    avatarUrl: resolveAvatar(u),
    profilePhotoUrl: resolveAvatar(u),
    coverImageUrl: u.coverImageUrl || '',
    serviceAreaRadiusMi: u.serviceAreaRadiusMi ?? 25,
    availabilityStatus: u.availabilityStatus || 'available',
    profileVisibility: u.profileVisibility || 'public',
    paymentMethodsAccepted: Array.isArray(u.paymentMethodsAccepted) ? u.paymentMethodsAccepted : [],
    profileType: u.profileType || '',
    businessType: u.businessType || '',
    ein: u.ein || '',
    isRepresentative: u.isRepresentative || 'independent',
    zipCodes: Array.isArray(u.zipCodes) ? u.zipCodes : [],
    preferredZones: Array.isArray(u.preferredZones) ? u.preferredZones : [],
    notifications: u.notifications || { ...DEFAULT_NOTIFICATIONS },
    documents: Array.isArray(u.documents) ? u.documents : [],
  }
}

export function useProfile() {
  const router = useRouter()

  // The session now lives in an httpOnly cookie that JS can't read, so we can't
  // pre-check for a token. Always ask the server; a 401/403 (handled below as
  // an auth failure) is what bounces an unauthenticated visitor to login.
  const { data, error, isLoading, mutate } = useSWR(
    PROFILE_KEY,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )

  const user = data?.user || null

  // Latest persisted user, read inside save()'s dirty check without making save
  // depend on `user` (which would re-create the callback on every profile change
  // and cascade fresh props through every tab).
  const userRef = useRef(user)
  userRef.current = user

  const [form, setForm] = useState({})
  const [savingField, setSavingField] = useState(null)
  // Seed the editable draft from the first server snapshot only; after that the
  // form is user-owned and save() keeps it in sync with the server.
  const seededRef = useRef(false)
  useEffect(() => {
    if (user && !seededRef.current) {
      seededRef.current = true
      setForm(toForm(user))
    }
  }, [user])

  // An ApiError carrying a status (401/403/etc.) means the token is bad — clear
  // it and send the user to login, mirroring the old `!r.ok` auth branch. A
  // 200 with no user body is the same signal.
  const isAuthFailure =
    (error?.name === 'ApiError' && !!error.status) ||
    (!!data && !data.user)
  useEffect(() => {
    if (isAuthFailure) {
      clearAuthToken()
      router.replace(LOGIN_REDIRECT)
    }
  }, [isAuthFailure, router])

  // Patch a field (or a few) and toast success/error. Avatar/cover writes mirror
  // profilePhotoUrl ↔ avatarUrl so every other surface picks up the new photo.
  // The server's normalised user is folded back into both the form draft and the
  // SWR cache (no revalidation needed — the PATCH already returned fresh data).
  const save = useCallback(async (patch, label) => {
    // Skip no-op saves. Blurring an untouched field (or re-selecting the same
    // availability/toggle) fires onBlur/onClick with a value that already
    // matches the server — persisting it would spam the API and toast a
    // misleading "updated". Only proceed when at least one key really differs
    // from the persisted record.
    const current = userRef.current
    if (current && Object.keys(patch).every((k) => isEqual(patch[k], current[k]))) {
      return true
    }

    setSavingField(label)
    try {
      const payload = { ...patch }
      if (payload.avatarUrl !== undefined || payload.profilePhotoUrl !== undefined) {
        const v = payload.profilePhotoUrl ?? payload.avatarUrl ?? ''
        payload.avatarUrl = v
        payload.profilePhotoUrl = v
      }
      const j = await api.patch(PROFILE_KEY, payload)
      if (j?.user) mutate({ user: j.user }, { revalidate: false })
      const next = {}
      for (const k of Object.keys(payload)) {
        next[k] = j?.user ? (j.user[k] ?? payload[k]) : payload[k]
      }
      setForm((f) => ({ ...f, ...next }))
      toast.success(`${label} updated`)
      return true
    } catch (e) {
      toast.error(e.message || 'Save failed')
      return false
    } finally {
      setSavingField(null)
    }
  }, [mutate])

  // Derive the page's status machine from SWR + the redirect branches.
  let status
  if (isAuthFailure) status = 'redirecting'
  else if (error) status = error?.code === 'timeout' ? 'timeout' : 'error'
  else if (isLoading || !user) status = 'loading'
  else status = 'ready'

  return {
    status,
    user,
    form,
    setForm,
    save,
    savingField,
    retry: () => mutate(),
  }
}
