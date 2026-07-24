'use client'

// Sidebar cards for the facility detail page: contact, hours, map/location,
// photos, ownership, and the report row. Extracted from
// app/facilities/[id]/page.js.

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Phone, Globe, MapPin, Clock, CalendarDays, Image as ImageIcon, Users, KeyRound } from 'lucide-react'
import SafeImage from '@/components/SafeImage'
import ReportButton from '@/components/ReportButton'
import StartDmButton from '@/components/messaging/StartDmButton'
import FacilityMap from './FacilityMapDynamic'
import { Field } from './primitives'

export function SidebarContactCard({ facility, editing, editForm, setEditForm }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-green-600" /> Contact</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {editing ? (
          <>
            <div><div className="mb-1 text-xs font-semibold">Phone</div><Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(555) 555-5555" /></div>
            <div><div className="mb-1 text-xs font-semibold">Website</div><Input value={editForm.website} onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://…" /></div>
          </>
        ) : (
          <>
            <Field icon={Phone} label="Phone" value={facility.phone} href={facility.phone ? `tel:${facility.phone}` : undefined} placeholder="Not listed" />
            <Field icon={Globe} label="Website" value={facility.website} link placeholder="Not listed" />
            <Field icon={MapPin} label="Address" value={facility.address} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function SidebarHoursCard({ facility, editing, editForm, setEditForm }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-green-600" /> Hours</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {editing ? (
          <Input value={editForm.hours} onChange={(e) => setEditForm((f) => ({ ...f, hours: e.target.value }))} placeholder="Mon-Fri 7-5, Sat 8-2" />
        ) : facility.hours ? (
          <div className="text-neutral-800">{facility.hours}</div>
        ) : (
          <div className="italic text-neutral-500">Call to confirm hours.</div>
        )}
        {facility.updatedAt && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-neutral-400">
            <CalendarDays className="h-3 w-3" /> Updated {new Date(facility.updatedAt).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Maps-style location panel — real interactive OpenStreetMap (Leaflet). The
// directions CTA lives inside the map overlay, so no separate button is needed.
export function SidebarMapCard({ facility, directionsUrl }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <MapPin className="h-4 w-4 text-green-600" /> Location
        </div>
        {facility.address && (
          <span className="max-w-[60%] truncate text-[11px] text-neutral-500">{facility.address}</span>
        )}
      </div>
      <FacilityMap facility={facility} directionsUrl={directionsUrl} className="h-64" />
    </div>
  )
}

export function SidebarPhotosCard({ facility }) {
  const photos = Array.isArray(facility.photos) ? facility.photos : []
  if (photos.length === 0) return null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><ImageIcon className="h-4 w-4 text-green-600" /> Photos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-1.5">
          {photos.slice(0, 9).map((p, i) => (
            <SafeImage key={i} src={p} alt="" kind="facility" className="aspect-square w-full rounded object-cover" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SidebarOwnershipCard({ facility, isClaimed, isStaffUser, user, token, onClaim }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-green-600" /> Ownership</CardTitle>
      </CardHeader>
      <CardContent>
        {isClaimed && facility.owner ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-1 font-semibold text-blue-800"><KeyRound className="h-3.5 w-3.5" /> Verified Owner</div>
            <div className="text-xs text-neutral-600">{facility.owner.name || facility.owner.email}</div>
            {user && facility.owner.id && facility.owner.id !== user.id && (
              <StartDmButton
                targetUserId={facility.owner.id}
                targetUserName={facility.owner.name || 'Owner'}
                currentUser={user}
                token={token}
                size="sm"
                variant="outline"
                label="Message owner"
                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
              />
            )}
            {!user && <p className="text-[10px] text-neutral-500">Log in to message the owner.</p>}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="text-neutral-600">This facility is not yet claimed.</div>
            {!isStaffUser && (
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700" onClick={onClaim}>
                <KeyRound className="mr-1.5 h-4 w-4" /> Claim this business
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SidebarReportRow({ facility }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
      <span>Spot something wrong?</span>
      <ReportButton kind="facility" targetId={facility.id} variant="inline" label="Report" />
    </div>
  )
}
