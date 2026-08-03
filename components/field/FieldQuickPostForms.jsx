'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import PhotoUploader from '@/components/PhotoUploader'
import { AlertTriangle, Briefcase, Gift, ShoppingBag, Recycle, Megaphone, ArrowLeft, Loader2, Camera, MapPin } from 'lucide-react'

/* -------------------------------------------------------------------------- */
/* Option chooser (step 1)                                                    */
/* -------------------------------------------------------------------------- */

const OPTIONS = [
  { key: 'hotspot',     icon: AlertTriangle, accent: 'from-rose-500 to-red-600',          title: 'Report Hot Spot',     blurb: 'Illegal dumping or trash pile' },
  { key: 'job',         icon: Briefcase,     accent: 'from-amber-500 to-orange-600',      title: 'Post Job / Pickup',   blurb: 'Hire a hauler or contractor' },
  { key: 'free',        icon: Gift,          accent: 'from-sky-500 to-blue-600',          title: 'Post Free Item',      blurb: 'Curb alert or giveaway' },
  { key: 'marketplace', icon: ShoppingBag,   accent: 'from-blue-500 to-indigo-600',       title: 'Marketplace Listing', blurb: 'Sell something usable' },
  { key: 'facility',    icon: Recycle,       accent: 'from-cyan-500 to-blue-600',         title: 'Facility Alert',      blurb: 'Closure, fees, hours, status' },
  { key: 'community',   icon: Megaphone,     accent: 'from-slate-600 to-slate-800',       title: 'Community Update',    blurb: 'News for your neighbors' },
]

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

async function tryGeolocation() {
  if (typeof window === 'undefined' || !navigator?.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    )
  })
}

const urlsOf = (photos) => (photos || []).map((p) => (typeof p === 'string' ? p : p?.url)).filter(Boolean)

const FieldSheet = ({ open, onOpenChange, children, title, onBack }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    {/* Full-height bottom sheet on mobile, smaller modal on tablet+ */}
    <DialogContent className="flex max-h-[95vh] w-screen max-w-md flex-col gap-0 overflow-hidden rounded-t-2xl p-0 sm:rounded-2xl">
      <DialogHeader className="flex flex-row items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2.5">
        {onBack && (
          <button onClick={onBack} aria-label="Back" className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <DialogTitle className="text-base font-extrabold tracking-tight">{title}</DialogTitle>
      </DialogHeader>
      {children}
    </DialogContent>
  </Dialog>
)

/* -------------------------------------------------------------------------- */
/* Step 1 — Picker                                                            */
/* -------------------------------------------------------------------------- */

function QuickPickGrid({ onPick, onClose }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 p-3">
        {OPTIONS.map((o) => {
          const Icon = o.icon
          return (
            <button
              key={o.key}
              onClick={() => onPick(o.key)}
              className="flex min-h-[110px] flex-col items-start gap-1 rounded-xl border border-neutral-200 bg-white p-3 text-left transition active:scale-[0.97] hover:border-neutral-300 hover:shadow-sm"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${o.accent} text-white shadow`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-[13px] font-bold leading-tight text-neutral-900">{o.title}</div>
              <div className="text-[10px] leading-tight text-neutral-500">{o.blurb}</div>
            </button>
          )
        })}
      </div>
      <p className="px-4 pb-4 text-center text-[10px] text-neutral-400">3 taps or less from anywhere. Visible to neighbors and pros near you.</p>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Shared body wrapper with sticky submit                                     */
/* -------------------------------------------------------------------------- */

function FormBody({ children, sticky }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">{children}</div>
      </div>
      <div className="flex-none border-t border-neutral-200 bg-white px-3 py-2.5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.625rem)' }}>
        {sticky}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* HOT SPOT — Photo → Location → Description → Post                          */
/* -------------------------------------------------------------------------- */

function HotSpotForm({ onDone, onBack, user }) {
  const [photos, setPhotos] = useState([])
  const [body, setBody] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [coords, setCoords] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { tryGeolocation().then((c) => c && setCoords(c)) }, [])

  const submit = async () => {
    if (!body.trim() && photos.length === 0) { toast.error('Add a photo or short description'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Hot spot reported',
          category: 'illegal_dumping',
          body: body.trim() || 'Reported via Field Mode',
          photos: urlsOf(photos),
          city, zip,
          lat: coords?.lat ?? null, lng: coords?.lng ?? null,
          urgency: 'high',
        }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Could not post')
      toast.success('Hot spot reported — neighbors will be notified')
      onDone?.()
    } catch (e) { toast.error(e.message || 'Could not post') } finally { setBusy(false) }
  }

  return (
    <FormBody
      sticky={
        <Button onClick={submit} disabled={busy || (!body.trim() && photos.length === 0)} className="h-12 w-full bg-brand-600 text-base font-bold text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {busy ? 'Posting…' : 'Report Hot Spot'}
        </Button>
      }
    >
      <PhotoUploader value={photos} onChange={setPhotos} max={4} label="Add a photo (best)" />
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-neutral-700">Where is it?</Label>
        <div className="flex gap-2">
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="h-11" />
          <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP" className="h-11 w-24" inputMode="numeric" />
        </div>
        {coords && <p className="inline-flex items-center gap-1 text-[11px] text-neutral-500"><MapPin className="h-3.5 w-3.5" /> Using your current location ({coords.lat.toFixed(3)}, {coords.lng.toFixed(3)})</p>}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-neutral-700">What did you see?</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Big pile of mattresses on the curb…" />
      </div>
      <p className="text-[10px] text-neutral-400">Reports go to the community feed and city moderators when applicable.</p>
    </FormBody>
  )
}

/* -------------------------------------------------------------------------- */
/* JOB — Photo → Description → Budget → Post                                  */
/* -------------------------------------------------------------------------- */

function JobForm({ onDone, onBack, user }) {
  const [photos, setPhotos] = useState([])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [budget, setBudget] = useState('')
  const [urgency, setUrgency] = useState('flexible')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!title.trim()) { toast.error('Add a short title (e.g. "Sofa pickup")'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category: 'junk_removal',
          description: desc.trim(),
          photos: urlsOf(photos),
          city, zip,
          urgency,
          fixedPriceOffer: budget ? Number(budget) : null,
        }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Could not post job')
      toast.success('Job posted — nearby haulers will see it shortly')
      onDone?.()
    } catch (e) { toast.error(e.message || 'Could not post job') } finally { setBusy(false) }
  }

  return (
    <FormBody
      sticky={
        <Button onClick={submit} disabled={busy || !title.trim()} className="h-12 w-full bg-brand-600 text-base font-bold text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {busy ? 'Posting…' : 'Post Job'}
        </Button>
      }
    >
      <PhotoUploader value={photos} onChange={setPhotos} max={6} label="Photo of the load" />
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-neutral-700">What needs picking up?</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='e.g. "Sofa &amp; mattress"' className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-neutral-700">Details (optional)</Label>
        <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Side yard access, 1 flight of stairs…" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Budget ($)</Label>
          <Input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="50" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">When</Label>
          <Select value={urgency} onValueChange={setUrgency}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="flexible">Flexible</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="asap">ASAP</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="h-11" />
        <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP" className="h-11 w-24" inputMode="numeric" />
      </div>
      <p className="text-[10px] text-neutral-400">Payments are not active yet — coordinate directly with the hauler.</p>
    </FormBody>
  )
}

/* -------------------------------------------------------------------------- */
/* FREE ITEM — Photo → Title → Where → Post                                   */
/* -------------------------------------------------------------------------- */

function FreeItemForm({ onDone, onBack }) {
  return <MarketplaceForm onDone={onDone} onBack={onBack} kind="free" />
}

/* -------------------------------------------------------------------------- */
/* MARKETPLACE — Photo → Title → Price → Post                                 */
/* -------------------------------------------------------------------------- */

function MarketplaceForm({ onDone, onBack, kind = 'sell' }) {
  const [photos, setPhotos] = useState([])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState(kind === 'free' ? '0' : '')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [busy, setBusy] = useState(false)

  const isFree = kind === 'free'

  const submit = async () => {
    if (!title.trim()) { toast.error('Add a title (e.g. "Free pallets")'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category: 'other',
          kind: isFree ? 'free' : 'sell',
          description: desc.trim(),
          photos: urlsOf(photos),
          price: isFree ? 0 : (price ? Number(price) : null),
          priceType: isFree ? 'free' : 'fixed',
          city, zip,
        }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Could not post')
      toast.success(isFree ? 'Free listing posted' : 'Listing posted')
      onDone?.()
    } catch (e) { toast.error(e.message || 'Could not post') } finally { setBusy(false) }
  }

  return (
    <FormBody
      sticky={
        <Button onClick={submit} disabled={busy || !title.trim()} className="h-12 w-full bg-brand-600 text-base font-bold text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {busy ? 'Posting…' : (isFree ? 'Post Free Item' : 'Post Listing')}
        </Button>
      }
    >
      <PhotoUploader value={photos} onChange={setPhotos} max={8} label={isFree ? 'Photo of the item' : 'Item photos'} />
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-neutral-700">What is it?</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isFree ? 'e.g. "Free pallets — curb alert"' : 'e.g. "Mini fridge — works great"'} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-neutral-700">Details (optional)</Label>
        <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Condition, pick-up window, where on the curb…" />
      </div>
      {!isFree && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Price ($)</Label>
          <Input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="75" className="h-11" />
        </div>
      )}
      <div className="flex gap-2">
        <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="h-11" />
        <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP" className="h-11 w-24" inputMode="numeric" />
      </div>
    </FormBody>
  )
}

/* -------------------------------------------------------------------------- */
/* FACILITY ALERT — Facility → Alert Type → Post                              */
/* -------------------------------------------------------------------------- */

function FacilityAlertForm({ onDone, onBack }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [chosen, setChosen] = useState(null)
  const [alertType, setAlertType] = useState('')
  const [text, setText] = useState('')
  const [types, setTypes] = useState([])
  const [busy, setBusy] = useState(false)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    fetch('/api/alerts/types').then((r) => r.ok ? r.json() : { types: [] }).then((j) => setTypes(j.types || []))
  }, [])

  useEffect(() => {
    if (chosen) return
    if (!q.trim()) { setResults([]); return }
    let alive = true
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/facilities?q=${encodeURIComponent(q)}&limit=15`)
        const j = r.ok ? await r.json() : { facilities: [] }
        if (alive) setResults(j.facilities || [])
      } finally { if (alive) setSearching(false) }
    }, 280)
    return () => { alive = false; clearTimeout(t) }
  }, [q, chosen])

  const submit = async () => {
    if (!chosen || !alertType) { toast.error('Pick a facility and an alert type'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId: chosen.id, type: alertType, text }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Could not post alert')
      toast.success('Facility alert posted')
      onDone?.()
    } catch (e) { toast.error(e.message || 'Could not post alert') } finally { setBusy(false) }
  }

  return (
    <FormBody
      sticky={
        <Button onClick={submit} disabled={busy || !chosen || !alertType} className="h-12 w-full bg-brand-600 text-base font-bold text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {busy ? 'Posting…' : 'Post Facility Alert'}
        </Button>
      }
    >
      {!chosen ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-neutral-700">Which facility?</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or city" className="h-11" />
          </div>
          <div className="space-y-1.5">
            {searching && <p className="text-[11px] text-neutral-400">Searching…</p>}
            {!searching && q && results.length === 0 && <p className="text-[11px] text-neutral-500">No facilities match “{q}”.</p>}
            {results.map((f) => (
              <button key={f.id} onClick={() => setChosen(f)} className="flex w-full items-start gap-2 rounded-lg border border-neutral-200 bg-white p-2.5 text-left hover:border-brand-400">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-xs font-bold text-brand-700">{(f.name || '?')[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{f.name}</div>
                  <div className="truncate text-[11px] text-neutral-500">{[f.type, f.city, f.state].filter(Boolean).join(' · ')}</div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-neutral-400">Facility details may change. Call ahead before arrival.</p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 p-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-brand-900">{chosen.name}</div>
              <div className="truncate text-[11px] text-brand-700">{[chosen.type, chosen.city, chosen.state].filter(Boolean).join(' · ')}</div>
            </div>
            <button onClick={() => setChosen(null)} className="text-[11px] font-semibold text-brand-700 underline">Change</button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-neutral-700">Alert type</Label>
            <Select value={alertType} onValueChange={setAlertType}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                {(types.length ? types : [
                  { key: 'WAIT_TIME', label: 'Wait time' },
                  { key: 'LONG_LINE', label: 'Long line' },
                  { key: 'FAST_MOVING', label: 'Fast moving' },
                  { key: 'CLOSED', label: 'Facility closed' },
                ]).map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label || t.key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-neutral-700">Notes (optional)</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="~30 min wait, scale tech on lunch…" />
          </div>
        </>
      )}
    </FormBody>
  )
}

/* -------------------------------------------------------------------------- */
/* COMMUNITY UPDATE — Title → Body → Post                                     */
/* -------------------------------------------------------------------------- */

function CommunityForm({ onDone, onBack }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!title.trim()) { toast.error('Add a short title'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), category: 'general', body: body.trim(), photos: urlsOf(photos) }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Could not post')
      toast.success('Posted to your community feed')
      onDone?.()
    } catch (e) { toast.error(e.message || 'Could not post') } finally { setBusy(false) }
  }
  return (
    <FormBody
      sticky={
        <Button onClick={submit} disabled={busy || !title.trim()} className="h-12 w-full bg-brand-600 text-base font-bold text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {busy ? 'Posting…' : 'Post Update'}
        </Button>
      }
    >
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-neutral-700">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's the headline?" className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-neutral-700">Details</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Share with your neighbors…" />
      </div>
      <PhotoUploader value={photos} onChange={setPhotos} max={4} label="Photos (optional)" />
    </FormBody>
  )
}

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

export default function FieldQuickPostForms({ open, onOpenChange, initialKey = null, user, onRequireLogin, onPosted }) {
  const [stage, setStage] = useState(initialKey || 'pick')

  useEffect(() => { if (open) setStage(initialKey || 'pick') }, [open, initialKey])

  const handlePick = (key) => {
    if (!user) { onRequireLogin?.(); onOpenChange?.(false); return }
    setStage(key)
  }
  const done = () => { onPosted?.(); onOpenChange?.(false) }

  const title = useMemo(() => {
    if (stage === 'pick') return 'Quick Post'
    const o = OPTIONS.find((x) => x.key === stage)
    return o ? o.title : 'Quick Post'
  }, [stage])

  return (
    <FieldSheet
      open={open}
      onOpenChange={(v) => { if (!v) onOpenChange?.(false) }}
      title={title}
      onBack={stage === 'pick' ? null : () => setStage('pick')}
    >
      {stage === 'pick' && <QuickPickGrid onPick={handlePick} onClose={() => onOpenChange?.(false)} />}
      {stage === 'hotspot' && <HotSpotForm onDone={done} user={user} />}
      {stage === 'job' && <JobForm onDone={done} user={user} />}
      {stage === 'free' && <FreeItemForm onDone={done} />}
      {stage === 'marketplace' && <MarketplaceForm onDone={done} />}
      {stage === 'facility' && <FacilityAlertForm onDone={done} />}
      {stage === 'community' && <CommunityForm onDone={done} />}
    </FieldSheet>
  )
}
