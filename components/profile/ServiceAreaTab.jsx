'use client'

// Service Area tab — home city, service radius, plus editable chip lists for
// covered ZIP codes and preferred work zones. Chip add/remove persists the
// whole array immediately.

import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldRow, SavingHint } from '@/components/profile/primitives'
import { MapPin } from 'lucide-react'

export default function ServiceAreaTab({ form, setForm, save, saving }) {
  const [zipDraft, setZipDraft] = useState('')
  const [zoneDraft, setZoneDraft] = useState('')

  const addZip = () => {
    const v = (zipDraft || '').trim()
    if (!v) return
    const next = [...new Set([...(form.zipCodes || []), v])]
    setForm({ ...form, zipCodes: next })
    save({ zipCodes: next }, 'ZIP codes')
    setZipDraft('')
  }
  const removeZip = (z) => {
    const next = (form.zipCodes || []).filter((x) => x !== z)
    setForm({ ...form, zipCodes: next })
    save({ zipCodes: next }, 'ZIP codes')
  }
  const addZone = () => {
    const v = (zoneDraft || '').trim()
    if (!v) return
    const next = [...new Set([...(form.preferredZones || []), v])]
    setForm({ ...form, preferredZones: next })
    save({ preferredZones: next }, 'Preferred zones')
    setZoneDraft('')
  }
  const removeZone = (z) => {
    const next = (form.preferredZones || []).filter((x) => x !== z)
    setForm({ ...form, preferredZones: next })
    save({ preferredZones: next }, 'Preferred zones')
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Service area</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Home city" icon={MapPin}>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                onBlur={() => save({ city: form.city.trim() }, 'City')} />
            </FieldRow>
            <FieldRow label="Service radius (miles)" note="0-500">
              <Input type="number" min={0} max={500} value={form.serviceAreaRadiusMi}
                onChange={(e) => setForm({ ...form, serviceAreaRadiusMi: e.target.value })}
                onBlur={() => save({ serviceAreaRadiusMi: Number(form.serviceAreaRadiusMi) || 0 }, 'Service radius')} />
            </FieldRow>
          </div>

          <FieldRow label="ZIP codes you cover" note="Press Enter or click Add">
            <div className="flex gap-2">
              <Input value={zipDraft} onChange={(e) => setZipDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addZip() } }}
                placeholder="e.g. 95110" />
              <Button variant="outline" onClick={addZip}>Add</Button>
            </div>
            {(form.zipCodes || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(form.zipCodes || []).map((z) => (
                  <span key={z} className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
                    {z} <button onClick={() => removeZip(z)} className="text-green-600 hover:text-red-600">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </FieldRow>

          <FieldRow label="Preferred work zones" note="Neighbourhoods or named areas you prefer">
            <div className="flex gap-2">
              <Input value={zoneDraft} onChange={(e) => setZoneDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addZone() } }}
                placeholder="e.g. Downtown San Jose" />
              <Button variant="outline" onClick={addZone}>Add</Button>
            </div>
            {(form.preferredZones || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(form.preferredZones || []).map((z) => (
                  <span key={z} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                    {z} <button onClick={() => removeZone(z)} className="text-blue-600 hover:text-red-600">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </FieldRow>

          <div className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            <b>Map view</b> coming in a later sprint — you&apos;ll be able to draw your service area on the map directly.
          </div>
          {saving && <SavingHint label={saving} />}
        </CardContent>
      </Card>
    </div>
  )
}
