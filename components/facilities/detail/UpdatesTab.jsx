'use client'

// Updates tab — owner/staff official-update composer plus the list of active
// alerts (or an empty state). Extracted from app/facilities/[id]/page.js.
//
// The composer draft (text + posting flag) is owned locally so typing no longer
// re-renders the whole facility page — the parent only receives the final text
// via onPost(text), which resolves truthy on success so the field can clear.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Megaphone, Loader2, Activity } from 'lucide-react'

export default function UpdatesTab({ facility, isOwner, isStaffUser, onPost }) {
  const alerts = facility.activeAlerts || []
  const [updateText, setUpdateText] = useState('')
  const [posting, setPosting] = useState(false)

  const submit = async () => {
    setPosting(true)
    try {
      const ok = await onPost(updateText)
      if (ok) setUpdateText('')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-4">
      {(isOwner || isStaffUser) && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
              <Megaphone className="h-4 w-4" /> Post an official facility update
            </div>
            <Textarea rows={2} value={updateText} onChange={(e) => setUpdateText(e.target.value)} placeholder="e.g. Closed early today — gate locked at 2 PM" />
            <Button size="sm" disabled={posting} onClick={submit} className="bg-blue-600 hover:bg-blue-700">
              {posting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Megaphone className="mr-1.5 h-3.5 w-3.5" />}
              Post update
            </Button>
          </CardContent>
        </Card>
      )}

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <Megaphone className="h-6 w-6 text-neutral-400" />
            </div>
            <h3 className="text-base font-bold text-neutral-800">No live updates</h3>
            <p className="text-sm text-neutral-600">
              No active updates posted for this facility right now. Check back later or post one if you're the owner.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <Card key={a.id} className={`${a.pinned ? 'border-amber-300 bg-amber-50/50' : ''}`}>
              <CardContent className="p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Activity className="h-3.5 w-3.5 text-green-600" />
                  <span className="font-semibold text-neutral-900">{(a.type || 'update').replace(/_/g, ' ')}</span>
                  {a.official && <Badge variant="outline" className="border-blue-300 bg-blue-50 text-[10px] text-blue-800">Official</Badge>}
                  {a.pinned && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">Pinned</Badge>}
                  <span className="ml-auto text-[10px] text-neutral-400">{new Date(a.createdAt).toLocaleString()}</span>
                </div>
                {(a.text || a.message) && (
                  <p className="mt-1 text-sm text-neutral-700">{a.text || a.message}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
