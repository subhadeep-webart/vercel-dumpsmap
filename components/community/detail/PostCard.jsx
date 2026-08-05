'use client'

// PostCard — the main post: author header, title/body, location, photos, the
// engagement stats bar, and the ReactionBar action row. Presentational; all
// actions are delegated to callbacks passed by the page.

import React from 'react'
import { MapPin, BadgeCheck, AlertTriangle, Eye } from 'lucide-react'
import { CATEGORY_BY_KEY, REACTION_TYPES, categoryColor, timeAgo } from '@/lib/community-categories'
import { getReactionIcon } from '@/lib/community-icons'
import { POST_BODY_TRUNCATE } from '@/constants/community_post_detail_constants'
import { Avatar } from './primitives'
import ReactionBar from './ReactionBar'
import ExpandableText from './ExpandableText'

export default function PostCard({ post, commentCount, actions }) {
  const cat = CATEGORY_BY_KEY?.[post.category]
  const cc = categoryColor(post.category)
  const reactions = post.reactions || {}
  const reactionTotal = post.reactionCount || Object.values(reactions).reduce((a, b) => a + (b || 0), 0)
  const presentReactions = REACTION_TYPES.filter((r) => (reactions[r.key] || 0) > 0).slice(0, 3)
  const hasStats = reactionTotal > 0 || commentCount > 0 || post.viewCount > 0

  return (
    <article className="bg-white sm:mt-3 sm:rounded-xl sm:border sm:border-neutral-200 sm:shadow-sm">
      {/* Author */}
      <header className="flex items-start gap-3 px-4 pt-4">
        <Avatar name={post.author?.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm font-bold text-neutral-900">
            <span className="truncate">{post.author?.name || 'Someone'}</span>
            {post.author?.verificationLevel?.startsWith('verified') && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-neutral-500">
            {cat && <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${cc.chip}`}>{cat.label}</span>}
            {post.urgency === 'high' && <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800"><AlertTriangle className="h-2.5 w-2.5" />Urgent</span>}
            <span>·</span>
            <span>{timeAgo(post.createdAt)}</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="px-4 pt-3">
        {post.title && <h1 className="mb-1 text-lg font-extrabold leading-snug text-neutral-900">{post.title}</h1>}
        {post.body && <ExpandableText text={post.body} limit={POST_BODY_TRUNCATE} className="text-[15px] leading-relaxed text-neutral-800" />}
        {(post.location || post.city) && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
            <MapPin className="h-3 w-3" />
            <span>{post.location || [post.city, post.state].filter(Boolean).join(', ')}</span>
          </div>
        )}
      </div>

      {/* Photos */}
      {post.photos?.length > 0 && (
        <div className={`mt-3 grid gap-0.5 ${post.photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {post.photos.map((p, i) => (
            <div key={i} className={`relative overflow-hidden bg-neutral-100 ${post.photos.length === 1 ? 'pb-[62.5%]' : 'pb-[100%]'}`}>
              <img src={p} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      )}

      {/* Stats bar */}
      {hasStats && (
        <div className="flex items-center justify-between px-4 py-2.5 text-[12px] text-neutral-500">
          <div className="flex items-center gap-1.5">
            {presentReactions.length > 0 && (
              <span className="flex -space-x-1">
                {presentReactions.map((r) => {
                  const Icon = getReactionIcon(r.key)
                  return (
                    <span key={r.key} className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-brand-100 text-brand-700">
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                  )
                })}
              </span>
            )}
            {reactionTotal > 0 && <span>{reactionTotal}</span>}
          </div>
          <div className="flex items-center gap-3">
            {commentCount > 0 && <span>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>}
            {post.viewCount > 0 && <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{post.viewCount}</span>}
          </div>
        </div>
      )}

      <ReactionBar
        myReaction={post.myReaction}
        reacting={actions.reacting}
        savedByMe={actions.savedByMe}
        saving={actions.saving}
        onReact={actions.react}
        onComment={actions.onComment}
        onToggleSave={actions.toggleSave}
        onShare={actions.onShare}
      />
    </article>
  )
}
