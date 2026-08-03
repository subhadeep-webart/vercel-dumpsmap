'use client'

// ExpandableText — renders text, collapsing anything longer than `limit` chars
// behind a "Read more" toggle (and "Show less" to re-collapse). Used for both
// the post body and comments so the truncation behavior stays consistent.
//
// Truncation snaps back to the last word boundary before the limit so we never
// cut a word in half. Preserves line breaks (whitespace-pre-wrap) and wraps long
// unbroken strings (break-words).

import React, { useState } from 'react'

export default function ExpandableText({ text, limit, className = '', moreLabel = 'Read more', lessLabel = 'Show less' }) {
  const [expanded, setExpanded] = useState(false)
  const full = text || ''
  const needsClamp = full.length > limit

  let shown = full
  if (needsClamp && !expanded) {
    const slice = full.slice(0, limit)
    const lastSpace = slice.lastIndexOf(' ')
    shown = (lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()
  }

  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {shown}
      {needsClamp && !expanded && <span className="text-neutral-400">… </span>}
      {needsClamp && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-0.5 align-baseline text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline"
        >
          {expanded ? lessLabel : moreLabel}
        </button>
      )}
    </p>
  )
}
