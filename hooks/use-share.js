'use client'

// useShare — share-the-current-thing behavior, extracted so components don't
// carry the Web Share API + clipboard-fallback logic inline.
//
// Uses the native share sheet when available (mobile / supporting browsers) and
// otherwise copies the URL to the clipboard with a toast. Silently ignores a
// user-cancelled native share.
//
// Usage:
//   const share = useShare()
//   <button onClick={() => share({ title, text, url })}>Share</button>
//
// url defaults to the current page, so most callers pass just { title, text }.

import { useCallback } from 'react'
import { toast } from 'sonner'

export function useShare() {
  return useCallback(async ({ title, text, url } = {}) => {
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
    const shareData = { title, text, url: shareUrl }
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Link copied to clipboard')
      }
      return true
    } catch {
      // User cancelled the native share sheet, or clipboard was blocked.
      return false
    }
  }, [])
}
