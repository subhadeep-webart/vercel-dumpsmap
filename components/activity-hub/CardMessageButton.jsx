'use client'

// CardMessageButton — the "message this author" action on an Activity Hub feed
// card. Sits in the card's action row alongside like / comment / save / share.
//
// Behaviour splits by breakpoint (client decision, Aug 2026):
//   • desktop → opens the DM thread in a dialog over the feed, so the reader
//     keeps their scroll position.
//   • mobile  → navigates to /inbox?dm=<authorId>, where the full-width thread
//     view is usable. A dialog at that width is cramped.
//
// Rendering is gated by the caller (FeedCard): user posts only, never on your
// own post. This component owns the auth gate and the thread-open round trip.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import DmThreadPanel from '@/components/messaging/DmThreadPanel'
import { useIsMobile } from '@/hooks/use-mobile'
import { api } from '@/lib/api-client'
import { DM_ICON } from '@/constants/activity_hub_constants'

export default function CardMessageButton({ author, user, requireAuth }) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [thread, setThread] = useState(null)
  const [loading, setLoading] = useState(false)

  const authorId = author?.id
  const authorName = author?.name || 'this user'

  const onClick = async () => {
    if (!authorId) return
    // Same gate the like/save actions use — opens SoftLoginModal when signed out.
    if (!requireAuth('message')) return
    if (loading) return

    if (isMobile) {
      router.push(`/inbox?dm=${encodeURIComponent(authorId)}`)
      return
    }

    setLoading(true)
    try {
      // POST /dm/threads writes nothing — it resolves the deterministic thread
      // id and validates the target. See docs/MESSAGING.md §3.
      const j = await api.post('/api/dm/threads', { userId: authorId })
      setThread(j.thread)
      setOpen(true)
    } catch (err) {
      toast.error(err.data?.error || 'Could not open the conversation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={onClick}
        disabled={loading}
        title={`Message ${authorName}`}
        aria-label={`Message ${authorName}`}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50"
      >
        <DM_ICON className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className="border-b border-neutral-200 px-4 py-3">
            <DialogTitle className="text-base">Chat with {thread?.otherUserName || authorName}</DialogTitle>
          </DialogHeader>
          <div className="px-2 pb-2">
            {thread && (
              <DmThreadPanel
                threadId={thread.threadId}
                loggedIn
                currentUser={user}
                otherUser={thread}
                autoFocus
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
