'use client'

// useFeatureControls — all data reads for the Feature Controls admin page.
//
// The page component used to inline a two-way Promise.all against the
// feature-flags endpoints (list + audit log) plus its own loading flag and a
// bespoke `load()` callback re-run on every refresh. This hook owns that: each
// endpoint is a cached, deduped SWR key, so tab switches and re-mounts don't
// re-fetch, and a single `reload()` revalidates both after a mutation.
//
// All requests go through the central api client (lib/api-client), so auth,
// CSRF, headers, JSON parsing, and timeout are handled in one place.

import useSWR from 'swr'
import { api } from '@/lib/api-client'
import { AUDIT_LIMIT } from '@/constants/feature_controls_constants'
import { countByStatus } from '@/lib/feature-controls-helpers'

const fetcher = (path) => api.get(path)

// Don't hammer the API on window focus, and don't retry a failed request in a
// loop (the page shows empty lists instead).
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useFeatureControls() {
  const flagsReq = useSWR('/admin/feature-flags', fetcher, SWR_OPTS)
  const auditReq = useSWR(`/admin/feature-flags/audit?limit=${AUDIT_LIMIT}`, fetcher, SWR_OPTS)

  const flags = flagsReq.data?.flags || []
  const loading = flagsReq.isLoading || auditReq.isLoading

  // Revalidate both reads at once — call after any mutation.
  const reload = () => {
    flagsReq.mutate()
    auditReq.mutate()
  }

  return {
    flags,
    statuses: flagsReq.data?.featureStatuses || [],
    tiers: flagsReq.data?.membershipTiers || [],
    roles: flagsReq.data?.validRoles || [],
    audit: auditReq.data?.entries || [],
    counters: countByStatus(flags),
    loading,
    reload,
  }
}
