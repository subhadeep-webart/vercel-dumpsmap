'use client'

// WriteReviewModal
// ---------------------------------------------------------------------------
// The facility detail page's "Write a review" flow. Previously the Reviews-tab
// button was a dead end (no onClick). This is a small, self-contained dialog
// that posts to the existing POST /api/reviews endpoint
// ({ facilityId, rating, text, material }) — the same contract the legacy
// home/FacilityDetail modal used — with a star picker, optional material tag,
// a pending state (so no double-submit), and a success callback so the parent
// can refresh the list.

import { useState } from 'react'
import { toast } from 'sonner'
import { Star, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { api } from '@/lib/api-client'

export default function WriteReviewModal({ open, onOpenChange, facility, onPosted }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [text, setText] = useState('')
  const [material, setMaterial] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => { setRating(0); setHover(0); setText(''); setMaterial(''); setBusy(false) }

  const close = (v) => {
    if (busy) return // don't let a click-away cancel an in-flight submit
    onOpenChange(v)
    if (!v) reset()
  }

  const submit = async () => {
    if (!rating) { toast.error('Pick a star rating first'); return }
    setBusy(true)
    try {
      await api.post('/reviews', {
        facilityId: facility?.id,
        rating,
        text: text.trim(),
        material: material.trim() || undefined,
      })
      toast.success('Review posted — thanks!')
      onOpenChange(false)
      reset()
      onPosted?.()
    } catch (e) {
      toast.error(e?.message || 'Could not post review')
      setBusy(false)
    }
  }

  const shown = hover || rating
  const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> Review {facility?.name || 'this facility'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Star picker */}
          <div>
            <Label className="text-xs">Your rating</Label>
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  className="rounded p-0.5 transition hover:scale-110"
                >
                  <Star className={`h-7 w-7 transition ${n <= shown ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}`} />
                </button>
              ))}
              <span className="ml-2 text-sm font-semibold text-neutral-600">{labels[shown]}</span>
            </div>
          </div>

          <div>
            <Label className="text-xs">Your review (optional)</Label>
            <Textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="How was the wait, pricing, staff, or accepted materials?"
            />
          </div>

          <div>
            <Label className="text-xs">Material dropped off (optional)</Label>
            <Input
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="e.g. concrete, e-waste, yard waste"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !rating} className="bg-brand-600 hover:bg-brand-700">
            {busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Posting…</> : <>Post review</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
