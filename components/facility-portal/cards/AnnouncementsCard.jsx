'use client'

// AnnouncementsCard — owner notices. These are the facility's official alerts
// (facility.activeAlerts, official === true), created via the portal hook's
// postAnnouncement → POST /facilities/:id/owner-updates. Each row shows the text,
// a NEW badge for recent posts, and its posted time. "Add Announcement" opens a
// composer; "Manage" links to the public facility page where alerts are managed.

import { useState } from 'react'
import Link from 'next/link'
import { Megaphone, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import PortalCard from '../PortalCard'
import { timeAgo } from '../portal-helpers'

const NEW_WINDOW_MS = 48 * 3600 * 1000

export default function AnnouncementsCard({ facility, saving, onPost, index = 0 }) {
  const notices = (facility?.activeAlerts || []).filter((a) => a.official || a.type === 'OWNER_UPDATE')
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const submit = async () => {
    const created = await onPost({ text })
    if (created) { setText(''); setOpen(false) }
  }

  const isNew = (a) => {
    const t = new Date(a.createdAt).getTime()
    return Number.isFinite(t) && Date.now() - t < NEW_WINDOW_MS
  }

  return (
    <PortalCard
      id="announcements"
      title="Announcements"
      index={index}
      action={
        <Link href={`/facilities/${facility?.id}`}>
          <Button variant="outline" size="sm">Manage</Button>
        </Link>
      }
    >
      {notices.length ? (
        <div className="space-y-3">
          {notices.map((a) => (
            <div key={a.id} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Megaphone className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {isNew(a) && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">New</span>
                  )}
                </div>
                <p className="text-sm text-neutral-700">{a.text || a.message}</p>
                <div className="mt-0.5 text-[11px] text-neutral-400">Posted {timeAgo(a.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-center text-sm text-neutral-500">
          No announcements yet.
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setText('') }}>
        <DialogTrigger asChild>
          <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            <Plus className="h-4 w-4" /> Add Announcement
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. We will be closed on Memorial Day, May 27th."
          />
          <DialogFooter>
            <Button onClick={submit} disabled={saving || !text.trim()} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Posting…' : 'Post announcement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalCard>
  )
}
