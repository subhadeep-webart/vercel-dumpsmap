'use client'

// useGroupActions — write/mutation service for the community Groups pages.
//
// Both the list page (join from a card, create a group) and the detail page
// (join, leave, remove a member, post to the group) inlined their own fetch +
// toast + reload for each mutation. That's reusable service logic, so it lives
// here; the pages just call the handlers and pass the reload they want run on
// success. Every action routes through the central api client, shows a
// success/error toast, and mirrors the original confirm() prompts exactly. A
// single `busy` flag disables buttons while a request is in flight.

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { buildCreateGroupPayload } from '@/lib/groups-helpers'

// Pull a human message off an ApiError (the client puts the server's `error`
// field on err.data.error and also on err.message).
function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return fallback
}

export function useGroupActions() {
  const [busy, setBusy] = useState(false)

  const withBusy = useCallback(async (fn) => {
    setBusy(true)
    try {
      return await fn()
    } finally {
      setBusy(false)
    }
  }, [])

  // Join a group. `loggedIn` gates with the same toast the pages showed (the
  // list card said 'Log in to join', the detail page said 'Log in'), and
  // `successMsg` covers the two success wordings ('Joined' vs 'Joined group').
  // Returns true on success.
  const join = useCallback((groupId, { loggedIn, loginMsg = 'Log in', successMsg = 'Joined', onReload } = {}) => {
    if (!loggedIn) { toast.error(loginMsg); return Promise.resolve(false) }
    return withBusy(async () => {
      try {
        await api.post(`/community/groups/${groupId}/join`)
        toast.success(successMsg)
        onReload?.()
        return true
      } catch (e) {
        toast.error(errMsg(e, 'Failed'))
        return false
      }
    })
  }, [withBusy])

  // Leave a group. Confirms first, exactly like the original.
  const leave = useCallback((groupId, { onReload } = {}) => {
    if (!confirm('Leave this group?')) return Promise.resolve(false)
    return withBusy(async () => {
      try {
        await api.post(`/community/groups/${groupId}/leave`)
        toast.success('Left group')
        onReload?.()
        return true
      } catch (e) {
        toast.error(errMsg(e, 'Failed'))
        return false
      }
    })
  }, [withBusy])

  // Remove a member from a group. Confirms first, like the original.
  const kick = useCallback(async (groupId, memberId, { onReload } = {}) => {
    if (!confirm('Remove this member from the group?')) return false
    try {
      await api.del(`/community/groups/${groupId}/members/${memberId}`)
      toast.success('Removed')
      onReload?.()
      return true
    } catch (e) {
      toast.error(errMsg(e, 'Failed'))
      return false
    }
  }, [])

  // Create a group. Returns the created group on success (so the caller can
  // navigate to it) or null on failure.
  const createGroup = useCallback(async (values) => {
    try {
      const j = await api.post('/community/groups', buildCreateGroupPayload(values))
      toast.success('Group created — you are the organizer')
      return j?.group || null
    } catch (e) {
      toast.error(errMsg(e, 'Failed'))
      return null
    }
  }, [])

  // Post to a group. Validation of the title stays in the dialog; this only runs
  // once there's a title. Returns true on success.
  const postToGroup = useCallback((groupId, { title, body }) => withBusy(async () => {
    try {
      await api.post('/community/posts', { category: 'general', title, body, groupId })
      toast.success('Posted to group')
      return true
    } catch (e) {
      toast.error(errMsg(e, 'Failed'))
      return false
    }
  }), [withBusy])

  return { busy, join, leave, kick, createGroup, postToGroup }
}
