'use client'

// useResidentPortal — data for the resident (non-owner) side of the Portal.
//
// Per the client's answers (docs/FACILITY_PORTAL_DEV.md §6 Q3), a regular user /
// resident can: view platform activity, post and accept jobs, and report what they
// observe at a facility (busy/slow, price changed, gate closed). They have no
// access to facility backend management.
//
// Every read reuses an existing endpoint — no new backend beyond the additive
// ?mine=true filter on /jobs:
//   GET /users/me/contributions      → alerts (reports), reviews, submissions
//   GET /jobs?mine=true              → jobs this user posted
//   GET /work-orders?as=contractor   → work this user accepted (a job accepted
//                                      becomes a work order with them as contractor)
//   GET /activity-hub/feed?filter=mine → community posts they authored

import useSWR from 'swr'
import { api } from '@/lib/api-client'

const fetcher = (path) => api.get(path)

// Shared SWR options — these panels are secondary surfaces, so avoid refetch
// storms on tab focus.
const OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

export function useResidentPortal({ enabled = true } = {}) {
  // Reports the user has filed (alerts) + reviews + facility submissions. This
  // endpoint is already user-scoped server-side and returns empty arrays rather
  // than 401 when signed out.
  const { data: contrib, isLoading: contribLoading } = useSWR(
    enabled ? '/users/me/contributions' : null, fetcher, OPTS,
  )

  const { data: postedData, isLoading: postedLoading } = useSWR(
    enabled ? '/jobs?mine=true' : null, fetcher, OPTS,
  )

  const { data: acceptedData, isLoading: acceptedLoading } = useSWR(
    enabled ? '/work-orders?as=contractor' : null, fetcher, OPTS,
  )

  const { data: feedData, isLoading: feedLoading } = useSWR(
    enabled ? '/activity-hub/feed?filter=mine&limit=20' : null, fetcher, OPTS,
  )

  return {
    reports: contrib?.alerts || [],
    reviews: contrib?.reviews || [],
    submissions: contrib?.submissions || [],
    postedJobs: postedData?.jobs || [],
    acceptedWork: acceptedData?.workOrders || [],
    feed: feedData?.feed || [],
    loading: contribLoading || postedLoading || acceptedLoading || feedLoading,
  }
}
