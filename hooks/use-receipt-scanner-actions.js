'use client'

// useReceiptScannerActions — write/mutation service for the Receipt Scanner.
//
// The page inlined two /api mutations: POST /receipts/scan (multipart upload
// that runs OCR) and POST /receipts (persist the reviewed draft). That's
// reusable service logic, not view logic, so it lives here. Both route through
// the central api client (auth + CSRF handled there); the scan surfaces its
// error into the page's inline banner, while the save shows a toast — matching
// the original UX exactly.
//
// Usage:
//   const actions = useReceiptScannerActions()
//   const { ok, draft, ocr, error } = await actions.scan(file)
//   const { ok, receipt, rewards, error } = await actions.save(draft, ocrMeta)

import { useCallback } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { buildSavePayload } from '@/lib/receipt-scanner-helpers'

// Pull a human message off an ApiError (the client puts the server's `error`
// field on err.data.error and also on err.message).
function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return String(e?.message || e || fallback)
}

export function useReceiptScannerActions() {
  // Upload the photo and run OCR. Returns the extracted draft + ocr metadata on
  // success; on failure returns an error string for the page's inline banner
  // (no toast here, mirroring the original flow).
  const scan = useCallback(async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    try {
      const j = await api.post('/receipts/scan', fd)
      return { ok: true, draft: j?.draft, ocr: j?.ocr }
    } catch (e) {
      const msg = e instanceof ApiError && e.status != null
        ? (e.data?.error || `Scan failed (HTTP ${e.status})`)
        : errMsg(e, 'Scan failed')
      return { ok: false, error: msg }
    }
  }, [])

  // Persist the reviewed draft. Shows a success/error toast and returns the
  // saved receipt + rewards so the page can render the done screen.
  const save = useCallback(async (draft, ocrMeta) => {
    const payload = buildSavePayload(draft, ocrMeta)
    try {
      const j = await api.post('/receipts', payload)
      const receipt = j?.receipt || j
      const rewards = j?.rewards || null
      const earned = rewards?.totalPoints || 0
      toast.success(earned > 0 ? `Receipt saved · +${earned} pts earned` : 'Receipt saved')
      return { ok: true, receipt, rewards }
    } catch (e) {
      toast.error(errMsg(e, 'Save failed'))
      return { ok: false }
    }
  }, [])

  return { scan, save }
}
