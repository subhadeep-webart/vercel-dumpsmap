'use client'

// CommentList — the list of comments below a post. Each row is a chat-style
// bubble with the author's avatar, name, body, timestamp and a Report action.

import React from 'react'
import { BadgeCheck, Loader2, ChevronUp } from 'lucide-react'
import { timeAgo } from '@/lib/community-categories'
import { COMMENT_TRUNCATE } from '@/constants/community_post_detail_constants'
import ReportButton from '@/components/ReportButton'
import { Avatar } from './primitives'
import ExpandableText from './ExpandableText'

function CommentItem({ comment }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3">
      <Avatar name={comment.author?.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="inline-block max-w-full rounded-2xl bg-neutral-100 px-3 py-2">
          <div className="flex items-center gap-1 text-[13px] font-bold text-neutral-900">
            <span className="truncate">{comment.author?.name || 'Someone'}</span>
            {comment.author?.verificationLevel?.startsWith('verified') && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
          </div>
          <ExpandableText text={comment.body} limit={COMMENT_TRUNCATE} className="text-sm text-neutral-800" />
        </div>
        <div className="mt-1 flex items-center gap-3 pl-3 text-[11px] font-medium text-neutral-400">
          <span>{timeAgo(comment.createdAt)}</span>
          <ReportButton kind="community_comment" targetId={comment.id} variant="inline" label="Report" />
        </div>
      </div>
    </div>
  )
}

export default function CommentList({ comments, hasMore, loadingMore, onLoadMore }) {
  if (!comments.length) {
    return <div className="px-4 py-8 text-center text-sm text-neutral-400">No comments yet — start the conversation.</div>
  }
  return (
    <div>
      {/* Older comments load above (newest are shown first). */}
      {hasMore && (
        <div className="flex justify-center px-4 py-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
          >
            {loadingMore
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</>
              : <><ChevronUp className="h-3.5 w-3.5" /> Load more comments</>}
          </button>
        </div>
      )}
      <div className="divide-y divide-neutral-50">
        {comments.map((c) => <CommentItem key={c.id} comment={c} />)}
      </div>
    </div>
  )
}
