'use client'

import { useState } from 'react'
import CategoryPlaceholder from '@/components/marketplace/CategoryPlaceholder'
import { normalizePhoto } from '@/constants/marketplace_constants'

// Tiny image-with-fallback used by list mode + anywhere we render a single
// listing photo as a thumbnail. Falls back to <CategoryPlaceholder /> on load
// error so we never show a broken image icon.
export default function ListingThumb({ photo, category, showLabel = false, className = '' }) {
  const [failed, setFailed] = useState(false)
  const src = normalizePhoto(photo)
  if (!src || failed) {
    return <CategoryPlaceholder category={category} size="sm" showLabel={showLabel} />
  }
  return <img src={src} alt="" className={`h-full w-full object-cover ${className}`} onError={() => setFailed(true)} />
}
