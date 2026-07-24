'use client'

// ContactSellerModal — buyer-facing dialog for reaching out to a marketplace seller.
// Requires the buyer to be logged in (matches the strategic decision made in the
// July 2026 marketplace revival). Fields auto-fill from the buyer's user profile,
// but remain editable (they may want to use a different reply-to email).
//
// Submit hits POST /api/marketplace/contact-seller which:
//   • saves the request to `marketplace_contact_requests`
//   • emails the seller via Gmail SMTP (if configured, otherwise queues admin notif)
//   • replies with { ok, sent, queued }

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Mail, Phone, User as UserIcon, MessageSquare, CheckCircle2, Send, Shield, Info } from 'lucide-react'

export default function ContactSellerModal({ open, onOpenChange, listing, user }) {
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null) // { sent: bool, queued: bool }
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })

  useEffect(() => {
    if (open && user) {
      // Auto-fill from user profile; user can still edit.
      setForm((f) => ({
        name:    user.name || user.email?.split('@')[0] || '',
        email:   user.email || '',
        phone:   user.phone || f.phone,
        message: f.message,
      }))
    }
    if (!open) {
      setSuccess(null)
      setForm((f) => ({ ...f, message: '' }))
    }
  }, [open, user])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const priceStr = (() => {
    if (!listing) return ''
    if (listing.priceType === 'free' || listing.price === 0) return 'FREE'
    if (listing.priceType === 'donation') return 'Donation'
    if (listing.priceType === 'trade')    return 'Trade'
    if (listing.priceType === 'obo')      return `$${Number(listing.price || 0).toFixed(0)} OBO`
    return `$${Number(listing.price || 0).toFixed(0)}`
  })()

  const submit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.email.includes('@')) return toast.error('Please enter a valid email')
    if (!form.message.trim() || form.message.trim().length < 5) return toast.error('Please add a short message (min 5 chars)')
    setSubmitting(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
      const r = await fetch('/api/marketplace/contact-seller', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          listingId:   listing.id,
          buyerName:   form.name.trim(),
          buyerEmail:  form.email.trim(),
          buyerPhone:  form.phone.trim(),
          message:     form.message.trim(),
        }),
      })
      const j = await r.json()
      if (r.ok && j.ok) {
        setSuccess({ sent: j.sent === true, queued: j.queued === true })
        toast.success(j.sent ? 'Message sent to seller!' : 'Message queued — seller will be notified.')
      } else {
        toast.error(j.error || 'Something went wrong')
      }
    } catch (err) {
      toast.error('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!listing) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {success ? (
          // ───── SUCCESS STATE ─────
          <div className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-xl font-bold">
              {success.sent ? 'Message sent!' : 'Message received!'}
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              {success.sent
                ? <>The seller has been emailed. When they reply, it'll come straight to <strong>{form.email}</strong>.</>
                : <>We've recorded your message and notified the seller. They'll reach out to <strong>{form.email}</strong> soon.</>}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={() => onOpenChange(false)} className="bg-emerald-600 hover:bg-emerald-700">Done</Button>
            </div>
          </div>
        ) : (
          // ───── FORM ─────
          <form onSubmit={submit}>
            {/* Header — listing summary */}
            <div className="flex items-start gap-3 border-b border-neutral-200 bg-gradient-to-br from-emerald-50 to-white p-4">
              {listing.photos?.[0] ? (
                <img src={normalizePhoto(listing.photos[0])} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-neutral-200 text-neutral-400">
                  <MessageSquare className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <DialogHeader className="space-y-0">
                  <DialogTitle className="line-clamp-2 text-base font-bold">Contact seller</DialogTitle>
                </DialogHeader>
                <div className="mt-0.5 line-clamp-1 text-[13px] font-semibold text-neutral-800">{listing.title}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{priceStr}</Badge>
                  {listing.city && <span className="text-[11px] text-neutral-500">{listing.city}</span>}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="flex items-center gap-1 text-[12px]"><UserIcon className="h-3 w-3" /> Your name</Label>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Alex R." className="mt-1 h-10" />
                </div>
                <div>
                  <Label className="flex items-center gap-1 text-[12px]"><Phone className="h-3 w-3" /> Phone (optional)</Label>
                  <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 123-4567" className="mt-1 h-10" />
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-1 text-[12px]"><Mail className="h-3 w-3" /> Reply-to email <span className="text-red-500">*</span></Label>
                <Input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@email.com" className="mt-1 h-10" />
                <p className="mt-1 text-[10px] text-neutral-500">The seller will reply directly to this email.</p>
              </div>

              <div>
                <Label className="flex items-center gap-1 text-[12px]"><MessageSquare className="h-3 w-3" /> Message <span className="text-red-500">*</span></Label>
                <Textarea
                  required
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  placeholder={`Hi, is this still available? I'm interested in —`}
                  className="mt-1 min-h-[100px]"
                />
              </div>

              <div className="flex items-start gap-2 rounded-md bg-neutral-50 p-2.5 text-[11px] leading-relaxed text-neutral-600">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>DumpMaps never shares seller emails publicly. Your message goes through us and lands in their inbox with your reply-to attached.</span>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="gap-2 border-t border-neutral-200 bg-neutral-50 p-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                {submitting ? 'Sending…' : <><Send className="mr-1.5 h-4 w-4" /> Send message</>}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function normalizePhoto(url) {
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('/uploads/')) return `/api/files/${url.slice('/uploads/'.length)}`
  return url
}
