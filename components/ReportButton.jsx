'use client'

import React, { useState } from 'react'
import { Flag } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { isLikelyLoggedIn } from '@/lib/api-client'

const REASONS = [
  { value: 'spam',         label: 'Spam / promotional' },
  { value: 'scam',         label: 'Scam / fraudulent' },
  { value: 'inappropriate',label: 'Inappropriate content' },
  { value: 'inaccurate',   label: 'Inaccurate / wrong info' },
  { value: 'duplicate',    label: 'Duplicate of another listing' },
  { value: 'closed',       label: 'Facility is permanently closed' },
  { value: 'other',        label: 'Other' },
]

/**
 * Universal "Report" button used across cards.
 * Props:
 *   - kind: 'facility' | 'marketplace' | 'job' | 'alert' | 'profile' | 'message'
 *   - targetId: id of the item being reported
 *   - targetUserId: (optional) id of the user behind the item (for profile reports)
 *   - className / size: pass-through for styling
 *   - variant: 'icon' (default) | 'inline'
 */
export default function ReportButton({ kind, targetId, targetUserId, className = '', variant = 'icon', label }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!reason) return toast.error('Pick a reason')
    setSubmitting(true)
    try {
      if (!isLikelyLoggedIn()) {
        toast.error('Please log in to report content')
        setSubmitting(false)
        return
      }
      const r = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetKind: kind, targetId, targetUserId, reason, detail }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      toast.success('Thanks — report submitted for moderation.')
      setOpen(false); setReason(''); setDetail('')
    } catch (err) {
      toast.error(err.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const triggerProps = {
    onClick: (e) => { e.stopPropagation(); e.preventDefault(); setOpen(true) },
    'aria-label': 'Report content',
  }

  return (
    <>
      {variant === 'inline' ? (
        <button {...triggerProps} className={`inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-500 hover:border-red-300 hover:text-red-700 ${className}`}>
          <Flag className="h-3 w-3" /> {label || 'Report'}
        </button>
      ) : (
        <button {...triggerProps} className={`rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 ${className}`}>
          <Flag className="h-3.5 w-3.5" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Flex column with capped height so the header stays fixed and only the
            body scrolls. Override the primitive's own padding/overflow (p-6,
            overflow-y-auto) which would otherwise scroll the whole modal. */}
        <DialogContent className="flex max-h-[90dvh] max-w-md flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="flex-none border-b border-neutral-200 px-6 py-4">
            <DialogTitle>Report this {kind}</DialogTitle>
            <DialogDescription className="text-xs">
              Our moderators review every report. Please don&apos;t submit duplicate reports.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
              <div>
                <Label className="text-sm">Reason</Label>
                <div className="mt-1 grid grid-cols-1 gap-1.5">
                  {REASONS.map((r) => (
                    <label key={r.value} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${reason === r.value ? 'border-red-500 bg-red-50' : 'border-neutral-200 bg-white'}`}>
                      <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-red-600" />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">Details (optional)</Label>
                <Textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="What did you see? Provide context that will help moderation." />
              </div>
            </div>
            <div className="flex-none border-t border-neutral-200 px-6 py-4">
              <Button type="submit" disabled={submitting} className="w-full bg-red-600 hover:bg-red-700">
                {submitting ? 'Submitting…' : 'Submit report'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
