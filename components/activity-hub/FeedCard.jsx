'use client'

// FeedCard — one interactive card in the Activity Hub feed.
//
//   • User posts: author row, photo grid, like/comment/share footer, inline
//     comments, owner edit/delete menu. Interactions are optimistic (handled by
//     useActivityHubActions) and gated for logged-out users via requireAuth.
//   • Aggregate cards (jobs / bounties / alerts): a simpler read-only footer
//     with a CTA into the source page.
//
// Layout (per the redesign):
//
//   ┌──────────────────────────────────────────────────────┐
//   │ (av) Author name                                 ···  │
//   │      [ Type pill ]                                    │
//   │ Body copy…                                            │
//   │ ┌────────┐ ┌────────┐ ┌────────┐                      │
//   │ │ photo  │ │ photo  │ │ photo+N│   ← omitted entirely │
//   │ └────────┘ └────────┘ └────────┘     when no photos   │
//   │ City · 15 min ago     (♡1.3k)(💬19)(🔖)(↗)(✉)          │
//   └──────────────────────────────────────────────────────┘
//
// The type pill moved under the author name (it used to sit top-right as an
// uppercase chip) and the footer split: provenance left, reactions right.

import { useState } from 'react'
import Link from 'next/link'
import { ThumbsUp, Eye, Share2, Bookmark, MapPin } from 'lucide-react'
import PostOwnerMenu from '@/components/community/detail/PostOwnerMenu'
import EditPostModal from '@/components/community/detail/EditPostModal'
import { FEED_TYPE_META, COMMENT_ICON, postHref } from '@/constants/activity_hub_constants'
import { AuthorAvatar, ReactionPill, formatCount, timeAgoLong, timeAgoShort } from '@/components/activity-hub/primitives'
import InlineComments from '@/components/activity-hub/InlineComments'
import CardMessageButton from '@/components/activity-hub/CardMessageButton'
import FeedPhotoGrid from '@/components/activity-hub/FeedPhotoGrid'

export default function FeedCard({ card, user, requireAuth, actions }) {
  const meta = FEED_TYPE_META[card.type] || FEED_TYPE_META.general
  const isJob = card.type === 'job'
  const isBounty = card.type === 'bounty'
  const isUserPost = card.kind === 'post'
  const canManage = isUserPost && !!user && card.posterId === user.id
  // Message the author: user posts only (aggregate cards have no author), never
  // your own post. Logged-out users DO see it — the click routes through
  // requireAuth('message') and opens the sign-in modal, matching like/save.
  const canMessage = isUserPost && !!card.author?.id && card.author.id !== user?.id

  const [busyAction, setBusyAction] = useState(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const place = [card.location?.city || card.city, card.location?.state || card.state]
    .filter(Boolean)
    .join(', ')

  // Where this card opens. Wraps the body (title/description) and the photos so
  // the post is reachable by clicking it — a text-only post has no photo to
  // click, and the redesign dropped the old "View →" footer link.
  const href = postHref(card)

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
      <article className="overflow-hidden rounded-[16px] border border-[#E0EBE2] bg-white p-4 transition hover:border-green-300">
        {/* Header — author + type pill for user posts, bare type pill otherwise */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {isUserPost && <AuthorAvatar author={card.author} />}
            <div className="min-w-0">
              {isUserPost && (
                <div className="truncate text-[18px] font-semibold leading-[24px] tracking-normal text-neutral-900">
                  {card.author?.name || 'User'}
                </div>
              )}
              <span className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium ${meta.tone}`}>
                {meta.label}
              </span>
            </div>
          </div>

          {isUserPost ? (
            <PostOwnerMenu
              canManage={canManage}
              onEdit={() => setEditOpen(true)}
              onDelete={() => actions.deletePost(card)}
              size="sm"
            />
          ) : (
            <span className="shrink-0 text-[13px] text-neutral-400">{timeAgoShort(card.createdAt)}</span>
          )}
        </div>

        {/* Body — the click target for opening the post. The action pills below
            sit OUTSIDE this link so liking or sharing never navigates. */}
        <CardBodyLink href={href} className="mt-3 block">
          {card.title && <h3 className="text-[15px] font-bold leading-snug text-neutral-900">{card.title}</h3>}

          {isJob && card.budget != null && (
            <div className="mt-1 text-xl font-bold tracking-tight text-green-700">
              ${Number(card.budget).toLocaleString()}
            </div>
          )}

          {isBounty && (
            <div className="mt-2 rounded-xl border border-green-200 bg-green-50 p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-green-900">
                <span>Goal: ${Number(card.fundingGoalUsd || 0).toLocaleString()}</span>
                <span>Raised: ${Number(card.fundedUsd || 0).toLocaleString()}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-green-200">
                <div
                  className="h-full bg-green-600"
                  style={{ width: `${Math.min(100, Math.round(((card.fundedUsd || 0) / Math.max(1, card.fundingGoalUsd || 1)) * 100))}%` }}
                />
              </div>
            </div>
          )}

          {card.description && (
            <p className={`text-[16px] font-normal leading-[24px] tracking-normal text-neutral-700 ${card.title ? 'mt-1.5' : ''}`}>
              {card.description}
            </p>
          )}
        </CardBodyLink>

        {/* Photos — the whole block is omitted when the post carries none, so a
            text-only card closes straight from the body into the footer. */}
        {card.photos?.length > 0 && (
          <div className="mt-3">
            <FeedPhotoGrid photos={card.photos} href={href} alt={card.title || ''} />
          </div>
        )}

        {/* Footer — provenance left, reactions right */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-neutral-500">
            {place && (
              <>
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{place}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span className="shrink-0">{timeAgoLong(card.createdAt)}</span>
          </div>

          {isUserPost ? (
            <div className="flex shrink-0 items-center gap-2">
              <ReactionPill
                onClick={onLike}
                active={!!card.myReaction}
                icon={ThumbsUp}
                label={formatCount(card.likes)}
                activeTone="bg-green-50 text-green-700 fill-green-700"
                title="Like"
              />
              <ReactionPill
                onClick={() => setCommentsOpen((v) => !v)}
                active={commentsOpen}
                icon={COMMENT_ICON}
                label={formatCount(card.comments)}
                activeTone="bg-brand-50 text-brand-700"
                title="Comments"
              />
              <ReactionPill
                onClick={onSave}
                active={!!card.savedByMe}
                icon={Bookmark}
                label={formatCount(card.saves)}
                activeTone="bg-brand-50 text-brand-700 fill-brand-700"
                title={card.savedByMe ? 'Saved' : 'Save post'}
              />
              <ReactionPill
                onClick={onShare}
                active={false}
                icon={Share2}
                label={formatCount(card.shares)}
                title="Share"
              />
              {/* Direct message the author. Hidden on your own posts (the API
                  rejects self-DMs) and when the card carries no author. */}
              {canMessage && (
                <CardMessageButton author={card.author} user={user} requireAuth={requireAuth} />
              )}
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-3.5 text-[13px] text-neutral-500">
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5" /> {formatCount(card.likes) || 0}
              </span>
              <span className="inline-flex items-center gap-1">
                <COMMENT_ICON className="h-3.5 w-3.5" /> {formatCount(card.comments) || 0}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> {formatCount(card.views) || 0}
              </span>
              {href && (
                <Link
                  href={href}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-green-800"
                >
                  {isJob ? 'View Job' : isBounty ? 'Contribute' : card.type === 'donation_need' ? 'Help' : 'View'} →
                </Link>
              )}
            </div>
          )}
        </div>

        {commentsOpen && isUserPost && (
          <InlineComments
            postId={card.id}
            user={user}
            requireAuth={requireAuth}
            onCommented={() => actions.incrementComments(card)}
          />
        )}
      </article>

      {canManage && (
        <EditPostModal
          open={editOpen}
          onOpenChange={setEditOpen}
          post={card}
          onSave={(fields) => actions.editPost(card, fields)}
        />
      )}
    </>
  )
}

// Wraps the card body in a Link when the card has a destination, and in a plain
// div when it doesn't — so a card with no resolvable href still renders instead
// of throwing on a null Link target.
function CardBodyLink({ href, className, children }) {
  if (!href) return <div className={className}>{children}</div>
  return (
    <Link href={href} className={`${className} transition hover:opacity-90`}>
      {children}
    </Link>
  )
}
