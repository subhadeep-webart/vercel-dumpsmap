'use client'

// PricingCard — the Current Pricing grid: one tile per material rate ($/unit),
// each with a freshness line + green confirm check. "Add Material / Rate" and
// "Edit Pricing" open a single dialog that edits the materialPricing list; on
// save the portal hook PATCHes /facilities/:id/pricing and folds the fresh record
// back in (optimistic-feeling instant publish).

import { useState } from 'react'
import { Pencil, Plus, CheckCircle2, Trash2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import PortalCard from '../PortalCard'
import { money, pricingTiles, timestamp } from '../portal-helpers'

function RateTile({ material, rate, unit, updatedAt }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-emerald-200">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
        <Truck className="h-3.5 w-3.5 text-neutral-400" /> {material}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-extrabold tracking-tight text-neutral-900">{money(rate)}</span>
        <span className="text-xs font-medium text-neutral-400">/{unit}</span>
      </div>
      <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-neutral-400">
        Updated {timestamp(updatedAt)} <CheckCircle2 className="h-3 w-3 text-green-500" />
      </div>
    </div>
  )
}

function EditDialog({ tiles, saving, onSave, trigger }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(tiles.length ? tiles : [{ material: '', rate: '', unit: 'ton' }])

  const update = (i, key, val) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)))
  const addRow = () => setRows((r) => [...r, { material: '', rate: '', unit: 'ton' }])
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i))

  const submit = async () => {
    const materialPricing = rows
      .filter((r) => r.material.trim() && r.rate !== '' && r.rate != null)
      .map((r) => ({ material: r.material.trim(), price: Number(r.rate), unit: r.unit || 'ton' }))
    const ok = await onSave({ materialPricing })
    if (ok) setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setRows(tiles.length ? tiles : [{ material: '', rate: '', unit: 'ton' }]) }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit pricing</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Material"
                value={row.material}
                onChange={(e) => update(i, 'material', e.target.value)}
                className="flex-1"
              />
              <div className="relative w-28">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400">$</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={row.rate}
                  onChange={(e) => update(i, 'rate', e.target.value)}
                  className="pl-6"
                />
              </div>
              <Input
                placeholder="ton"
                value={row.unit}
                onChange={(e) => update(i, 'unit', e.target.value)}
                className="w-20"
              />
              <button type="button" onClick={() => removeRow(i)} className="text-neutral-400 hover:text-red-600" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={addRow} className="gap-1.5 text-emerald-700 hover:text-emerald-800">
            <Plus className="h-4 w-4" /> Add material / rate
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'Publishing…' : 'Publish changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// `canEdit` mirrors the server's authorization (only the verified owner or staff
// may PATCH /facilities/:id/pricing — see route.js). Read-only viewers get the
// rates without any write affordance.
export default function PricingCard({ facility, saving, onSave, index = 0, canEdit = true }) {
  const tiles = pricingTiles(facility)
  const updatedAt = facility?.pricing?.lastUpdated

  return (
    <PortalCard
      id="pricing"
      title="Current Pricing"
      info="Update your current rates. Changes publish instantly to drivers."
      index={index}
      action={
        canEdit ? (
          <EditDialog
            tiles={tiles}
            saving={saving}
            onSave={onSave}
            trigger={<Button variant="outline" size="sm" className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit Pricing</Button>}
          />
        ) : null
      }
    >
      {canEdit && <p className="mb-4 text-sm text-neutral-500">Update your current rates. Changes publish instantly.</p>}
      {tiles.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map((t, i) => <RateTile key={i} {...t} updatedAt={updatedAt} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
          No rates set yet.
        </div>
      )}
      {canEdit && (
        <EditDialog
          tiles={tiles}
          saving={saving}
          onSave={onSave}
          trigger={
            <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              <Plus className="h-4 w-4" /> Add Material / Rate
            </button>
          }
        />
      )}
    </PortalCard>
  )
}
