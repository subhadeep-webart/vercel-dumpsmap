'use client'

// Bottom filter sheet for the facilities directory: type, material, distance,
// and the verified/has-alerts toggles, plus Reset + "Show N results".
//
// Extracted from HomeShell.jsx. Controlled entirely by the parent FacilitiesTab
// via props; holds no state of its own.

import { Filter as FilterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export default function FacilitiesFilterSheet({
  open,
  onOpenChange,
  facilityTypes,
  materials,
  typeFilter,
  onTypeFilterChange,
  materialFilter,
  onMaterialFilterChange,
  maxKm,
  onMaxKmChange,
  verifiedOnly,
  onVerifiedOnlyChange,
  hasAlertsOnly,
  onHasAlertsOnlyChange,
  resultCount,
  onReset,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2"><FilterIcon className="h-4 w-4 text-brand-600" /> Filters</SheetTitle>
          <SheetDescription className="text-xs">Refine by type, material, distance, and tags.</SheetDescription>
        </SheetHeader>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {facilityTypes.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Material</Label>
              <Select value={materialFilter} onValueChange={onMaterialFilterChange}>
                <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All materials</SelectItem>
                  {materials.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Distance</Label>
            <Select value={maxKm} onValueChange={onMaxKmChange}>
              <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any distance</SelectItem>
                <SelectItem value="5">Within 5 km</SelectItem>
                <SelectItem value="10">Within 10 km</SelectItem>
                <SelectItem value="25">Within 25 km</SelectItem>
                <SelectItem value="50">Within 50 km</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 px-3 py-2.5 text-sm active:bg-neutral-50">
              <Checkbox checked={verifiedOnly} onCheckedChange={(v) => onVerifiedOnlyChange(!!v)} />
              <span>Verified only</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 px-3 py-2.5 text-sm active:bg-neutral-50">
              <Checkbox checked={hasAlertsOnly} onCheckedChange={(v) => onHasAlertsOnlyChange(!!v)} />
              <span>🔥 Has live alerts</span>
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="h-11 flex-1" onClick={onReset}>Reset</Button>
            <Button className="h-11 flex-1 bg-brand-600 hover:bg-brand-700" onClick={() => onOpenChange(false)}>
              Show {resultCount} results
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
