'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import DmThreadPanel from './DmThreadPanel'
import { api } from '@/lib/api-client'

export default function StartDmButton({ targetUserId, targetUserName, currentUser, token, variant = 'default', size = 'default', label = 'Message', className = '' }) {
  const [open, setOpen] = useState(false)
  const [thread, setThread] = useState(null)
  const [loading, setLoading] = useState(false)

  const startThread = async () => {
    if (!token) { toast.error('Log in to send messages'); return }
    if (targetUserId === currentUser?.id) { toast.info("That's you."); return }
    setLoading(true)
    try {
      let j
      try {
        j = await api.post('/api/dm/threads', { userId: targetUserId })
      } catch (err) {
        toast.error(err.data?.error || 'Failed'); return
      }
      setThread(j.thread)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={startThread} variant={variant} size={size} disabled={loading} className={className}>
        <MessageCircle className="mr-1 h-4 w-4" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className="border-b border-neutral-200 px-4 py-3">
            <DialogTitle className="text-base">Chat with {targetUserName || thread?.otherUserName || 'user'}</DialogTitle>
          </DialogHeader>
          <div className="px-2 pb-2">
            {thread && (
              <DmThreadPanel threadId={thread.threadId} token={token} currentUser={currentUser} otherUser={thread} autoFocus />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
