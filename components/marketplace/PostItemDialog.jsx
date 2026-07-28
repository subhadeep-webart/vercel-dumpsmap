'use client'

import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Camera, ImagePlus, X, Loader2, MapPin, CircleDollarSign, Truck, Package, ChevronRight, ChevronLeft, Eye, Check } from 'lucide-react'
import CategoryPlaceholder from '@/components/marketplace/CategoryPlaceholder'
import { allowedStatusesForUser, STATUS_META, resolveMarketplaceRole } from '@/lib/marketplace-roles'

function normalizePhoto(url) {
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('/uploads/')) return `/api/files/${url.slice('/uploads/'.length)}`
  return url
}

function authHeaders() {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const PRICE_TYPES = [
  { value: 'free',     label: 'Free' },
  { value: 'fixed',    label: 'For Sale' },
  { value: 'obo',      label: 'Make Offer' },
  { value: 'trade',    label: 'Trade' },
  { value: 'donation', label: 'Donation' },
]

const ITEM_STATUSES = [
  { value: 'available',   label: 'Available' },
  { value: 'on_truck',    label: 'On Truck' },
  { value: 'at_site',     label: 'At Site' },
  { value: 'last_chance', label: 'Last Chance' },
]

const LEAVING_PRESETS = [
  { value: 0,   label: 'No timer' },
  { value: 15,  label: '15 min' },
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 hr' },
  { value: 120, label: '2 hr' },
  { value: 240, label: '4 hr' },
]

export default function PostItemDialog({ open, onClose, onCreated, categories = [], conditions = [], user = null }) {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  // Resolve role-aware status workflow for THIS seller.
  const { key: roleKey, label: roleLabel } = resolveMarketplaceRole(user)
  const roleStatusKeys = allowedStatusesForUser(user)
  const roleItemStatuses = roleStatusKeys.map((s) => ({ value: s, label: STATUS_META[s]?.label || s }))

  // Step 1
  const [photos, setPhotos] = useState([])           // [{ id, url }]
  const [uploading, setUploading] = useState(false)

  // Step 2
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState('good')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [dimensions, setDimensions] = useState('')
  const [segment, setSegment] = useState('residential')

  // Step 3
  const [priceType, setPriceType] = useState('free')
  const [price, setPrice] = useState('')
  const [acceptsOffers, setAcceptsOffers] = useState(false)
  const [donationPreferred, setDonationPreferred] = useState(false)

  // Step 4
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [coords, setCoords] = useState(null)
  const [pickupWindow, setPickupWindow] = useState('')
  const [itemStatus, setItemStatus] = useState('available')
  const [leavingInMinutes, setLeavingInMinutes] = useState(0)

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1); setPhotos([]); setTitle(''); setCategory(''); setCondition('good'); setDescription('')
      setQuantity(1); setDimensions(''); setSegment('residential')
      setPriceType('free'); setPrice(''); setAcceptsOffers(false); setDonationPreferred(false)
      setCity(''); setState(''); setZip(''); setCoords(null); setPickupWindow('')
      setItemStatus('available'); setLeavingInMinutes(0)
    }
  }, [open])

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return toast.error('Geolocation not supported')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`)
          const j = await r.json()
          if (j?.address) {
            setCity(j.address.city || j.address.town || j.address.village || j.address.county || '')
            setState(j.address.state_code || j.address.state || '')
            setZip(j.address.postcode || '')
          }
        } catch {}
        toast.success('Location set')
      },
      () => toast.error('Could not get location')
    )
  }

  const onPickPhotos = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (photos.length + files.length > 10) {
      toast.error('Max 10 photos')
      return
    }
    setUploading(true)
    try {
      // Backend accepts repeated "file" form fields (NOT "files"). Sending
      // them as "file" lets us upload up to 10 photos in a single request.
      const fd = new FormData()
      for (const f of files) fd.append('file', f)
      const r = await fetch('/api/upload', { method: 'POST', body: fd, headers: authHeaders() })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Upload failed')
      const next = (j.uploads || []).map((u) => ({ id: u.id, url: u.url }))
      if (next.length === 0) throw new Error('No image was accepted (check size/format)')
      setPhotos((p) => [...p, ...next])
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  const removePhoto = (id) => setPhotos((p) => p.filter((x) => x.id !== id))

  const canNext = () => {
    if (step === 1) return true // photos optional
    if (step === 2) return !!title && !!category
    if (step === 3) {
      if (priceType === 'fixed' || priceType === 'obo') return price !== '' && Number(price) >= 0
      return true
    }
    if (step === 4) return !!city
    return true
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      const body = {
        title, category, condition, description,
        quantity: Number(quantity) || 1, dimensions, segment,
        priceType,
        price: (priceType === 'fixed' || priceType === 'obo') ? Number(price) : 0,
        acceptsOffers,
        donationPreferred,
        photos: photos.map((p) => p.url),
        city, state, zip, pickupWindow,
        lat: coords?.lat, lng: coords?.lng,
        itemStatus,
        leavingInMinutes: Number(leavingInMinutes) || 0,
        kind: priceType === 'free' || priceType === 'donation' ? 'free' : priceType === 'trade' ? 'trade' : 'sell',
      }
      const r = await fetch('/api/marketplace', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      onCreated?.(j.listing)
    } catch (e) {
      toast.error(e.message || 'Failed to post')
    } finally {
      setSubmitting(false)
    }
  }

  const Steps = () => (
    <div className="mb-4 flex items-center justify-between text-xs">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="flex flex-1 items-center">
          <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${step >= n ? 'bg-brand-600 text-white' : 'bg-neutral-200 text-neutral-500'}`}>{step > n ? <Check className="h-4 w-4" /> : n}</div>
          {n < 5 && <div className={`h-0.5 flex-1 ${step > n ? 'bg-brand-600' : 'bg-neutral-200'}`} />}
        </div>
      ))}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Listing — Step {step} of 5</DialogTitle>
        </DialogHeader>
        <Steps />

        {step === 1 && (
          <div className="space-y-3">
            <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
              <ImagePlus className="mx-auto h-10 w-10 text-neutral-400" />
              <div className="mt-2 text-sm font-semibold">Tap to add photos</div>
              <div className="text-xs text-neutral-500">Up to 10 photos · jpg, png, webp</div>
              <div className="mt-3 flex justify-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  <ImagePlus className="h-4 w-4" /> Add photos
                  <input type="file" accept="image/*" multiple onChange={onPickPhotos} className="hidden" />
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:border-neutral-400">
                  <Camera className="h-4 w-4" /> Camera
                  <input type="file" accept="image/*" capture="environment" onChange={onPickPhotos} className="hidden" />
                </label>
              </div>
              {uploading && <div className="mt-3 inline-flex items-center gap-2 text-sm text-neutral-600"><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</div>}
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {photos.map((p) => (
                  <div key={p.id} className="relative">
                    <img src={normalizePhoto(p.url)} alt="" className="h-20 w-full rounded-md object-cover" />
                    <button onClick={() => removePhoto(p.id)} className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-neutral-900 text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <div className="grid h-20 place-items-center rounded-md border border-dashed border-neutral-300 text-xs text-neutral-400">{photos.length} / 10</div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Brown Leather Sofa" maxLength={120} />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Category">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  <option value="">Choose a category…</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Condition">
                <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  {conditions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Condition, brand, dimensions, what's included, where to pick up…" />
            </Field>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Quantity">
                <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </Field>
              <Field label="Dimensions (optional)">
                <Input value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder='86" W x 34" D x 32" H' />
              </Field>
              <Field label="Type">
                <select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                </select>
              </Field>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Field label="Price type">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {PRICE_TYPES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriceType(p.value)}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold ${priceType === p.value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>
            {(priceType === 'fixed' || priceType === 'obo') && (
              <Field label="Price (USD)">
                <div className="relative">
                  <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="pl-8" placeholder="0" />
                </div>
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={acceptsOffers} onChange={(e) => setAcceptsOffers(e.target.checked)} className="h-4 w-4 rounded text-brand-600" />
              Accept offers
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={donationPreferred} onChange={(e) => setDonationPreferred(e.target.checked)} className="h-4 w-4 rounded text-brand-600" />
              Nonprofits / donation pickup preferred
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <Field label="City *">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. San Jose" />
            </Field>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="State">
                <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="CA" />
              </Field>
              <Field label="ZIP (hidden until reserved)">
                <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="94016" />
              </Field>
              <Field label=" ">
                <Button type="button" variant="outline" onClick={useMyLocation} className="w-full">
                  <MapPin className="mr-2 h-4 w-4" /> Use current location
                </Button>
              </Field>
            </div>
            <p className="text-xs text-neutral-500">Exact address is <b>hidden</b> from public listings — only revealed after a buyer reserves the item or you message them directly.</p>
            <Field label="Pickup window">
              <Input value={pickupWindow} onChange={(e) => setPickupWindow(e.target.value)} placeholder="e.g. Available until 5:00 PM today" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={`Item status (${roleLabel})`}>
                <div className={`grid gap-2 ${roleItemStatuses.length <= 4 ? 'grid-cols-2 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                  {roleItemStatuses.map((s) => (
                    <button key={s.value} type="button" onClick={() => setItemStatus(s.value)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${itemStatus === s.value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-neutral-500">Statuses tailored for your account type.</p>
              </Field>
              <Field label="Leaving in… (optional)">
                <select value={leavingInMinutes} onChange={(e) => setLeavingInMinutes(Number(e.target.value))} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  {LEAVING_PRESETS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-neutral-500">Adds a "Leaving in X min" countdown to your listing.</p>
              </Field>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm font-bold uppercase tracking-wide text-neutral-500">Preview</div>
            <div className="grid gap-4 md:grid-cols-[140px_1fr]">
              <div className="h-32 w-32 overflow-hidden rounded-md bg-white">
                {photos[0] ? (
                  <img src={normalizePhoto(photos[0].url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <CategoryPlaceholder category={category} size="sm" />
                )}
              </div>
              <div className="space-y-1">
                <div className="text-base font-bold">{title || 'Untitled'}</div>
                <div className="text-xl font-extrabold text-brand-700">
                  {priceType === 'free' ? 'FREE' :
                   priceType === 'donation' ? 'DONATION' :
                   priceType === 'trade' ? 'TRADE' :
                   priceType === 'obo' ? (price ? `$${price} or Make Offer` : 'Make Offer') :
                   price ? `$${price}` : '—'}
                </div>
                <div className="text-xs text-neutral-500">{city || 'City not set'}{state ? `, ${state}` : ''}</div>
                <div className="flex flex-wrap gap-1 text-[10px] font-bold uppercase">
                  <span className="rounded bg-brand-600 px-2 py-0.5 text-white">{itemStatus.replace('_', ' ')}</span>
                  {Number(leavingInMinutes) > 0 && <span className="rounded bg-black/80 px-2 py-0.5 text-white">Leaving in {leavingInMinutes} min</span>}
                </div>
                <div className="line-clamp-3 text-sm text-neutral-700">{description || 'No description.'}</div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
            {step < 5 ? (
              <Button onClick={() => canNext() && setStep((s) => s + 1)} disabled={!canNext() || submitting} className="bg-brand-600 hover:bg-brand-700">
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting} className="bg-brand-600 hover:bg-brand-700">
                {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Eye className="mr-1 h-4 w-4" />} Publish Listing
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</div>
      {children}
    </div>
  )
}
