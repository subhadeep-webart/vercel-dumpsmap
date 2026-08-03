'use client'

// Community post detail — thin orchestration component.
//
// Data reads live in hooks/use-community-post; writes in
// hooks/use-community-post-actions; presentation in
// components/community/detail/*. This file only wires them together and lays out
// the page, so it stays readable and each concern is independently testable.

import React, { useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import FieldFrame from '@/components/field/FieldFrame'
import ReportButton from '@/components/ReportButton'
import { CATEGORY_BY_KEY } from '@/lib/community-categories'
import { POST_DETAIL_BACK, buildPostBreadcrumbs } from '@/constants/community_post_detail_constants'
import { useCommunityPost } from '@/hooks/use-community-post'
import { useCommunityPostActions } from '@/hooks/use-community-post-actions'
import { useShare } from '@/hooks/use-share'
import PostCard from '@/components/community/detail/PostCard'
import CommentComposer from '@/components/community/detail/CommentComposer'
import CommentList from '@/components/community/detail/CommentList'
import PostOwnerMenu from '@/components/community/detail/PostOwnerMenu'
import EditPostModal from '@/components/community/detail/EditPostModal'
import { PostLoading, PostError } from '@/components/community/detail/PostStates'

export default function CommunityPostDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const composerRef = useRef(null)
  const share = useShare()
  const [editOpen, setEditOpen] = useState(false)

  const {
    post, comments, commentTotal, commentsHasMore, loadingMore, loadMoreComments,
    user, loading, error, reload, setPost,
  } = useCommunityPost(id)
  const actions = useCommunityPostActions({ id, user, post, setPost, reload })

  const focusComment = () => composerRef.current?.focus()
  const onShare = () => share({ title: post?.title || 'DumpMaps post' })
  const handleDelete = async () => {
    const ok = await actions.deletePost()
    if (ok) router.push('/activity-hub')
    return ok
  }

  if (loading) return <PostLoading />
  if (error || !post) return <PostError message={error} />

  const cat = CATEGORY_BY_KEY?.[post.category]
  const isOwnPost = user && post.author?.id && post.author.id === user.id

  return (
    <FieldFrame
      title={cat?.label || 'Post'}
      back={POST_DETAIL_BACK}
      breadcrumbs={buildPostBreadcrumbs(cat?.label)}
      right={
        <>
          <PostOwnerMenu canManage={isOwnPost} onEdit={() => setEditOpen(true)} onDelete={handleDelete} />
          <ReportButton kind="community_post" targetId={post.id} variant="inline" label="" />
        </>
      }
      bodyClassName="bg-neutral-100"
    >
      <div className="mx-auto max-w-2xl">
        <PostCard
          post={post}
          commentCount={commentTotal}
          actions={{ ...actions, onComment: focusComment, onShare }}
        />

        {user && post.author?.id && !isOwnPost && (
          <div className="px-4 pt-3 sm:px-0">
            <Button onClick={actions.startDm} variant="outline" className="w-full border-brand-200 text-brand-700 hover:bg-brand-50">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Message {post.author.name?.split(' ')[0] || 'author'}
            </Button>
          </div>
        )}

        <section className="mt-3 bg-white pb-6 sm:rounded-xl sm:border sm:border-neutral-200 sm:shadow-sm">
          <h2 className="px-4 pb-1 pt-4 text-sm font-bold text-neutral-900">
            Comments {commentTotal > 0 && <span className="text-neutral-400">· {commentTotal}</span>}
          </h2>
          <CommentComposer user={user} posting={actions.posting} onSubmit={actions.submitComment} inputRef={composerRef} />
          <CommentList
            comments={comments}
            hasMore={commentsHasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMoreComments}
          />
        </section>
      </div>

      {isOwnPost && (
        <EditPostModal open={editOpen} onOpenChange={setEditOpen} post={post} onSave={actions.editPost} />
      )}
    </FieldFrame>
  )
}
