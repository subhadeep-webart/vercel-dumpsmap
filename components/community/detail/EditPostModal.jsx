'use client'

// EditPostModal — lets a post's author edit its title and body. Submits via the
// `onSave(fields)` callback (which PATCHes and refreshes); closes on success.
// Title/body only by design — urgency, location and photos are out of scope for
// this pass.

import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const TITLE_MAX = 160
const BODY_MAX = 5000

export default function EditPostModal({ open, onOpenChange, post, onSave }) {
  const [title, setTitle] = useState(post?.title || '')
  const [body, setBody] = useState(post?.body || '')
  const [saving, setSaving] = useState(false)

  // Re-seed the fields each time the modal opens, so reopening after an edit
  // shows the current content rather than the values from first mount.
  useEffect(() => {
    if (open) {
      setTitle(post?.title || '')
      setBody(post?.body || '')
    }
  }, [open, post?.title, post?.body])

  const dirty = title !== (post?.title || '') || body !== (post?.body || '')
  const canSave = body.trim().length > 0 && dirty && !saving

  const submit = async () => {
    if (!canSave) return
    setSaving(true)
    const ok = await onSave({ title: title.trim(), body: body.trim() })
    setSaving(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-neutral-200 px-5 py-4">
          <DialogTitle>Edit post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-post-title" className="text-xs font-semibold text-neutral-600">Title <span className="font-normal text-neutral-400">(optional)</span></Label>
            <Input
              id="edit-post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              placeholder="Add a short title…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-post-body" className="text-xs font-semibold text-neutral-600">Details</Label>
            <Textarea
              id="edit-post-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={BODY_MAX}
              rows={6}
              placeholder="What's happening?"
              className="resize-y"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={!canSave} className="bg-brand-600 hover:bg-brand-700">
            {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</> : 'Save changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
