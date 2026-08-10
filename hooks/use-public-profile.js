'use client'

// usePublicProfile — read-only data loading for the public profile page
// (app/(app)/users/[id]/page.js). Mirrors useProfile's SWR shape but for the
// public, whitelisted projection served at /users/:id/profile-public.
//
// The feed tabs (community posts, marketplace listings) are lazily loaded: their
// SWR keys stay null until the tab is first opened, so a visitor who never
// leaves the About tab never pays for the extra requests. Once loaded, SWR keeps
// them cached for the session.

import useSWR from 'swr'
import { api } from '@/lib/api-client'

const fetcher = (path) => api.get(path)

// Flatten SWR's loading/error/data into the same status machine the page's
// ProfileStates components expect ('loading' | 'error' | 'not-found' | 'ready').
export function usePublicProfile(id) {
  const key = id ? `/users/${encodeURIComponent(id)}/profile-public` : null
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  let status
  if (!id) status = 'loading'
  else if (error) status = error?.code === 'not_found' || error?.status === 404 ? 'not-found' : 'error'
  else if (isLoading || !data) status = 'loading'
  else status = 'ready'

  return {
    status,
    user: data?.user || null,
    isOwner: !!data?.isOwner,
    isPrivate: !!data?.private,
    stats: data?.stats || { posts: 0, listings: 0 },
    retry: () => mutate(),
  }
}

// Lazily fetch a sub-resource ('posts' | 'listings'). Pass enabled=false to
// keep the SWR key null (no request) until the tab is opened.
export function usePublicProfileFeed(id, kind, enabled) {
  const key = id && kind && enabled
    ? `/users/${encodeURIComponent(id)}/profile-public/${kind}`
    : null
  const { data, error, isLoading } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })
  return {
    items: data?.items || [],
    loading: !!key && (isLoading || (!data && !error)),
    error: error || null,
  }
}
