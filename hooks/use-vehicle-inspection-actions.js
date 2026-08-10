'use client'

// useVehicleInspectionActions — write/mutation service for the Vehicle
// Inspections pages (new-form create, detail end-of-shift update + delete, and
// the shared damage-photo upload).
//
// Every action routes through the central api client (lib/api-client). These
// pages surface failures via their own inline error banners rather than toasts,
// so the mutating actions return a result object ({ ok, ... , error? }) and let
// the caller render the message — keeping the existing UX identical. A single
// `busy` flag lets callers disable buttons while a request is in flight.
//
// Usage:
//   const actions = useVehicleInspectionActions()
//   const res = await actions.create(payload)
//   if (res.ok) router.push(`/vehicle-inspections/${res.inspection.id}`)

import { useCallback, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'

// Pull a human message off an ApiError (the client puts the server's `error`
// field on err.data.error and also on err.message).
function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return String(e?.message || e || fallback)
}

export function useVehicleInspectionActions() {
  const [busy, setBusy] = useState(false)

  // Create a new inspection. Returns { ok, inspection?, error? }.
  const create = useCallback(async (payload) => {
    setBusy(true)
    try {
      const j = await api.post('/vehicle-inspections', payload)
      return { ok: true, inspection: j.inspection }
    } catch (e) {
      return { ok: false, error: errMsg(e, 'Save failed') }
    } finally {
      setBusy(false)
    }
  }, [])

  // Update an inspection (used for adding end-of-shift data). Returns
  // { ok, inspection?, error? }.
  const update = useCallback(async (id, payload) => {
    setBusy(true)
    try {
      const j = await api.patch(`/vehicle-inspections/${id}`, payload)
      return { ok: true, inspection: j.inspection }
    } catch (e) {
      return { ok: false, error: errMsg(e, 'Save failed') }
    } finally {
      setBusy(false)
    }
  }, [])

  // Soft-delete an inspection after a confirm. Returns true on success.
  const remove = useCallback(async (id) => {
    if (!confirm('Delete this inspection? This soft-deletes the record.')) return false
    try {
      await api.del(`/vehicle-inspections/${id}`)
      return true
    } catch {
      return false
    }
  }, [])

  // Upload a damage photo (multipart). Returns { ok, url?, error? }.
  const uploadPhoto = useCallback(async (file) => {
    try {
      const fd = new FormData()
      fd.append('file', file)
      const j = await api.post('/upload', fd)
      return { ok: true, url: j?.url || j?.fileUrl || j?.path }
    } catch (e) {
      return { ok: false, error: errMsg(e, 'Upload failed') }
    }
  }, [])

  return { busy, create, update, remove, uploadPhoto }
}
