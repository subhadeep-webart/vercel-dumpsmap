'use client'

// useReceiptsActions — write/mutation service for the Receipt Center page.
//
// The page + its sub-components inlined six /api mutations: delete a receipt,
// save (create/edit) a receipt, batch-create receipts, and upload a receipt
// photo. Those are reusable service calls, not view logic, so they live here;
// the page and the form/batch panels just call the handlers and render.
//
// Every action routes through the central api client (auth + CSRF handled
// there). Behaviour is kept identical to the original page:
//   • delete asks the same confirm() and silently reloads on success,
//   • save / batch / upload surface their error message to the caller (the
//     form + batch panels show it inline in their own red error banner), so
//     these return { ok, ... } / throw rather than firing a toast.
//
// errMsg() pulls the server's `error` field off a thrown ApiError, matching the
// old `j.error || 'fallback'` shape.

import { useCallback, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'

// Human message off an ApiError (the client puts the server's `error` field on
// err.data.error and also on err.message).
function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return (e && e.message) || fallback
}

export function useReceiptsActions({ onMutated } = {}) {
  const [busy, setBusy] = useState(false)

  // Delete a receipt: same confirm prompt as before, reload on success. No
  // toast — the original UI showed none.
  const remove = useCallback(async (id) => {
    if (!confirm('Delete this receipt? This cannot be undone.')) return
    setBusy(true)
    try {
      await api.del(`/receipts/${id}`)
      onMutated?.()
    } catch {
      // Original code only reloaded on ok; a failed delete was a no-op.
    } finally {
      setBusy(false)
    }
  }, [onMutated])

  // Create (POST) or edit (PATCH) a single receipt. `receiptId` present → edit.
  // Returns { ok, receipt?, error? }; the form renders the error inline.
  const saveReceipt = useCallback(async (payload, receiptId) => {
    try {
      const j = receiptId
        ? await api.patch(`/receipts/${receiptId}`, payload)
        : await api.post('/receipts', payload)
      return { ok: true, receipt: j?.receipt }
    } catch (e) {
      return { ok: false, error: errMsg(e, 'Save failed') }
    }
  }, [])

  // Batch-create receipts. Returns { ok, result?, error? }; the batch panel
  // renders the error inline.
  const saveBatch = useCallback(async (payload) => {
    try {
      const j = await api.post('/receipts/batch', payload)
      return { ok: true, result: j }
    } catch (e) {
      return { ok: false, error: errMsg(e, 'Batch save failed') }
    }
  }, [])

  // Upload a receipt photo (multipart). Returns { ok, url?, error? }.
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

  return { busy, remove, saveReceipt, saveBatch, uploadPhoto }
}
