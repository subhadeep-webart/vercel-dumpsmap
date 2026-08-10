'use client'

// useTimeClockApprovals — manager approval queue for the Time Clock page.
//
// The ApprovalsView used to own a fetch + useEffect load, a manual loading
// flag, and per-id busy state for approve/reject. This hook moves the reads to
// a cached SWR key and the writes to the central api client, so the view is
// purely presentational.

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'

const fetcher = (path) => api.get(path)

function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return fallback
}

export function useTimeClockApprovals() {
  const { data, error, isLoading, mutate } = useSWR(
    '/time-clock/manager/queue?status=submitted',
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )

  // Tracks which entry is currently being approved/rejected, so only that row's
  // buttons disable.
  const [busyId, setBusyId] = useState(null)

  const approve = useCallback(async (id) => {
    setBusyId(id)
    try {
      await api.post(`/time-clock/manager/${id}/approve`, {})
      toast.success('Approved')
    } catch (e) {
      toast.error(errMsg(e, 'Approve failed'))
    } finally {
      setBusyId(null)
      mutate()
    }
  }, [mutate])

  const reject = useCallback(async (id) => {
    const reason = prompt('Rejection reason?')
    if (!reason) return
    setBusyId(id)
    try {
      await api.post(`/time-clock/manager/${id}/reject`, { reason })
      toast.success('Rejected')
    } catch (e) {
      toast.error(errMsg(e, 'Reject failed'))
    } finally {
      setBusyId(null)
      mutate()
    }
  }, [mutate])

  return {
    queue: error ? [] : (data?.entries || []),
    loading: isLoading && !data,
    busyId,
    refresh: () => mutate(),
    approve,
    reject,
  }
}
