'use client'

// useReceiptScanner — all state + logic for the AI Receipt Scanner page.
//
// The page component used to inline the auth bootstrap (a bespoke /auth/me
// fetch with an 8s safety timeout), the feature-gate read, the snap→scan→
// review→save→done state machine, an object-URL cleanup effect, and the two
// mutations. This hook owns everything except rendering: the page just reads
// this state and maps it to markup.
//
// Reads go through the shared hooks (useCurrentUser for the signed-in user,
// useFeatureAccess for the beta gate); mutations go through
// useReceiptScannerActions. No raw fetch lives here.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useFeatureAccess } from '@/lib/useFeatureAccess'
import { isLikelyLoggedIn } from '@/lib/api-client'
import { recomputeWeights } from '@/lib/receipt-scanner-helpers'
import { FEATURE_KEY, LOGIN_REDIRECT } from '@/constants/receipt_scanner_constants'
import { useReceiptScannerActions } from '@/hooks/use-receipt-scanner-actions'

export function useReceiptScanner() {
  const router = useRouter()
  const fileRef = useRef(null)
  const cameraRef = useRef(null)

  const { user, isLoading, isLoggedOut } = useCurrentUser()
  const access = useFeatureAccess(FEATURE_KEY)
  const actions = useReceiptScannerActions()

  const [stage, setStage] = useState('pick') // pick | scanning | review | saving | done
  const [previewUrl, setPreviewUrl] = useState(null)
  const [scanError, setScanError] = useState('')
  const [draft, setDraft] = useState(null)
  const [ocrMeta, setOcrMeta] = useState(null)
  const [savedReceipt, setSavedReceipt] = useState(null)
  const [savedRewards, setSavedRewards] = useState(null)

  // Redirect anyone who isn't (or is no longer) signed in to the login flow.
  useEffect(() => {
    if (!isLikelyLoggedIn() || isLoggedOut) {
      router.replace(LOGIN_REDIRECT)
    }
  }, [isLoggedOut, router])

  // While useCurrentUser resolves, show the checking-access skeleton; once it
  // settles we're ready (matching the original loading | ready gate).
  const authStatus = isLoading ? 'loading' : 'ready'

  // Clean object URL when it changes / on unmount.
  useEffect(() => {
    return () => { if (previewUrl) try { URL.revokeObjectURL(previewUrl) } catch {} }
  }, [previewUrl])

  // File select → scan.
  const onFile = useCallback(async (file) => {
    if (!file) return
    setScanError('')
    setDraft(null); setOcrMeta(null); setSavedReceipt(null)
    const obj = URL.createObjectURL(file)
    setPreviewUrl(obj)
    setStage('scanning')
    const res = await actions.scan(file)
    if (!res.ok) {
      setScanError(res.error)
      setStage('pick')
      return
    }
    setDraft(res.draft)
    setOcrMeta(res.ocr)
    // Prefer the server-stored URL for the receipt photo (persists across redeploys)
    if (res.ocr?.photoUrl) setPreviewUrl(res.ocr.photoUrl)
    setStage('review')
  }, [actions])

  const onDraftChange = useCallback((k, v) => setDraft((d) => ({ ...d, [k]: v })), [])

  // Auto-recompute netLb / netTons when gross/tare change.
  const onWeightChange = useCallback((k, v) => {
    setDraft((d) => recomputeWeights(d, k, v))
  }, [])

  const onSave = useCallback(async () => {
    if (!draft) return
    setStage('saving')
    const res = await actions.save(draft, ocrMeta)
    if (!res.ok) {
      setStage('review')
      return
    }
    setSavedReceipt(res.receipt)
    setSavedRewards(res.rewards)
    setStage('done')
  }, [draft, ocrMeta, actions])

  const resetAll = useCallback(() => {
    setStage('pick'); setDraft(null); setOcrMeta(null); setSavedReceipt(null); setSavedRewards(null)
    setScanError(''); setPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }, [])

  return {
    // refs
    fileRef, cameraRef,
    // auth + gate
    user, authStatus, access,
    // state machine
    stage, previewUrl, scanError, draft, ocrMeta, savedReceipt, savedRewards,
    // handlers
    onFile, onDraftChange, onWeightChange, onSave, resetAll,
  }
}
