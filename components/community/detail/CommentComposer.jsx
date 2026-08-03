'use client'

// CommentComposer — inline "write a comment" row (avatar + rounded input + send).
// Owns its own draft state; hands the trimmed text to onSubmit and clears on
// success. Exposes a ref via `inputRef` so the page's Comment action can focus it.

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { COMMENT_MAX_LENGTH, COMMENT_COUNTER_THRESHOLD } from '@/constants/community_post_detail_constants'
import { Avatar } from './primitives'

export default function CommentComposer({ user, posting, onSubmit, inputRef }) {
  const [draft, setDraft] = useState('')
  const localRef = useRef(null)

  // Grow the textarea to fit its content (capped by the CSS max-height, past
  // which it scrolls). Reset to auto first so it can also shrink when text is
  // deleted or the field is cleared after submit.
  const autosize = useCallback(() => {
    const el = localRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  // Merge our resize ref with the forwarded inputRef (used by the page to focus
  // the field from the "Comment" action).
  const setRef = useCallback((node) => {
    localRef.current = node
    if (typeof inputRef === 'function') inputRef(node)
    else if (inputRef) inputRef.current = node
  }, [inputRef])

  // Re-fit whenever the value changes (typing, and clearing after a successful
  // submit). useLayoutEffect avoids a one-frame flicker at the new height.
  useLayoutEffect(() => { autosize() }, [draft, autosize])

  const submit = async () => {
    if (!draft.trim()) return
    const ok = await onSubmit(draft)
    if (ok) setDraft('')
  }

  const remaining = COMMENT_MAX_LENGTH - draft.length
  const showCounter = remaining <= COMMENT_COUNTER_THRESHOLD

  return (
    <div className="flex items-start gap-2.5 px-4 py-3">
      <Avatar name={user?.name || user?.email || ''} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 transition-colors focus-within:border-brand-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
          <textarea
            ref={setRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
            rows={1}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder={user ? 'Write a comment…' : 'Sign in to comment'}
            disabled={!user}
            className="max-h-32 min-h-[24px] flex-1 resize-none overflow-y-auto bg-transparent py-1 text-sm leading-6 text-neutral-800 outline-none [scrollbar-width:none] placeholder:text-neutral-400 disabled:cursor-not-allowed [&::-webkit-scrollbar]:hidden"
          />
          <button
            onClick={submit}
            disabled={!user || posting || !draft.trim()}
            aria-label="Post comment"
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {showCounter && (
          <div className={`mt-1 pr-1 text-right text-[11px] font-medium ${remaining <= 0 ? 'text-red-500' : 'text-neutral-400'}`}>
            {remaining} left
          </div>
        )}
      </div>
    </div>
  )
}
