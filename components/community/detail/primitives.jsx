'use client'

// Small presentational primitives shared across the community post detail view.

import React from 'react'

export function initials(name) {
  const n = (name || '?').trim()
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (n[0] || '?').toUpperCase()
}

const AVATAR_SIZES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
}

export function Avatar({ name, size = 'md' }) {
  return (
    <span className={`flex ${AVATAR_SIZES[size] || AVATAR_SIZES.md} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white`}>
      {initials(name)}
    </span>
  )
}
