'use client'

// useFacilityActions — write/mutation service for a facility.
//
// The detail page inlined three /api mutations (post owner update, save owner
// edit, watch/save-to-my-facilities), each with its own auth gate, toast, and
// post-success reload. That's reusable service logic, not view logic, so it
// lives here — any facility surface (detail page, a card menu, an admin drawer)
// can call the same actions instead of re-implementing the fetch + toast dance.
//
// The hook is deliberately view-agnostic:
//   • It performs the request, shows the success/error toast, and triggers the
//     caller's onMutated() refresh.
//   • It returns a boolean success so the caller owns UI side-effects (clearing
//     a textarea, leaving edit mode) rather than the hook reaching into state.
//   • saveOwnerEdit takes the raw edit-form object and does the string→array
//     normalization, so callers pass their form as-is.
//
// Usage:
//   const { postUpdate, saveOwnerEdit, watch } = useFacilityActions({
//     id, requireAuth, onMutated: reload,
//   })
//   if (await saveOwnerEdit(editForm)) setEditing(false)

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

// Comma-separated text field → trimmed, de-blanked array.
function toList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function useFacilityActions({ id, requireAuth, onMutated } = {}) {
  // Optional auth gate — falls back to allow when no gate is provided (e.g.
  // an admin context that has already checked permission).
  const gate = useCallback((action) => (requireAuth ? requireAuth(action) : true), [requireAuth])

  // Per-action in-flight flags so the UI can show a spinner and disable the
  // button while a request is running — which also prevents double-submits.
  const [pending, setPending] = useState({ post: false, save: false, watch: false })
  const setBusy = (key, v) => setPending((p) => ({ ...p, [key]: v }))

  // Post an official owner/staff update. Returns true on success so the caller
  // can clear its composer.
  const postUpdate = useCallback(async (text) => {
    if (!gate('post')) return false
    if (!String(text || '').trim()) { toast.error('Write an update first'); return false }
    setBusy('post', true)
    try {
      await api.post(`/facilities/${id}/owner-updates`, { text, type: 'OWNER_UPDATE' })
      toast.success('Update posted')
      onMutated?.()
      return true
    } catch {
      toast.error('Failed')
      return false
    } finally {
      setBusy('post', false)
    }
  }, [id, gate, onMutated])

  // Save owner-editable fields. Accepts the raw edit form; normalizes the
  // comma-separated material lists. Returns true on success.
  const saveOwnerEdit = useCallback(async (editForm = {}) => {
    const payload = {
      hours: editForm.hours,
      phone: editForm.phone,
      website: editForm.website,
      currentStatus: editForm.currentStatus,
      accepted: toList(editForm.accepted),
      notAccepted: toList(editForm.notAccepted),
    }
    setBusy('save', true)
    try {
      await api.patch(`/facilities/${id}/owner-update`, payload)
      toast.success('Saved')
      onMutated?.()
      return true
    } catch {
      toast.error('Save failed')
      return false
    } finally {
      setBusy('save', false)
    }
  }, [id, onMutated])

  // Add the facility to the current user's saved/watched list.
  const watch = useCallback(async () => {
    if (!gate('save')) return false
    setBusy('watch', true)
    try {
      await api.post(`/facilities/${id}/watch`)
      toast.success('Saved to your facilities')
      return true
    } catch {
      toast.error('Could not save')
      return false
    } finally {
      setBusy('watch', false)
    }
  }, [id, gate])

  return { postUpdate, saveOwnerEdit, watch, pending }
}
