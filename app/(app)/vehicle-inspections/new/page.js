'use client'

// /vehicle-inspections/new — Daily inspection form. Designed mobile-first
// because most contractors will fill this out from the truck cab.

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ContractorToolsGate from '@/components/ContractorToolsGate'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Truck, Gauge, Fuel, AlertTriangle, Camera, CheckCircle2, Loader2, Save, X,
  ShieldAlert, ClipboardCheck,
} from 'lucide-react'

const FUEL = [
  { v: 'empty', l: 'Empty' }, { v: '1_4', l: '¼' }, { v: '1_2', l: '½' },
  { v: '3_4', l: '¾' }, { v: 'full', l: 'Full' },
]
const LOAD = [
  { v: 'empty', l: 'Empty' }, { v: 'half', l: 'Half full' }, { v: 'full', l: 'Full' },
]
const CLEAN = [
  { v: 'clean', l: 'Clean' }, { v: 'dirty', l: 'Dirty' },
  { v: 'needs_wash', l: 'Needs wash' }, { v: 'needs_interior', l: 'Needs interior cleaning' },
]
const DASH_LIGHTS = [
  'Check engine', 'Oil pressure', 'Battery', 'Brake', 'Tire pressure',
  'ABS', 'Transmission', 'Coolant', 'Other',
]
const DAMAGE_LOCATIONS = [
  'Front', 'Rear', 'Driver side', 'Passenger side', 'Roof', 'Interior', 'Tires', 'Other',
]
const CHECKLIST = [
  ['tires',           'Tires checked'],
  ['lights',          'Lights working'],
  ['brakes',          'Brakes working'],
  ['mirrors',         'Mirrors okay'],
  ['backupCamera',    'Backup camera okay'],
  ['liftgate',        'Liftgate / dump bed working'],
  ['registration',    'Registration & insurance present'],
  ['safetyEquipment', 'Safety equipment present'],
  ['firstAid',        'First aid kit present'],
  ['strapsTools',     'Straps / tools secured'],
]

export default function NewInspectionPage() {
  return (
    <ContractorToolsGate toolName="Vehicle Inspections">
      <NewInspection />
    </ContractorToolsGate>
  )
}

function NewInspection() {
  const router = useRouter()
  const [form, setForm] = useState({
    vehicleNumber: '', vehicleType: '', licensePlate: '', driverName: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '', endTime: '',
    phase: 'pre_shift',
    mileageStart: '', mileageEnd: '',
    fuelStart: 'full', fuelEnd: '',
    dashboardLightsReported: false, dashboardLights: [],
    damageReported: false, damageDescription: '', damageLocations: [], damagePhotos: [],
    loadStatus: 'empty',
    cleanliness: 'clean',
    checklist: Object.fromEntries(CHECKLIST.map(([k]) => [k, true])),
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const milesDriven = useMemo(() => {
    const a = Number(form.mileageStart) || 0
    const b = form.mileageEnd === '' ? null : (Number(form.mileageEnd) || 0)
    return b != null && b >= a ? b - a : 0
  }, [form.mileageStart, form.mileageEnd])

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const updateChecklist = (k, v) => setForm((p) => ({ ...p, checklist: { ...p.checklist, [k]: v } }))
  const toggleArray = (key, value) => setForm((p) => {
    const arr = p[key] || []
    return { ...p, [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] }
  })

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Upload failed')
      const url = j.url || j.fileUrl || j.path
      update('damagePhotos', [...form.damagePhotos, url])
    } catch (err) {
      setError(String(err.message || err))
    } finally { setUploading(false); e.target.value = '' }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.vehicleNumber.trim()) { setError('Truck / vehicle number is required.'); return }
    if (!form.driverName.trim()) { setError('Driver name is required.'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        ...form,
        mileageStart: Number(form.mileageStart) || 0,
        mileageEnd: form.mileageEnd === '' ? null : (Number(form.mileageEnd) || 0),
      }
      const r = await fetch('/api/vehicle-inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      router.push(`/vehicle-inspections/${j.inspection.id}`)
    } catch (err) {
      setError(String(err.message || err))
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-50">

      <section className="container mx-auto px-4 py-5 sm:py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">New inspection</div>
            <h1 className="mt-0.5 text-xl font-extrabold tracking-tight sm:text-2xl">Daily vehicle inspection</h1>
            <p className="mt-0.5 text-xs text-neutral-600">Fill out pre-shift now; come back after the shift to add end-of-day mileage &amp; fuel.</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link href="/vehicle-inspections">Cancel</Link></Button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* VEHICLE INFO */}
          <FormSection title="Vehicle" icon={Truck}>
            <Row2>
              <Field label="Truck / vehicle # *">
                <Input value={form.vehicleNumber} onChange={(e) => update('vehicleNumber', e.target.value)} placeholder="e.g. Truck #3" required />
              </Field>
              <Field label="Driver name *">
                <Input value={form.driverName} onChange={(e) => update('driverName', e.target.value)} placeholder="Driver name" required />
              </Field>
            </Row2>
            <Row3>
              <Field label="Vehicle type">
                <Input value={form.vehicleType} onChange={(e) => update('vehicleType', e.target.value)} placeholder="e.g. Dump truck" />
              </Field>
              <Field label="License plate (optional)">
                <Input value={form.licensePlate} onChange={(e) => update('licensePlate', e.target.value)} placeholder="—" />
              </Field>
              <Field label="Phase">
                <Select value={form.phase} onValueChange={(v) => update('phase', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre_shift">Pre-shift only</SelectItem>
                    <SelectItem value="post_shift">Post-shift only</SelectItem>
                    <SelectItem value="both">Pre + Post combined</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Row3>
            <Row3>
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} required /></Field>
              <Field label="Start time"><Input type="time" value={form.startTime} onChange={(e) => update('startTime', e.target.value)} /></Field>
              <Field label="End time"><Input type="time" value={form.endTime} onChange={(e) => update('endTime', e.target.value)} /></Field>
            </Row3>
          </FormSection>

          {/* MILEAGE */}
          <FormSection title="Mileage" icon={Gauge}>
            <Row3>
              <Field label="Start mileage"><Input type="number" inputMode="numeric" value={form.mileageStart} onChange={(e) => update('mileageStart', e.target.value)} placeholder="e.g. 124500" /></Field>
              <Field label="End mileage (optional)"><Input type="number" inputMode="numeric" value={form.mileageEnd} onChange={(e) => update('mileageEnd', e.target.value)} placeholder="Add at end of day" /></Field>
              <Field label="Miles driven (auto)">
                <div className="flex h-10 items-center rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm font-bold">{milesDriven.toLocaleString()} mi</div>
              </Field>
            </Row3>
          </FormSection>

          {/* FUEL */}
          <FormSection title="Fuel" icon={Fuel}>
            <Row2>
              <Field label="Tank at start">
                <FuelButtons value={form.fuelStart} onChange={(v) => update('fuelStart', v)} />
              </Field>
              <Field label="Tank at end (optional)">
                <FuelButtons value={form.fuelEnd} onChange={(v) => update('fuelEnd', v)} allowClear />
              </Field>
            </Row2>
          </FormSection>

          {/* DASHBOARD LIGHTS */}
          <FormSection title="Dashboard lights" icon={ShieldAlert}>
            <YesNo label="Any dashboard warning lights on?" value={form.dashboardLightsReported} onChange={(v) => update('dashboardLightsReported', v)} />
            {form.dashboardLightsReported && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DASH_LIGHTS.map((l) => {
                  const k = l.toLowerCase().replace(/[^a-z]+/g, '_')
                  const on = form.dashboardLights.includes(k)
                  return (
                    <button type="button" key={k} onClick={() => toggleArray('dashboardLights', k)} className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-red-300 bg-red-50 text-red-700' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'}`}>
                      {l}
                    </button>
                  )
                })}
              </div>
            )}
          </FormSection>

          {/* DAMAGE */}
          <FormSection title="Damage report" icon={AlertTriangle}>
            <YesNo label="Any new damage to report?" value={form.damageReported} onChange={(v) => update('damageReported', v)} />
            {form.damageReported && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {DAMAGE_LOCATIONS.map((l) => {
                    const k = l.toLowerCase().replace(/[^a-z]+/g, '_')
                    const on = form.damageLocations.includes(k)
                    return (
                      <button type="button" key={k} onClick={() => toggleArray('damageLocations', k)} className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-red-300 bg-red-50 text-red-700' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'}`}>
                        {l}
                      </button>
                    )
                  })}
                </div>
                <Textarea rows={2} value={form.damageDescription} onChange={(e) => update('damageDescription', e.target.value)} placeholder="Describe the damage…" />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 text-brand-600" />}
                    {uploading ? 'Uploading…' : 'Add damage photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                  </label>
                  {form.damagePhotos.map((p, i) => (
                    <div key={i} className="relative h-12 w-12 overflow-hidden rounded-md border border-neutral-200">
                      <img src={p} alt={`damage-${i}`} className="h-full w-full object-cover" />
                      <button type="button" onClick={() => update('damagePhotos', form.damagePhotos.filter((_, j) => j !== i))} className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5 text-white">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </FormSection>

          {/* LOAD / CLEAN */}
          <FormSection title="Load & cleanliness" icon={Truck}>
            <Row2>
              <Field label="Load status">
                <PillRow value={form.loadStatus} onChange={(v) => update('loadStatus', v)} options={LOAD} />
              </Field>
              <Field label="Vehicle cleanliness">
                <Select value={form.cleanliness} onValueChange={(v) => update('cleanliness', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CLEAN.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </Row2>
          </FormSection>

          {/* CHECKLIST */}
          <FormSection title="Safety checklist" icon={ClipboardCheck}>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {CHECKLIST.map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm">
                  <Checkbox checked={form.checklist[k]} onCheckedChange={(v) => updateChecklist(k, !!v)} />
                  <span className={form.checklist[k] ? 'text-neutral-800' : 'text-red-700 font-semibold'}>{label}</span>
                </label>
              ))}
            </div>
          </FormSection>

          {/* NOTES */}
          <FormSection title="Notes" icon={ClipboardCheck}>
            <Textarea rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Anything else worth flagging?" />
          </FormSection>

          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}

          <div className="sticky bottom-0 z-10 -mx-4 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:relative sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <div className="flex items-center justify-end gap-2">
              <Button asChild type="button" variant="outline"><Link href="/vehicle-inspections">Cancel</Link></Button>
              <Button type="submit" disabled={saving} className="bg-brand-600 hover:bg-brand-700">
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Submit inspection
              </Button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}

// ---------------- helpers ----------------
function FormSection({ title, icon: Icon, children }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Icon className="h-4 w-4 text-brand-600" />{title}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
function Field({ label, children }) {
  return <div><Label className="text-[11px]">{label}</Label><div className="mt-1">{children}</div></div>
}
function Row2({ children }) { return <div className="grid gap-3 sm:grid-cols-2">{children}</div> }
function Row3({ children }) { return <div className="grid gap-3 sm:grid-cols-3">{children}</div> }

function YesNo({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2">
      <span className="text-sm text-neutral-800">{label}</span>
      <div className="flex gap-1">
        <button type="button" onClick={() => onChange(true)} className={`rounded-md px-3 py-1 text-xs font-semibold ${value ? 'bg-red-600 text-white' : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}>Yes</button>
        <button type="button" onClick={() => onChange(false)} className={`rounded-md px-3 py-1 text-xs font-semibold ${!value ? 'bg-emerald-600 text-white' : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}>No</button>
      </div>
    </div>
  )
}
function PillRow({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button type="button" key={o.v} onClick={() => onChange(o.v)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${value === o.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'}`}>
          {o.l}
        </button>
      ))}
    </div>
  )
}
function FuelButtons({ value, onChange, allowClear }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FUEL.map((f) => (
        <button type="button" key={f.v} onClick={() => onChange(value === f.v && allowClear ? '' : f.v)} className={`min-w-[44px] rounded-md border px-2 py-1 text-xs font-semibold ${value === f.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'}`}>
          {f.l}
        </button>
      ))}
    </div>
  )
}
