'use client'

// Post Commercial B2B Listing Dialog
// ---------------------------------------------------------------------------
// Two-step flow: (1) Category + basics, (2) Photos + details + post.
// Submits to POST /api/marketplace/commercial.
// Photo upload reuses the existing /api/upload pipeline (10 photo max).

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Loader2, ImagePlus, X, Building2, Truck, Wrench, Package, Boxes, Tag, ArrowRight, Camera } from 'lucide-react'
import { toast } from 'sonner'

const CATEGORY_DEFS = [
  { key: 'equipment',             label: 'Equipment',             icon: Wrench,    helper: 'Heavy machinery, tools, attachments, rentals' },
  { key: 'materials',             label: 'Materials',             icon: Package,   helper: 'Aggregates, lumber, metals, fill, salvage' },
  { key: 'vehicles',              label: 'Vehicles',              icon: Truck,     helper: 'Trucks, trailers, dumpsters, fleet, parts' },
  { key: 'commercial_inventory',  label: 'Commercial Inventory',  icon: Boxes,     helper: 'Office, retail, restaurant, hotel FF&E' },
  { key: 'services',              label: 'Services',              icon: Building2, helper: 'Demolition, hauling, recycling, B2B services' },
  { key: 'wholesale_liquidation', label: 'Wholesale / Liquidation', icon: Tag,    helper: 'Bulk lots, pallets, distressed inventory' },
]
const CONDITIONS = [
  { key: 'new',         label: 'New' },
  { key: 'refurbished', label: 'Refurbished' },
  { key: 'like_new',    label: 'Like new' },
  { key: 'good',        label: 'Good (used)' },
  { key: 'fair',        label: 'Fair' },
  { key: 'for_parts',   label: 'For parts' },
]
const SELLER_TYPES = [
  { key: 'contractor',       label: 'Contractor' },
  { key: 'vendor',           label: 'Vendor' },
  { key: 'facility_owner',   label: 'Facility Owner' },
  { key: 'property_manager', label: 'Property Manager' },
  { key: 'recycler',         label: 'Recycler' },
]

function normalizeUrl(url) {
  if (!url) return ''
  if (url.startsWith('/uploads/')) return `/api/files/${url.slice('/uploads/'.length)}`
  return url
}

export default function PostCommercialListingDialog({ open, onClose, onCreated }) {
  const [step, setStep] = useState(1)
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [priceType, setPriceType] = useState('fixed')
  const [quantity, setQuantity] = useState(1)
  const [condition, setCondition] = useState('good')
  const [sellerType, setSellerType] = useState('contractor')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [photos, setPhotos] = useState([])         // [{ id, url }]
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setStep(1); setCategory(''); setTitle(''); setDescription(''); setPrice(''); setPriceType('fixed')
    setQuantity(1); setCondition('good'); setSellerType('contractor')
    setCity(''); setState(''); setZip(''); setPhotos([])
  }

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (photos.length + files.length > 10) { toast.error('Max 10 photos'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      for (const f of files) fd.append('file', f)
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Upload failed')
      const next = (j.uploads || []).map((u) => ({ id: u.id, url: u.url }))
      setPhotos((prev) => [...prev, ...next])
    } catch (e) {
      toast.error(e?.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removePhoto = (id) => setPhotos((prev) => prev.filter((p) => p.id !== id))

  const canProceed1 = !!category && title.trim().length >= 3
  const canSubmit = canProceed1 && (priceType !== 'fixed' || (Number(price) > 0))

  const submit = async () => {
    if (!canSubmit) { toast.error('Please complete required fields'); return }
    setSubmitting(true)
    try {
      const payload = {
        category,
        title: title.trim(),
        description: description.trim(),
        price: priceType === 'contact' ? null : Number(price) || null,
        priceType,
        quantity: Math.max(1, Math.min(99999, Number(quantity) || 1)),
        condition,
        sellerType,
        city: city.trim(),
        state: state.trim().toUpperCase().slice(0, 2),
        zip: zip.trim(),
        photos: photos.map((p) => normalizeUrl(p.url)),
        acceptsOffers: priceType === 'obo',
      }
      const r = await fetch('/api/marketplace/commercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Failed to post listing'); return }
      reset()
      onCreated?.(j.listing)
    } catch (e) {
      toast.error('Network error: ' + (e?.message || 'unknown'))
    } finally { setSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose?.() } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" /> Post B2B Listing
          </DialogTitle>
          <DialogDescription>
            Visible to all DumpMaps users; offers, messages, and reservations come from verified commercial accounts.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-600">Category *</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORY_DEFS.map((c) => {
                  const Icon = c.icon
                  const active = category === c.key
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategory(c.key)}
                      className={`flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition ${active ? 'border-indigo-400 bg-indigo-50' : 'border-neutral-200 hover:bg-neutral-50'}`}
                    >
                      <Icon className={`h-5 w-5 ${active ? 'text-indigo-700' : 'text-indigo-600'}`} />
                      <div className="text-sm font-bold text-neutral-900">{c.label}</div>
                      <div className="text-[11px] text-neutral-600">{c.helper}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="pcl-title" className="text-xs font-bold uppercase tracking-wider text-neutral-600">Title *</Label>
              <Input id="pcl-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2018 CAT 308 Mini Excavator — 1850 hrs" maxLength={140} className="mt-1" />
              <div className="mt-0.5 text-right text-[10px] text-neutral-400">{title.length}/140</div>
            </div>

            <div>
              <Label htmlFor="pcl-desc" className="text-xs font-bold uppercase tracking-wider text-neutral-600">Description</Label>
              <Textarea id="pcl-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Spec sheet, condition notes, what's included, pickup terms…" rows={4} maxLength={4000} className="mt-1" />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => { reset(); onClose?.() }}>Cancel</Button>
              <Button type="button" onClick={() => setStep(2)} disabled={!canProceed1} className="bg-indigo-600 hover:bg-indigo-700">
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Photos */}
            <div>
              <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-600">Photos (up to 10)</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {photos.map((p) => (
                  <div key={p.id} className="relative aspect-square overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={normalizeUrl(p.url)} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removePhoto(p.id)} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 10 && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-neutral-300 bg-white text-xs font-bold text-neutral-500 hover:bg-neutral-50">
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 text-indigo-600" />}
                    {uploading ? 'Uploading…' : 'Add photos'}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} disabled={uploading} />
                  </label>
                )}
              </div>
            </div>

            {/* Pricing + qty + condition */}
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-neutral-600">Price type</Label>
                <select value={priceType} onChange={(e) => setPriceType(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm">
                  <option value="fixed">Fixed price</option>
                  <option value="obo">Or best offer</option>
                  <option value="contact">Contact for price</option>
                </select>
              </div>
              <div>
                <Label htmlFor="pcl-price" className="text-xs font-bold uppercase tracking-wider text-neutral-600">Price (USD)</Label>
                <Input id="pcl-price" type="number" inputMode="decimal" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} disabled={priceType === 'contact'} placeholder={priceType === 'contact' ? '—' : '0.00'} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="pcl-qty" className="text-xs font-bold uppercase tracking-wider text-neutral-600">Quantity</Label>
                <Input id="pcl-qty" type="number" inputMode="numeric" min={1} max={99999} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-neutral-600">Condition</Label>
                <select value={condition} onChange={(e) => setCondition(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm">
                  {CONDITIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-neutral-600">Seller type</Label>
                <select value={sellerType} onChange={(e) => setSellerType(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm">
                  {SELLER_TYPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Location */}
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
              <div>
                <Label htmlFor="pcl-city" className="text-xs font-bold uppercase tracking-wider text-neutral-600">City</Label>
                <Input id="pcl-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Jose" maxLength={80} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="pcl-state" className="text-xs font-bold uppercase tracking-wider text-neutral-600">State</Label>
                <Input id="pcl-state" value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="CA" maxLength={2} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="pcl-zip" className="text-xs font-bold uppercase tracking-wider text-neutral-600">Zip</Label>
                <Input id="pcl-zip" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="95110" maxLength={10} className="mt-1" />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={submitting}>Back</Button>
              <Button type="button" onClick={submit} disabled={!canSubmit || submitting} className="bg-indigo-600 hover:bg-indigo-700">
                {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1 h-4 w-4" />}
                Post B2B Listing
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
