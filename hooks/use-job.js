'use client'

// useJob — data read for a single job by id (app/(app)/jobs/[id]/page.js).
//
// The page inlined a fetch('/api/jobs/:id') + useEffect + loading/error state.
// This hook owns that as a single cached, deduped SWR key routed through the
// central api client, so re-mounts don't re-fetch and a single reload()
// revalidates after a mutation (accept/save).
//
// Named use-job (single) to avoid colliding with any future jobs-list hook.

import useSWR from 'swr'
import { api } from '@/lib/api-client'

const fetcher = (path) => api.get(path)

const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useJob(id) {
  const key = id ? `/jobs/${id}` : null // null key = no fetch until we have an id
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, SWR_OPTS)

  return {
    // The API may return { job } or the job object directly — match the
    // original page's `j.job || j` fallback.
    job: data ? (data.job || data) : null,
    loading: isLoading && !data,
    error: error || null,
    reload: () => mutate(),
  }
}
