'use client'

// Primary action bar — Directions / Call / Check In / Save / Share plus the
// role-gated Claim, Owner edit, and Admin actions. Extracted from
// app/facilities/[id]/page.js. All handlers are delegated to the parent.

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Navigation, Phone, Gift, Save, Share2, KeyRound, Edit3, ShieldAlert, Loader2 } from 'lucide-react'

export default function PrimaryActionBar({ facility, directionsUrl, isClaimed, isOwner, isStaffUser, token, editing, onShare, onSave, saving, onClaim, onToggleEdit, onCheckIn }) {
  return (
    <section className="border-b border-neutral-200 bg-white">
      <div className="container mx-auto flex flex-wrap items-center gap-2 px-4 py-3">
        <Button asChild className="bg-brand-600 hover:bg-brand-700">
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
            <Navigation className="mr-1.5 h-4 w-4" /> Directions
          </a>
        </Button>
        {facility.phone && (
          <Button asChild variant="outline" className="border-brand-300 text-brand-700 hover:bg-brand-50">
            <a href={`tel:${facility.phone}`}>
              <Phone className="mr-1.5 h-4 w-4" /> Call
            </a>
          </Button>
        )}
        {facility.rewardsPartner && (
          <Button className="bg-green-600 hover:bg-green-700" onClick={onCheckIn}>
            <Gift className="mr-1.5 h-4 w-4" /> Check In & Earn
          </Button>
        )}
        <Button variant="outline" onClick={onSave} disabled={saving}>
          {saving
            ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</>
            : <><Save className="mr-1.5 h-4 w-4" /> Save</>}
        </Button>
        <Button variant="outline" onClick={onShare}>
          <Share2 className="mr-1.5 h-4 w-4" /> Share
        </Button>
        {!isClaimed && !isOwner && !isStaffUser && (
          <Button variant="outline" className="border-blue-400 text-blue-700 hover:bg-blue-50" onClick={onClaim}>
            <KeyRound className="mr-1.5 h-4 w-4" /> Claim
          </Button>
        )}
        {(isOwner || isStaffUser) && (
          <Button variant="outline" onClick={onToggleEdit}>
            <Edit3 className="mr-1.5 h-4 w-4" /> {editing ? 'Cancel edit' : 'Owner edit'}
          </Button>
        )}
        {isStaffUser && (
          <Link href="/admin/facilities" className="inline-flex items-center gap-1 rounded-md border border-purple-300 bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-800 hover:bg-purple-100">
            <ShieldAlert className="h-4 w-4" /> Admin
          </Link>
        )}
      </div>
    </section>
  )
}
