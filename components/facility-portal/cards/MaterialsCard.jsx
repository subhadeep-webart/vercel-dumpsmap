'use client'

// MaterialsCard — the Materials Accepted chip list with a "+N more" overflow and
// an editor that manages facility.accepted[] (comma/enter separated). Saves via
// the owner-update PATCH (accepted).

import { useState } from 'react'
import { Pencil, Check, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import PortalCard from '../PortalCard'
import { materialChips } from '../portal-helpers'

export default function MaterialsCard({ facility, saving, onSave, index = 0 }) {
  const { visible, extra, total } = materialChips(facility)
  const all = Array.isArray(facility?.accepted) ? facility.accepted.filter(Boolean) : []

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(all)
  const [draft, setDraft] = useState('')

  const addDraft = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean)
    if (!parts.length) return
    setItems((cur) => [...new Set([...cur, ...parts])])
    setDraft('')
  }
  const remove = (m) => setItems((cur) => cur.filter((x) => x !== m))

  const submit = async () => {
    const ok = await onSave({ accepted: items })
    if (ok) setOpen(false)
  }

  return (
    <PortalCard
      id="materials"
      title="Materials Accepted"
      index={index}
      action={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setItems(all); setDraft('') } }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit Materials</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Materials accepted</DialogTitle></DialogHeader>
            <div className="flex flex-wrap gap-2">
              {items.map((m) => (
                <span key={m} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-sm text-neutral-700">
                  {m}
                  <button type="button" onClick={() => remove(m)} className="text-neutral-400 hover:text-red-600" aria-label={`Remove ${m}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              {!items.length && <p className="text-sm text-neutral-400">No materials yet.</p>}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add material (comma-separated)"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraft() } }}
              />
              <Button type="button" variant="outline" onClick={addDraft} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Saving…' : 'Save materials'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <p className="mb-4 text-sm text-neutral-500">Update materials you accept at this location.</p>
      {total ? (
        <div className="flex flex-wrap gap-2">
          {visible.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-800 ring-1 ring-green-100">
              <Check className="h-3.5 w-3.5 text-green-600" /> {m}
            </span>
          ))}
          {extra > 0 && (
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-600">
              +{extra} more
            </span>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
          No materials listed yet.
        </div>
      )}
    </PortalCard>
  )
}
