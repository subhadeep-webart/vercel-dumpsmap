'use client'

// useCommunityPost — all data reads for the community post detail page.
//
// The page component used to inline the auth/me fetch, the post+comments load,
// and the loading/error state machine. This hook owns that so the page just
// renders. All requests go through the central api client (lib/api-client), so
// the auth token, headers, JSON parsing and timeout live in one place.
//
// Comments are paginated newest-first: the detail load returns the most recent
// page (in oldest→newest display order) plus a total + hasMore flag, and
// `loadMoreComments()` fetches the next older page and prepends it. The page gets
// back the post, comments, current user, a loading/error state, `reload()` for
// after writes, and `setPost` for optimistic reaction updates.

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, isLikelyLoggedIn, ApiError } from '@/lib/api-client'
import { COMMENTS_PAGE_SIZE } from '@/constants/community_post_detail_constants'

const INITIAL = {
  phase: 'loading', post: null, comments: [], error: '',
  commentTotal: 0, commentsHasMore: false,
}

export function useCommunityPost(id) {
  const [data, setData] = useState(INITIAL)
  const [user, setUser] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const activeId = useRef(id)

  const loadPost = useCallback(async (postId, signal) => {
    try {
      const j = await api.get(`/community/posts/${postId}?commentLimit=${COMMENTS_PAGE_SIZE}`, { signal })
      if (activeId.current !== postId) return
      setData({
        phase: 'ready',
        post: j.post,
        comments: j.comments || [],
        error: '',
        commentTotal: j.commentTotal ?? (j.comments?.length || 0),
        commentsHasMore: !!j.commentsHasMore,
      })
    } catch (e) {
      if (activeId.current !== postId || e?.code === 'aborted') return
      const error = e instanceof ApiError ? (e.data?.error || e.message) : 'Not found'
      setData({ ...INITIAL, phase: 'error', error })
    }
  }, [])

  const reload = useCallback(() => loadPost(id), [id, loadPost])

  // Fetch the next older page and prepend it above what's already shown.
  const loadMoreComments = useCallback(async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const oldest = data.comments[0]
      const before = oldest ? new Date(oldest.createdAt).toISOString() : null
      const qs = new URLSearchParams({ limit: String(COMMENTS_PAGE_SIZE) })
      if (before) qs.set('before', before)
      const j = await api.get(`/community/posts/${id}/comments?${qs.toString()}`)
      if (activeId.current !== id) return
      setData((d) => ({
        ...d,
        comments: [...(j.comments || []), ...d.comments],
        commentsHasMore: !!j.hasMore,
      }))
    } catch {
      // Non-fatal: leave the current list intact; the button stays available.
    } finally {
      setLoadingMore(false)
    }
  }, [id, data.comments, loadingMore])

  useEffect(() => {
    if (!id) return
    activeId.current = id
    const ctrl = new AbortController()
    const { signal } = ctrl
    const alive = () => activeId.current === id && !signal.aborted

    loadPost(id, signal)

    if (isLikelyLoggedIn()) {
      api.get('/auth/me', { signal })
        .then((j) => { if (alive()) setUser(j?.user || null) })
        .catch(() => {})
    }

    return () => { ctrl.abort() }
  }, [id, loadPost])

  return {
    post: data.post,
    comments: data.comments,
    commentTotal: data.commentTotal,
    commentsHasMore: data.commentsHasMore,
    loadingMore,
    loadMoreComments,
    user,
    loading: data.phase === 'loading',
    error: data.phase === 'error' ? (data.error || 'Post not found.') : null,
    reload,
    setPost: (updater) => setData((d) => ({ ...d, post: typeof updater === 'function' ? updater(d.post) : updater })),
  }
}
