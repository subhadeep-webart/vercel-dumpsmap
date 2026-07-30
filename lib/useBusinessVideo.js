'use client'

// useBusinessVideo
// ---------------------------------------------------------------------------
// Loads the CMS-managed "Request a Demo" video shown in the Business page
// banner. Backed by the platform_settings singleton (businessVideo key) and
// served from the public, unauthenticated settings endpoint.
//
// Uses SWR so the request is cached and deduped across every surface that
// wants the demo video — the banner mounts once but the same key is reused
// app-wide without re-fetching. Keeps the call out of the component:
//
//   const { video, showVideo, isLoading } = useBusinessVideo()
//
// `showVideo` is true only when the video is both enabled and has a URL.

import useSWR from 'swr'
import { api } from '@/lib/api-client'

const KEY = '/platform-settings/public'

const fetcher = (path) => api.get(path, { auth: false })

export function useBusinessVideo() {
  const { data, error, isLoading } = useSWR(KEY, fetcher)

  const video = data?.settings?.businessVideo || null
  const showVideo = !!(video?.enabled && video?.videoUrl)

  return { video, showVideo, isLoading, error }
}
