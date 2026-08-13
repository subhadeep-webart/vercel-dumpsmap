'use client'

// WaitCapacityCard — 4 live stat tiles (Estimated Wait, Trucks in Line, Scale
// Status, Yard Capacity) with freshness stamps and tone-coloured values, plus an
// "Update Now" action that opens a quick editor. These signals live on the
// facility record (waitMinutes, trucksInLine, scaleStatus, capacityPct) and save
// through the owner-update PATCH.

import { useState } from 'react'
import { RefreshCw, Clock, Truck, Scale, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import PortalCard from '../PortalCard'
import { capacityTone, timeAgo } from '../portal-helpers'

function StatTile({ icon: Icon, label, value, valueClass = 'text-neutral-900', sub, freshness }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
        <Icon className="h-3.5 w-3.5 text-neutral-400" /> {label}
      </div>
      <div className={`mt-2 text-2xl font-extrabold tracking-tight ${valueClass}`}>{value}</div>
      {sub && <div className="text-[11px] font-medium text-neutral-500">{sub}</div>}
      {freshness && <div className="mt-1 text-[11px] text-neutral-400">Updated {freshness}</div>}
    </div>
  )
}

// `canEdit` mirrors the server's owner-only check on the owner-update PATCH.
export default function WaitCapacityCard({ facility, saving, onSave, index = 0, canEdit = true }) {
  const wait = facility?.waitMinutes
  const trucks = facility?.trucksInLine
  const scale = facility?.scaleStatus || 'open'
  const capacity = facility?.capacityPct
  const cap = capacityTone(capacity)
  const freshness = facility?.liveStatusUpdatedAt || facility?.updatedAt

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ waitMinutes: wait ?? '', trucksInLine: trucks ?? '', capacityPct: capacity ?? '' })

  const submit = async () => {
    const patch = {}
    if (form.waitMinutes !== '') patch.waitMinutes = Number(form.waitMinutes)
    if (form.trucksInLine !== '') patch.trucksInLine = Number(form.trucksInLine)
    if (form.capacityPct !== '') patch.capacityPct = Number(form.capacityPct)
    const ok = await onSave(patch)
    if (ok) setOpen(false)
  }

  return (
    <PortalCard
      id="wait"
      title="Wait Time & Capacity"
      info="Help drivers plan their trip with real-time updates."
      index={index}
      action={
        !canEdit ? null : (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setForm({ waitMinutes: wait ?? '', trucksInLine: trucks ?? '', capacityPct: capacity ?? '' }) }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Update Now</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Update wait &amp; capacity</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Estimated wait (min)</span>
                <Input type="number" value={form.waitMinutes} onChange={(e) => setForm((f) => ({ ...f, waitMinutes: e.target.value }))} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Trucks in line</span>
                <Input type="number" value={form.trucksInLine} onChange={(e) => setForm((f) => ({ ...f, trucksInLine: e.target.value }))} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Yard capacity (%)</span>
                <Input type="number" min="0" max="100" value={form.capacityPct} onChange={(e) => setForm((f) => ({ ...f, capacityPct: e.target.value }))} />
              </label>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Saving…' : 'Update'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )
      }
    >
      {canEdit && <p className="mb-4 text-sm text-neutral-500">Help drivers plan their trip with real-time updates.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Clock}
          label="Estimated Wait Time"
          value={wait != null ? wait : '—'}
          sub={wait != null ? 'min' : undefined}
          valueClass="text-green-600"
          freshness={freshness ? timeAgo(freshness) : undefined}
        />
        <StatTile
          icon={Truck}
          label="Trucks in Line"
          value={trucks != null ? trucks : '—'}
          sub={trucks != null ? 'trucks' : undefined}
          valueClass="text-green-600"
          freshness={freshness ? timeAgo(freshness) : undefined}
        />
        <StatTile
          icon={Scale}
          label="Scale Status"
          value={String(scale).toUpperCase()}
          valueClass={String(scale).toLowerCase().includes('clos') ? 'text-red-600' : 'text-green-600'}
          sub="Both Scales"
          freshness={freshness ? timeAgo(freshness) : undefined}
        />
        <StatTile
          icon={Gauge}
          label="Yard Capacity"
          value={cap.label}
          valueClass={cap.className}
          sub={capacity != null ? `${capacity}% Full` : undefined}
          freshness={freshness ? timeAgo(freshness) : undefined}
        />
      </div>
    </PortalCard>
  )
}
