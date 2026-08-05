'use client'

// useActivityHubActions — all writes for the Activity Hub feed: create a post,
// like/react, save/bookmark, share, edit and delete. Extracted so the card and
// page components own layout, not network plumbing. All calls go through the
// central api client (lib/api-client).
//
// Optimistic updates edit the SWR pages in place through the `mutate` handed in
// from useActivityHub, then reconcile with the server response and roll back on
// failure. Card-level helpers take the card id and the fields to change; the
// cache stays the single source of truth so every render reflects the latest.

import { useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

export function useActivityHubActions({ mutate }) {
  // Map every card across all pages, applying `fn` to the matching id. Returns
  // a new pages array so SWR sees a fresh reference.
  const patchPages = useCallback((pages, id, fn) =>
    (pages || []).map((page) => ({
      ...page,
      feed: (page?.feed || []).map((c) => (c.id === id ? fn(c) : c)),
    })),
  [])

  // Merge `updates` into one card without revalidating (optimistic).
  const patchCard = useCallback((id, updates) => {
    mutate((pages) => patchPages(pages, id, (c) => ({ ...c, ...updates })), { revalidate: false })
  }, [mutate, patchPages])

  // Drop a card from every page.
  const removeCard = useCallback((id) => {
    mutate((pages) => (pages || []).map((page) => ({
      ...page,
      feed: (page?.feed || []).filter((c) => c.id !== id),
    })), { revalidate: false })
  }, [mutate])

  // Prepend a freshly-created post to the first page.
  const createPost = useCallback(async ({ type, title, body, photos }) => {
    const j = await api.post('/activity-hub/posts', { type, title, body, photos })
    const post = j.post
    const card = {
      id: post.id, kind: 'post', sourceId: post.id, type: post.type,
      title: post.title, description: post.body, photos: post.photos || [],
      location: post.location || {}, posterId: post.userId,
      likes: 0, comments: 0, views: 0, createdAt: post.createdAt,
      href: `/community/posts/${post.id}`,
    }
    mutate((pages) => {
      if (!pages || pages.length === 0) return [{ feed: [card] }]
      const [first, ...rest] = pages
      return [{ ...first, feed: [card, ...(first?.feed || [])] }, ...rest]
    }, { revalidate: false })
    return post
  }, [mutate])

  // Like/unlike — optimistic toggle, reconciled with the server's myReaction.
  const likePost = useCallback(async (card) => {
    const wasLiked = !!card.myReaction
    patchCard(card.id, {
      myReaction: wasLiked ? null : 'like',
      likes: Math.max(0, (card.likes || 0) + (wasLiked ? -1 : 1)),
    })
    try {
      const j = await api.post(`/community/posts/${card.id}/react`, { type: 'like' })
      patchCard(card.id, { myReaction: j.myReaction || null })
    } catch {
      patchCard(card.id, { myReaction: wasLiked ? 'like' : null, likes: card.likes })
      toast.error('Could not save like')
    }
  }, [patchCard])

  // Save/unsave — optimistic toggle.
  const savePost = useCallback(async (card) => {
    const wasSaved = !!card.savedByMe
    patchCard(card.id, {
      savedByMe: !wasSaved,
      saves: Math.max(0, (card.saves || 0) + (wasSaved ? -1 : 1)),
    })
    try {
      const j = await api.post(`/community/posts/${card.id}/save`)
      toast.success(j?.saved ? 'Saved' : 'Removed from saved')
    } catch {
      patchCard(card.id, { savedByMe: wasSaved, saves: card.saves })
      toast.error('Could not save')
    }
  }, [patchCard])

  // Share — native share API with a clipboard fallback.
  const sharePost = useCallback(async (card) => {
    const url = typeof window !== 'undefined'
      ? new URL(card.href || `/community/posts/${card.id}`, window.location.origin).toString()
      : (card.href || '')
    const shareData = {
      title: card.title || 'DumpMaps',
      text: (card.description || card.title || '').slice(0, 200),
      url,
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      } else {
        toast.success(url)
      }
    } catch (e) {
      if (e?.name !== 'AbortError') toast.error('Share failed')
    }
  }, [])

  // Edit — optimistic patch, roll back on failure.
  const editPost = useCallback(async (card, fields) => {
    const prev = { title: card.title, description: card.description, body: card.body }
    patchCard(card.id, fields)
    try {
      await api.patch(`/community/posts/${card.id}`, fields)
      toast.success('Post updated')
      return true
    } catch (e) {
      patchCard(card.id, prev)
      toast.error(e?.message || 'Could not update post')
      return false
    }
  }, [patchCard])

  const deletePost = useCallback(async (card) => {
    try {
      await api.del(`/community/posts/${card.id}`)
      toast.success('Post deleted')
      removeCard(card.id)
      return true
    } catch (e) {
      toast.error(e?.message || 'Could not delete post')
      return false
    }
  }, [removeCard])

  // Bump a card's comment count after an inline comment is posted.
  const incrementComments = useCallback((card) => {
    patchCard(card.id, { comments: (card.comments || 0) + 1 })
  }, [patchCard])

  return {
    createPost, likePost, savePost, sharePost, editPost, deletePost, incrementComments,
  }
}
