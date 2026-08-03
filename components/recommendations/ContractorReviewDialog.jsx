'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { isLikelyLoggedIn } from '@/lib/api-client'

// `token` prop is retained for backward compat but no longer used — auth rides
// in the httpOnly cookie the global fetch shim attaches to every /api call.
export default function ContractorReviewDialog({ open, onOpenChange, contractorId, contractorName, token, existing, onSaved }) {
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [jobType, setJobType] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setRating(existing?.rating || 5)
      setText(existing?.text || '')
      setJobType(existing?.jobType || '')
    }
  }, [open, existing])

  const save = async () => {
    if (!isLikelyLoggedIn()) { toast.error('Log in to review'); return }
    if (rating < 1 || rating > 5) { toast.error('Pick a star rating'); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/reviews/contractor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorUserId: contractorId, rating, text, jobType }),
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Failed'); return }
      toast.success(existing ? 'Review updated' : 'Review submitted — thanks!')
      onSaved?.()
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async () => {
    if (!existing?.id) return
    if (!confirm('Delete your review?')) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/reviews/${existing.id}`, { method: 'DELETE' })
      if (!r.ok) { toast.error('Failed'); return }
      toast.success('Review removed')
      onSaved?.()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit your review' : 'Leave a review'}</DialogTitle>
          <DialogDescription>How was your experience with {contractorName}?</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} type="button" onClick={() => setRating(s)} className="p-1">
                <Star className={`h-7 w-7 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}`} />
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-neutral-600">Job type (optional)</label>
            <Input value={jobType} onChange={(e) => setJobType(e.target.value)} placeholder="e.g. Garage cleanout, Drywall removal" maxLength={80} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-neutral-600">Review</label>
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="What did they do well? Anything to flag?" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={submitting} className="flex-1 bg-amber-500 hover:bg-amber-600">
              {submitting ? 'Saving…' : existing ? 'Update review' : 'Submit review'}
            </Button>
            {existing && (
              <Button onClick={remove} disabled={submitting} variant="outline" className="text-red-600 hover:bg-red-50">Delete</Button>
            )}
          </div>
          <p className="text-[10px] text-neutral-400">Reviews are public. Be honest and fair — abuse will be removed.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
