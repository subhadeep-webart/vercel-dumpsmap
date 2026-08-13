'use client'

// useFacilityClaim — search for a facility to claim, submit the claim, and track
// its review status. Powers the resident-facing "Claim Your Facility" panel
// (components/facility-portal/panels-claim.jsx).
//
// Per the client's answers (docs/FACILITY_PORTAL_DEV.md §6 Q4): a user finds the
// facility they run, validates that it belongs to them, and accepts the terms;
// once an admin approves, ownership is granted (route.js writes ownedFacilities +
// profileTypes: 'facility_owner') and the facility management tools appear.
//
// The backend already exists in full — this hook only wires the portal into it:
//   GET  /facilities?q=            → search
//   POST /facility-claims          → submit
//   GET  /facility-claims/mine     → status of this user's claims

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

// Don't fire a search until the query is meaningful, and cap the result list so
// the panel stays scannable.
const MIN_QUERY = 2
const MAX_RESULTS = 8

export function useFacilityClaim({ onClaimed } = {}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const trimmed = query.trim()
  const searchKey = trimmed.length >= MIN_QUERY ? `/facilities?q=${encodeURIComponent(trimmed)}` : null

  const { data: searchData, isLoading: searching } = useSWR(
    searchKey,
    (path) => api.get(path),
    { revalidateOnFocus: false, keepPreviousData: true },
  )

  // The list endpoint returns { facilities: [...] } (shape varies by filter path,
  // so accept a bare array too). Already-claimed facilities can't be claimed
  // again — the API 409s — so surface that state in the row instead of hiding it,
  // which would leave the user searching for something they can plainly see.
  const results = useMemo(() => {
    const list = Array.isArray(searchData) ? searchData : searchData?.facilities || []
    return list.slice(0, MAX_RESULTS)
  }, [searchData])

  const submitClaim = useCallback(
    async (form) => {
      if (!selected?.id) {
        toast.error('Pick the facility you manage first')
        return false
      }
      setSubmitting(true)
      try {
        await api.post('/facility-claims', { facilityId: selected.id, ...form })
        toast.success('Claim submitted — our team will verify and reply by email.')
        setSelected(null)
        setQuery('')
        onClaimed?.()
        return true
      } catch (e) {
        // 409 = already claimed / duplicate pending claim. The server's message is
        // specific and user-appropriate, so pass it through.
        toast.error(e.message || 'Could not submit your claim')
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [selected, onClaimed],
  )

  return {
    query, setQuery,
    results, searching: searching && !!searchKey,
    hasQuery: trimmed.length >= MIN_QUERY,
    selected, setSelected,
    submitting, submitClaim,
  }
}
