'use client'

// HoursCard — Hours of Operation. The facility.hours field is free-form in the
// data model (a string like "Mon-Fri 6-5, Sat 7-2" or an object keyed by day), so
// this renders whichever shape exists: an object → labelled rows; a string →
// the parsed open/closed line + the raw text. Editing is a single textarea that
// saves back to facility.hours via the owner-update PATCH — keeping the free-form
// contract the rest of the app already reads.

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { getOpenStatusLine } from '@/lib/facility-hours'
import PortalCard from '../PortalCard'

function HoursBody({ hours }) {
  // Object shape → rows.
  if (hours && typeof hours === 'object' && !Array.isArray(hours)) {
    const entries = Object.entries(hours)
    if (!entries.length) return <Empty />
    return (
      <div className="space-y-1.5 text-sm">
        {entries.map(([day, val]) => {
          const closed = !val || /closed/i.test(String(val))
          return (
            <div key={day} className="flex items-center justify-between">
              <span className="capitalize text-neutral-600">{day}</span>
              <span className={`font-medium ${closed ? 'text-red-600' : 'text-neutral-900'}`}>
                {closed ? 'Closed' : String(val)}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  // String shape → status line + raw.
  if (typeof hours === 'string' && hours.trim()) {
    const status = getOpenStatusLine(hours)
    return (
      <div className="space-y-2 text-sm">
        <div className={`font-semibold ${status.tone === 'neutral' ? 'text-neutral-700' : status.tone === 'open' ? 'text-green-700' : 'text-red-600'}`}>
          {status.label}
        </div>
        <div className="whitespace-pre-line text-neutral-600">{hours}</div>
      </div>
    )
  }

  return <Empty />
}

function Empty() {
  return <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-center text-sm text-neutral-500">No hours set yet.</div>
}

// `canEdit` mirrors the server's owner-only check on the owner-update PATCH.
export default function HoursCard({ facility, saving, onSave, index = 0, canEdit = true }) {
  const hours = facility?.hours
  const initial =
    hours && typeof hours === 'object' && !Array.isArray(hours)
      ? Object.entries(hours).map(([d, v]) => `${d}: ${v}`).join('\n')
      : (typeof hours === 'string' ? hours : '')

  const [open, setOpen] = useState(false)
  const [text, setText] = useState(initial)

  const submit = async () => {
    const ok = await onSave({ hours: text })
    if (ok) setOpen(false)
  }

  return (
    <PortalCard
      id="hours"
      title="Hours of Operation"
      index={index}
      action={
        !canEdit ? null : (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setText(initial) }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit Hours</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Hours of operation</DialogTitle></DialogHeader>
            <Textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Mon - Fri: 6:00 AM - 5:00 PM\nSat: 7:00 AM - 2:00 PM\nSun: Closed'}
            />
            <DialogFooter>
              <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Saving…' : 'Save hours'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )
      }
    >
      <HoursBody hours={hours} />
    </PortalCard>
  )
}
