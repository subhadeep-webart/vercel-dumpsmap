'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { isLikelyLoggedIn } from '@/lib/api-client'

export default function ClaimBusinessDialog({ open, onOpenChange, facility, onSubmitted }) {
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    claimantName: '', businessRole: '', businessEmail: '',
    phone: '', website: '', proofNotes: '', message: '',
  })
  const upd = (k, v) => setForm((s) => ({ ...s, [k]: v }))

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!isLikelyLoggedIn()) { toast.error('Please log in to claim this business'); return }
    if (!form.claimantName || !form.businessEmail) { toast.error('Name and business email required'); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/facility-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId: facility.id, ...form }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      toast.success('Your claim request has been submitted for admin review.')
      onSubmitted?.(j.claim)
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message || 'Failed to submit claim')
    } finally { setSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Flex column with capped height so the header + footer stay fixed and
          only the body scrolls. Override the primitive's own padding/overflow
          (p-6, overflow-y-auto) which would otherwise scroll the whole modal. */}
      <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-none border-b border-neutral-200 px-6 py-4">
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-brand-600" /> Claim this business</DialogTitle>
          <DialogDescription>
            Submitting a claim for <b>{facility?.name}</b>. Our admin team reviews each claim to verify ownership before granting access.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Your name *</Label><Input value={form.claimantName} onChange={(e) => upd('claimantName', e.target.value)} placeholder="Full name" /></div>
              <div><Label>Your role / title</Label><Input value={form.businessRole} onChange={(e) => upd('businessRole', e.target.value)} placeholder="Owner / Manager / GM" /></div>
              <div><Label>Business email *</Label><Input type="email" value={form.businessEmail} onChange={(e) => upd('businessEmail', e.target.value)} placeholder="you@facility.com" /></div>
              <div><Label>Business phone</Label><Input value={form.phone} onChange={(e) => upd('phone', e.target.value)} placeholder="(555) 555-5555" /></div>
              <div className="col-span-2"><Label>Website</Label><Input value={form.website} onChange={(e) => upd('website', e.target.value)} placeholder="https://…" /></div>
            </div>
            <div>
              <Label>Proof of ownership notes</Label>
              <Textarea rows={2} value={form.proofNotes} onChange={(e) => upd('proofNotes', e.target.value)} placeholder="How can we verify you? (Business license #, domain email match, listing on Google, etc.)" />
            </div>
            <div>
              <Label>Message to admin (optional)</Label>
              <Textarea rows={2} value={form.message} onChange={(e) => upd('message', e.target.value)} placeholder="Anything else we should know…" />
            </div>
          </div>
          <div className="flex-none space-y-2 border-t border-neutral-200 px-6 py-4">
            <Button type="submit" disabled={submitting} className="w-full bg-brand-600 hover:bg-brand-700">
              {submitting ? 'Submitting…' : 'Submit claim request'}
            </Button>
            <p className="text-center text-[11px] text-neutral-500">We’ll reply to your business email within 1–2 business days.</p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
