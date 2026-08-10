'use client'

// /vehicle-inspections/[id] — Inspection detail. Read-mostly with an "Edit"
// affordance to add end-of-shift data (mileage end, fuel end, end time) to a
// pre-shift inspection.

import React, { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import ContractorToolsGate from '@/components/ContractorToolsGate'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft, Truck, Gauge, Fuel, AlertTriangle, CheckCircle2, ShieldAlert, Loader2,
  Calendar, User, Trash2, Save, X,
} from 'lucide-react'
import { useVehicleInspection } from '@/hooks/use-vehicle-inspection'
import { useVehicleInspectionActions } from '@/hooks/use-vehicle-inspection-actions'
import { FUEL_LABEL, LOAD_LABEL, CLEAN_LABEL, FUEL } from '@/constants/vehicle_inspections_constants'
import { phaseLabel, humanizeChecklistKey, humanizeToken, buildEndShiftPayload } from '@/lib/vehicle-inspections-helpers'

export default function InspectionDetailPage() {
  return (
    <ContractorToolsGate toolName="Vehicle Inspections">
      <InspectionDetail />
    </ContractorToolsGate>
  )
}

function InspectionDetail() {
  const { id } = useParams()
  const router = useRouter()
  const { inspection: ins, loading, error, setInspection } = useVehicleInspection(id)
  const { update, remove } = useVehicleInspectionActions()
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const startEdit = () => {
    setDraft({
      mileageEnd: ins?.mileageEnd ?? '',
      fuelEnd: ins?.fuelEnd ?? '',
      endTime: ins?.endTime ?? '',
      phase: ins?.phase || 'pre_shift',
    })
    setEditMode(true)
  }
  const cancelEdit = () => { setEditMode(false); setDraft({}) }
  const saveEdit = async () => {
    setSaving(true)
    const res = await update(id, buildEndShiftPayload(draft, ins))
    if (res.ok) {
      setInspection(res.inspection)
      setEditMode(false)
    } else {
      setSaveError(res.error)
    }
    setSaving(false)
  }

  const onDelete = async () => {
    const ok = await remove(id)
    if (ok) router.push('/vehicle-inspections')
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-neutral-50">
          <div className="container mx-auto flex items-center gap-2 px-4 py-16 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading inspection…
        </div>
      </div>
    )
  }
  if (error || !ins) {
    return (
      <div className="min-h-[100dvh] bg-neutral-50">
          <div className="container mx-auto px-4 py-16">
          <Card className="mx-auto max-w-md"><CardContent className="space-y-3 p-6 text-center">
            <AlertTriangle className="mx-auto h-7 w-7 text-amber-600" />
            <h1 className="font-bold">Couldn't load this inspection</h1>
            <p className="text-sm text-neutral-600">{(error && String(error.message || error)) || 'Not found.'}</p>
            <Button asChild><Link href="/vehicle-inspections">Back to inspections</Link></Button>
          </CardContent></Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-50">

      {/* Hero */}
      <section className="container mx-auto px-4 py-5">
        <div className="mb-3 flex items-center gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/vehicle-inspections"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>
        </div>
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{ins.vehicleNumber}</h1>
                  <Badge variant="outline">{phaseLabel(ins.phase)}</Badge>
                  {ins.issuesFlag ? (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><ShieldAlert className="mr-1 h-3 w-3" /> Issues</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="mr-1 h-3 w-3" /> Clean</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-600">
                  <span><User className="mr-1 inline h-3 w-3" /> {ins.driverName}</span>
                  <span><Calendar className="mr-1 inline h-3 w-3" /> {ins.date}</span>
                  {ins.startTime && <span>Start {ins.startTime}</span>}
                  {ins.endTime && <span>End {ins.endTime}</span>}
                  {ins.vehicleType && <span>{ins.vehicleType}</span>}
                  {ins.licensePlate && <span>Plate {ins.licensePlate}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {!editMode && <Button variant="outline" size="sm" onClick={startEdit}>Add end-of-shift</Button>}
                <Button variant="outline" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* End-of-shift edit panel */}
      {editMode && (
        <section className="container mx-auto px-4 pb-4">
          <Card><CardContent className="space-y-3 p-5">
            <div className="text-sm font-bold">Add end-of-shift data</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label className="text-xs">End mileage</Label><Input type="number" className="mt-1" value={draft.mileageEnd} onChange={(e) => setDraft({ ...draft, mileageEnd: e.target.value })} placeholder="e.g. 124680" /></div>
              <div><Label className="text-xs">End time</Label><Input type="time" className="mt-1" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} /></div>
              <div>
                <Label className="text-xs">Fuel at end</Label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {FUEL.map((f) => (
                    <button type="button" key={f} onClick={() => setDraft({ ...draft, fuelEnd: draft.fuelEnd === f ? '' : f })} className={`min-w-[44px] rounded-md border px-2 py-1 text-xs font-semibold ${draft.fuelEnd === f ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'}`}>{FUEL_LABEL[f]}</button>
                  ))}
                </div>
              </div>
            </div>
            {saveError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{saveError}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit}><X className="mr-1 h-4 w-4" /> Cancel</Button>
              <Button size="sm" disabled={saving} onClick={saveEdit} className="bg-brand-600 hover:bg-brand-700">
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save
              </Button>
            </div>
          </CardContent></Card>
        </section>
      )}

      {/* Body */}
      <section className="container mx-auto grid gap-4 px-4 pb-16 md:grid-cols-2">
        <Card><CardContent className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Gauge className="h-4 w-4 text-brand-600" /> Mileage</h2>
          <KV k="Start" v={`${(ins.mileageStart || 0).toLocaleString()} mi`} />
          <KV k="End" v={ins.mileageEnd != null ? `${ins.mileageEnd.toLocaleString()} mi` : '—'} />
          <KV k="Driven" v={`${(ins.milesDriven || 0).toLocaleString()} mi`} bold />
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Fuel className="h-4 w-4 text-brand-600" /> Fuel</h2>
          <KV k="At start" v={FUEL_LABEL[ins.fuelStart] || '—'} />
          <KV k="At end" v={ins.fuelEnd ? FUEL_LABEL[ins.fuelEnd] : '—'} />
        </CardContent></Card>

        <Card className={ins.dashboardLightsReported ? 'border-red-200' : ''}><CardContent className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><ShieldAlert className={`h-4 w-4 ${ins.dashboardLightsReported ? 'text-red-600' : 'text-neutral-400'}`} /> Dashboard lights</h2>
          {ins.dashboardLightsReported ? (
            <div className="flex flex-wrap gap-1.5">{(ins.dashboardLights || []).map((d) => <Badge key={d} className="bg-red-50 text-red-700 hover:bg-red-50">{humanizeToken(d)}</Badge>)}</div>
          ) : (
            <p className="text-sm text-neutral-600">All clear — no warning lights reported.</p>
          )}
        </CardContent></Card>

        <Card className={ins.damageReported ? 'border-red-200' : ''}><CardContent className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><AlertTriangle className={`h-4 w-4 ${ins.damageReported ? 'text-red-600' : 'text-neutral-400'}`} /> Damage</h2>
          {ins.damageReported ? (
            <div className="space-y-2">
              {ins.damageLocations?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">{ins.damageLocations.map((l) => <Badge key={l} className="bg-red-50 text-red-700 hover:bg-red-50">{humanizeToken(l)}</Badge>)}</div>
              )}
              {ins.damageDescription && <p className="text-sm text-neutral-700">{ins.damageDescription}</p>}
              {ins.damagePhotos?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {ins.damagePhotos.map((p, i) => (
                    <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 overflow-hidden rounded-md border border-neutral-200">
                      <img src={p} alt={`damage-${i}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : <p className="text-sm text-neutral-600">No new damage reported.</p>}
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Truck className="h-4 w-4 text-brand-600" /> Load & cleanliness</h2>
          <KV k="Load" v={LOAD_LABEL[ins.loadStatus] || '—'} />
          <KV k="Clean status" v={CLEAN_LABEL[ins.cleanliness] || '—'} />
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><CheckCircle2 className="h-4 w-4 text-brand-600" /> Safety checklist</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(ins.checklist || {}).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between">
                <span className="capitalize">{humanizeChecklistKey(k)}</span>
                {v ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-xs font-bold text-red-600">Failed</span>}
              </li>
            ))}
          </ul>
        </CardContent></Card>

        {ins.notes && (
          <Card className="md:col-span-2"><CardContent className="p-5">
            <h2 className="mb-2 text-sm font-bold">Notes</h2>
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{ins.notes}</p>
          </CardContent></Card>
        )}
      </section>
    </div>
  )
}

function KV({ k, v, bold }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 py-1 last:border-b-0">
      <span className="text-xs text-neutral-500">{k}</span>
      <span className={`text-sm ${bold ? 'font-extrabold text-neutral-900' : 'text-neutral-800'}`}>{v}</span>
    </div>
  )
}
