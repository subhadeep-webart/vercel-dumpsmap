'use client'

// Commercial Access Application Dialog
// ---------------------------------------------------------------------------
// Lets a logged-in user request commercial B2B posting access.
// • Auto-approval is decided server-side (hybrid rule, see commercial-access.js)
// • If user is not signed in, we send them to login first
// • If user already has an open application, the server returns it instead

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Building2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

function authHeaders() {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const ROLE_OPTIONS = [
  { value: 'vendor', label: 'Vendor', helper: 'Supplier of commercial goods, parts, or wholesale inventory.' },
  { value: 'facility_owner', label: 'Facility Owner', helper: 'Recycling, transfer, salvage, or material-yard owner/operator.' },
  { value: 'property_manager', label: 'Property Manager', helper: 'Commercial property / portfolio FF&E disposition.' },
]

export default function CommercialAccessApplyDialog({ open, onClose, onApproved, onPending, currentAccess }) {
  const [requestedRole, setRequestedRole] = useState('vendor')
  const [companyName, setCompanyName] = useState('')
  const [website, setWebsite] = useState('')
  const [phone, setPhone] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Reset form when reopened
    if (open) {
      setRequestedRole('vendor')
      setCompanyName(''); setWebsite(''); setPhone(''); setBusinessDescription('')
    }
  }, [open])

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!companyName.trim()) { toast.error('Company name is required'); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/commercial-access/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ requestedRole, companyName: companyName.trim(), website: website.trim(), phone: phone.trim(), businessDescription: businessDescription.trim() }),
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Application failed'); return }
      if (j.status === 'approved') onApproved?.(j)
      else onPending?.(j)
    } catch (e) {
      toast.error('Network error: ' + (e?.message || 'unknown'))
    } finally { setSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" /> Apply for Commercial Access
          </DialogTitle>
          <DialogDescription>
            Commercial B2B access lets you post listings, message sellers, make offers, reserve items, and mark sold. Submit your business details — most contractors and recyclers are auto-approved.
          </DialogDescription>
        </DialogHeader>

        {currentAccess?.reason === 'pending_review' && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <AlertTriangle className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            You already have an application under review. Submitting again is optional.
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-neutral-600">Apply as</Label>
            <div className="mt-1 grid gap-1.5">
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm transition ${requestedRole === opt.value ? 'border-indigo-400 bg-indigo-50' : 'border-neutral-200 hover:bg-neutral-50'}`}
                >
                  <input
                    type="radio"
                    name="commrole"
                    value={opt.value}
                    checked={requestedRole === opt.value}
                    onChange={() => setRequestedRole(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-bold text-neutral-900">{opt.label}</div>
                    <div className="text-xs text-neutral-600">{opt.helper}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="cap-company" className="text-xs font-bold uppercase tracking-wider text-neutral-600">Company / Business name *</Label>
            <Input id="cap-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Hauling LLC" maxLength={200} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="cap-website" className="text-xs font-bold uppercase tracking-wider text-neutral-600">Website</Label>
              <Input id="cap-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acmehauling.com" maxLength={240} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="cap-phone" className="text-xs font-bold uppercase tracking-wider text-neutral-600">Phone</Label>
              <Input id="cap-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" maxLength={40} className="mt-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="cap-desc" className="text-xs font-bold uppercase tracking-wider text-neutral-600">Brief description of your business</Label>
            <Textarea id="cap-desc" value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} placeholder="What do you buy, sell, or service? Location, size, focus." rows={3} maxLength={2000} className="mt-1" />
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-900">
            <ShieldCheck className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            Existing verified contractors and recyclers are auto-approved. Others are reviewed within 24 hours.
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting || !companyName.trim()} className="bg-indigo-600 hover:bg-indigo-700">
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Building2 className="mr-1 h-4 w-4" />}
              Submit application
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
