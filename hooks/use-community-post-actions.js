'use client'

// useCommunityPostActions — all writes for the community post detail page:
// react, comment, save/bookmark, and message-the-author. Extracted so the page
// component owns layout, not network plumbing. All calls go through the central
// api client (lib/api-client).
//
// Each action manages its own in-flight flag and returns a boolean/void; the
// caller owns UI side-effects (toasts, refocus) beyond what's noted. Reacting is
// optimistic via the `setPost` updater passed in from useCommunityPost, then
// reconciled with a `reload()`.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

export function useCommunityPostActions({ id, user, post, setPost, reload }) {
  const router = useRouter()
  const [posting, setPosting] = useState(false)
  const [reacting, setReacting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedByMe, setSavedByMe] = useState(false)

  // Seed the saved state from the post the server returned (savedByMe), so a
  // post already saved on the Activity Hub shows as saved here on load. Only
  // syncs while no save toggle is in flight, so an optimistic update isn't
  // clobbered by a stale post snapshot mid-request.
  useEffect(() => {
    if (!saving && typeof post?.savedByMe === 'boolean') setSavedByMe(post.savedByMe)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.savedByMe])

  const submitComment = useCallback(async (body) => {
    const text = (body || '').trim()
    if (!text) return false
    if (!user) { toast.error('Sign in to comment'); return false }
    setPosting(true)
    try {
      await api.post(`/community/posts/${id}/comments`, { body: text })
      await reload()
      return true
    } catch (e) {
      toast.error(e?.message || 'Could not comment')
      return false
    } finally { setPosting(false) }
  }, [id, user, reload])

  const react = useCallback(async (type) => {
    if (!user) { toast.error('Sign in to react'); return }
    if (reacting) return
    setReacting(true)
    const prev = post
    const already = post?.myReaction === type
    setPost((p) => (p ? { ...p, myReaction: already ? null : type } : p))
    try {
      await api.post(`/community/posts/${id}/react`, { type })
      await reload()
    } catch { setPost(prev) } finally { setReacting(false) }
  }, [id, user, post, reacting, setPost, reload])

  const toggleSave = useCallback(async () => {
    if (!user) { toast.error('Sign in to save'); return }
    if (saving) return
    setSaving(true)
    const wasSaved = savedByMe
    setSavedByMe(!wasSaved)
    try {
      const j = await api.post(`/community/posts/${id}/save`)
      toast.success(j?.saved ? 'Saved' : 'Removed from saved')
    } catch (e) {
      setSavedByMe(wasSaved)
      toast.error(e?.message || 'Could not save')
    } finally { setSaving(false) }
  }, [id, user, saving, savedByMe])

  const startDm = useCallback(() => {
    if (!user) { toast.error('Sign in to message'); return }
    if (!post?.author?.id) return
    router.push(`/inbox?dm=${post.author.id}`)
  }, [user, post, router])

  // Edit — apply the change to local state immediately (optimistic) so the UI
  // reflects it without a refetch, then persist via PATCH so a later refresh
  // shows the same content. On failure we roll the local post back.
  const editPost = useCallback(async (fields) => {
    const prev = post
    setPost((p) => (p ? { ...p, ...fields } : p))
    try {
      await api.patch(`/community/posts/${id}`, fields)
      toast.success('Post updated')
      return true
    } catch (e) {
      setPost(prev)
      toast.error(e?.message || 'Could not update post')
      return false
    }
  }, [id, post, setPost])

  // Delete (soft). Returns true on success; the caller owns navigation.
  const deletePost = useCallback(async () => {
    try {
      await api.del(`/community/posts/${id}`)
      toast.success('Post deleted')
      return true
    } catch (e) {
      toast.error(e?.message || 'Could not delete post')
      return false
    }
  }, [id])

  return { posting, reacting, saving, savedByMe, submitComment, react, toggleSave, startDm, editPost, deletePost }
}
