'use client'

// FeedCard — one interactive card in the Activity Hub feed.
//
//   • User posts: author row, like/comment/save/share footer, inline comments,
//     owner edit/delete menu. Interactions are optimistic (handled by
//     useActivityHubActions) and gated for logged-out users via requireAuth.
//   • Aggregate cards (jobs / bounties / alerts): a simpler read-only footer
//     with a CTA into the source page.

import { useState } from 'react'
import Link from 'next/link'
import { Heart, MessageSquare, MapPin, Eye, ThumbsUp, Bookmark, Share2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import SafeImage from '@/components/SafeImage'
import PostOwnerMenu from '@/components/community/detail/PostOwnerMenu'
import EditPostModal from '@/components/community/detail/EditPostModal'
import { FEED_TYPE_META } from '@/constants/activity_hub_constants'
import { ActionButton, AuthorAvatar, timeAgoShort } from '@/components/activity-hub/primitives'
import InlineComments from '@/components/activity-hub/InlineComments'

export default function FeedCard({ card, user, requireAuth, actions }) {
  const meta = FEED_TYPE_META[card.type] || FEED_TYPE_META.general
  const Icon = meta.icon
  const cover = card.photos?.[0] || null
  const isJob = card.type === 'job'
  const isBounty = card.type === 'bounty'
  const isUserPost = card.kind === 'post'
  const canManage = isUserPost && !!user && card.posterId === user.id
  const [busyAction, setBusyAction] = useState(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  // Wrap an action with a per-card busy guard + auth gate so double-taps and
  // logged-out users are handled once, not in every handler.
  const guarded = (name, fn) => async () => {
    if (!isUserPost) return
    if (!requireAuth('save')) return
    if (busyAction) return
    setBusyAction(name)
    try { await fn() } finally { setBusyAction(null) }
  }

  const onLike = guarded('like', () => actions.likePost(card))
  const onSave = guarded('save', () => actions.savePost(card))
  const onShare = () => actions.sharePost(card)

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border-neutral-200/80 shadow-sm transition hover:shadow-md">
        <CardContent className="p-0">
          {/* Author row (only for user posts) */}
          {isUserPost && (
            <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <AuthorAvatar author={card.author} />
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold text-neutral-900">{card.author?.name || 'User'}</div>
                  <div className="text-xs text-neutral-500">{timeAgoShort(card.createdAt)}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${meta.tone}`}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
                <PostOwnerMenu canManage={canManage} onEdit={() => setEditOpen(true)} onDelete={() => actions.deletePost(card)} size="sm" />
              </div>
            </div>
          )}

          {/* Header strip for aggregate cards */}
          {!isUserPost && (
            <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${meta.tone}`}>
                <Icon className="h-3 w-3" /> {meta.label}
              </span>
              <span className="text-xs text-neutral-400">{timeAgoShort(card.createdAt)}</span>
            </div>
          )}

          {/* Body */}
          <div className="px-4 pb-3 pt-2.5">
            {card.title && <h3 className="text-[15px] font-bold leading-snug text-neutral-900">{card.title}</h3>}
            {isJob && card.budget != null && (
              <div className="mt-1 text-xl font-bold tracking-tight text-green-700">${Number(card.budget).toLocaleString()}</div>
            )}
            {isBounty && (
              <div className="mt-2 rounded-xl border border-green-200 bg-green-50 p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-green-900">
                  <span>Goal: ${Number(card.fundingGoalUsd || 0).toLocaleString()}</span>
                  <span>Raised: ${Number(card.fundedUsd || 0).toLocaleString()}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-green-200">
                  <div className="h-full bg-green-600" style={{ width: `${Math.min(100, Math.round(((card.fundedUsd || 0) / Math.max(1, card.fundingGoalUsd || 1)) * 100))}%` }} />
                </div>
              </div>
            )}
            {card.description && <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-neutral-600">{card.description}</p>}
            {(card.location?.city || card.city) && (
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-neutral-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {[card.location?.city || card.city, card.location?.state || card.state].filter(Boolean).join(', ')}
              </div>
            )}
          </div>

          {/* Image — padding-based aspect box (pb-[56.25%] = 16:9). Using a
              padding spacer instead of `aspect-ratio` so the height is reserved
              even on mobile Safari/Android WebView, where an aspect-ratio box
              whose only child is position:absolute can collapse to zero height
              and hide the image. */}
          {cover && (
            <Link href={card.href || '#'} className="block">
              <div className="relative w-full overflow-hidden bg-neutral-100 pb-[56.25%]">
                <SafeImage src={cover} alt={card.title || ''} kind="post" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            </Link>
          )}

          {/* Footer */}
          {isUserPost ? (
            <>
              <div className="flex items-center justify-between gap-1 border-t border-neutral-100 px-2 py-1 text-xs">
                <div className="flex items-center gap-0.5">
                  <ActionButton onClick={onLike} active={!!card.myReaction} icon={Heart} label={card.likes || 0} activeTone="text-rose-600 fill-rose-600" />
                  <button
                    onClick={() => setCommentsOpen((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition hover:bg-neutral-100 ${commentsOpen ? 'text-brand-700' : 'text-neutral-600'}`}
                  >
                    <MessageSquare className="h-4 w-4" /> {card.comments || 0}
                  </button>
                  <ActionButton onClick={onSave} active={!!card.savedByMe} icon={Bookmark} label={card.saves || 0} activeTone="text-brand-600 fill-brand-600" />
                  <ActionButton onClick={onShare} active={false} icon={Share2} label="" activeTone="text-brand-600" />
                  <span className="ml-1 inline-flex items-center gap-1 px-1.5 text-[11px] text-neutral-400">
                    <Eye className="h-3.5 w-3.5" /> {card.views || 0}
                  </span>
                </div>
                {card.href && (
                  <Link href={card.href} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                    View →
                  </Link>
                )}
              </div>
              {commentsOpen && (
                <InlineComments
                  postId={card.id}
                  user={user}
                  requireAuth={requireAuth}
                  onCommented={() => actions.incrementComments(card)}
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2.5 text-xs text-neutral-500">
              <div className="flex items-center gap-3.5">
                <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> {card.likes || 0}</span>
                <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {card.comments || 0}</span>
                <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {card.views || 0}</span>
              </div>
              {card.href && (
                <Link href={card.href} className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800">
                  {isJob ? 'View Job' : isBounty ? 'Contribute' : card.type === 'donation_need' ? 'Help' : 'View'} →
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {canManage && (
        <EditPostModal open={editOpen} onOpenChange={setEditOpen} post={card} onSave={(fields) => actions.editPost(card, fields)} />
      )}
    </>
  )
}
