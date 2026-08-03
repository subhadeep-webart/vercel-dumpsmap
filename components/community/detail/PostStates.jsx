'use client'

// Loading / error shells for the community post detail page, wrapped in the same
// FieldFrame so the header + back button stay consistent with the ready state.

import React from 'react'
import FieldFrame from '@/components/field/FieldFrame'
import { POST_DETAIL_BACK } from '@/constants/community_post_detail_constants'

export function PostLoading() {
  return (
    <FieldFrame title="Post" back={POST_DETAIL_BACK}>
      <div className="py-10 text-center text-sm text-neutral-400">Loading…</div>
    </FieldFrame>
  )
}

export function PostError({ message }) {
  return (
    <FieldFrame title="Post" back={POST_DETAIL_BACK}>
      <div className="px-4 py-10 text-center text-sm text-neutral-500">{message || 'Post not found.'}</div>
    </FieldFrame>
  )
}
