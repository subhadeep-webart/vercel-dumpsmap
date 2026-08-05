'use client'

// CommentComposer — inline "write a comment" row (avatar + rounded input + send).
// Owns its own draft state; hands the trimmed text to onSubmit and clears on
// success. Exposes a ref via `inputRef` so the page's Comment action can focus it.

import React, { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { COMMENT_MAX_LENGTH, COMMENT_COUNTER_THRESHOLD } from '@/constants/community_post_detail_constants'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Avatar } from './primitives'

export default function CommentComposer({ user, posting, onSubmit, inputRef }) {
  const [draft, setDraft] = useState('')

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
          <AutoResizeTextarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
            maxLength={COMMENT_MAX_LENGTH}
            minHeight={24}
            maxHeight={128}
            placeholder={user ? 'Write a comment…' : 'Sign in to comment'}
            disabled={!user}
            className="flex-1 bg-transparent py-1 text-sm leading-6 text-neutral-800 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
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
