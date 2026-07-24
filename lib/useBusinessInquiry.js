'use client'

// useBusinessInquiry
// ---------------------------------------------------------------------------
// Encapsulates the "Partner With Us" submit flow so any form (the business
// page, a modal, a shorter landing-page variant) can reuse the same POST +
// loading/success handling without duplicating the fetch.
//
// Usage:
//   const { submit, isLoading, isSuccess } = useBusinessInquiry()
//   // inside react-hook-form's handleSubmit:
//   const onSubmit = (values) => submit(values)
//
// `submit(values)` resolves to `true` on success and `false` otherwise, so a
// caller can await it and branch (e.g. reset the form) if needed.

import { useState, useCallback } from 'react'
import { toast } from 'sonner'

export function useBusinessInquiry({ onSuccess } = {}) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const submit = useCallback(async (values) => {
    setIsLoading(true)
    try {
      const r = await fetch('/api/business-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        setIsSuccess(true)
        toast.success("Thanks! We'll be in touch within 1 business day.")
        onSuccess?.(j)
        return true
      }
      toast.error(j.error || 'Something went wrong')
      return false
    } catch {
      toast.error('Network error. Please try again.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [onSuccess])

  return { submit, isLoading, isSuccess }
}
