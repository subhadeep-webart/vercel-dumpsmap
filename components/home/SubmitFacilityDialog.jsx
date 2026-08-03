'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import PhotoUploader, { toUrlList } from '@/components/PhotoUploader'
import { isLikelyLoggedIn } from '@/lib/api-client'
import FacilityPreviewCard from '@/components/home/FacilityPreviewCard'
import { TypeIcon, StatusIcon } from '@/lib/facility-icons'
import {
  FACILITY_TYPE_CONFIG,
  FACILITY_TYPE_OPTIONS,
  PRICING_FIELDS,
  EXTRA_FIELDS,
  NOT_ACCEPTED_PRESETS,
  FACILITY_STATUS_OPTIONS,
  CONTRACTOR_NOTE_PRESETS,
  buildAutoTags,
} from '@/lib/facility-types'

// ---------- Submit Facility (DYNAMIC, type-driven) ----------
export default function SubmitFacilityDialog({ open, onOpenChange }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [accepted, setAccepted] = useState([])
  const [notAccepted, setNotAccepted] = useState([])
  const [customTags, setCustomTags] = useState([])
  const [photos, setPhotos] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [pricingUnknown, setPricingUnknown] = useState(false)
  const [verifyLater, setVerifyLater] = useState(false)
  // dynamic pricing + extras (per-type)
  const [pricingFields, setPricingFields] = useState({})
  const [extraFields, setExtraFields] = useState({})
  // NEW: current operational status (community-reported snapshot)
  const [currentStatus, setCurrentStatus] = useState('')
  // NEW: contractor notes (multi-select chips + free text)
  const [contractorNotes, setContractorNotes] = useState([])
  const [contractorNoteCustom, setContractorNoteCustom] = useState('')
  // legacy structured tags (kept for backend compatibility filtering)
  const [flags, setFlags] = useState({ freeDropOff: false, paidDisposal: false, donation: false, contractorFriendly: false })

  const config = type ? FACILITY_TYPE_CONFIG[type] : null
  const notAcceptedOptions = type ? (NOT_ACCEPTED_PRESETS[type] || []) : []

  // Live auto-generated tags
  const autoTags = config
    ? buildAutoTags({ typeKey: type, accepted, notAccepted, pricingFields, extraFields, currentStatus, contractorNotes })
    : []

  // When type changes, prefill defaults and reset incompatible fields
  useEffect(() => {
    if (!config) return
    setPricingFields({})
    setExtraFields({})
    setAccepted([])
    setNotAccepted([])
    setContractorNotes([])
    setCurrentStatus('')
    // auto-tick legacy flags so existing filter UI still works
    setFlags({
      freeDropOff: config.pricing.includes('free'),
      paidDisposal: config.pricing.includes('paidDisposal') || config.pricing.includes('paid') || config.pricing.includes('pricePerTon'),
      donation: ['donation', 'reuse'].includes(config.value),
      contractorFriendly: ['scrap_yard', 'transfer_station', 'construction'].includes(config.value),
    })
  }, [type])

  const toggleArr = (setter, list, v) =>
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const handlePricing = (k, v) => setPricingFields((p) => ({ ...p, [k]: v }))
  const handleExtra = (k, v) => setExtraFields((p) => ({ ...p, [k]: v }))

  const reset = () => {
    setName(''); setType(''); setAddress(''); setPhone(''); setWebsite('')
    setHours(''); setNotes(''); setAccepted([]); setNotAccepted([])
    setCustomTags([]); setPhotos([]); setPricingFields({}); setExtraFields({})
    setPricingUnknown(false); setVerifyLater(false)
    setCurrentStatus(''); setContractorNotes([]); setContractorNoteCustom('')
    setFlags({ freeDropOff: false, paidDisposal: false, donation: false, contractorFriendly: false })
  }

  const submit = async () => {
    if (!name || !address || !type) return toast.error('Please fill name, type, and address.')
    setSubmitting(true)
    try {
      const allTags = [...autoTags, ...customTags]
      const r = await fetch('/api/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, type: config?.label || type, typeKey: type,
          address, phone, website, hours, notes,
          accepted, notAccepted,
          currentStatus, contractorNotes,
          tags: allTags, flags,
          pricing: pricingUnknown ? 'Pricing unknown' : Object.entries(pricingFields).filter(([k, v]) => v).map(([k, v]) => `${k}:${typeof v === 'object' ? JSON.stringify(v) : v}`).join('; '),
          pricingFields, extraFields,
          pricingUnknown, verifyLater,
          photos: toUrlList(photos),
          lastUpdated: new Date().toISOString(),
          submittedAt: new Date().toISOString(),
          submittedBy: isLikelyLoggedIn() ? 'user' : 'anon',
          status: 'pending',
        }),
      })
      if (!r.ok) throw new Error('fail')
      toast.success('Thanks. This location has been submitted for admin review.')
      reset()
      onOpenChange(false)
    } catch {
      toast.error('Failed to submit. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit a Location</DialogTitle>
          <DialogDescription className="text-xs">
            Fields adapt to the facility type so haulers see only what's relevant. All submissions go to admin review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Facility name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ABC Recycling" />
            </div>
            <div>
              <Label>Facility type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {FACILITY_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="inline-flex items-center gap-2">
                        <TypeIcon typeKey={t.value} className="h-4 w-4" /> {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {config && <div className="mt-1 text-[11px] text-neutral-500">{config.helper}</div>}
            </div>
          </div>
          <div>
            <Label>Address *</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, San Jose, CA 95128" />
            <div className="mt-1 text-xs text-neutral-500">We'll auto-geocode this address on review.</div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Hours</Label>
              <Input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Mon–Sat 8a–5p" />
            </div>
          </div>

          {/* === DYNAMIC SECTION (revealed once type picked) === */}
          {!config && (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-xs text-neutral-500">
              Pick a facility type above to reveal accepted-materials, pricing, and tag fields tailored to that category.
            </div>
          )}

          {config && (
            <>
              {/* Accepted materials */}
              <div>
                <Label>Accepted materials</Label>
                <div className="mt-1 text-[11px] text-neutral-500">Tap to include — these become searchable tags.</div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {config.accepted.map((m) => (
                    <label key={m} className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 px-2 py-1.5 text-sm hover:bg-neutral-50">
                      <Checkbox checked={accepted.includes(m)} onCheckedChange={() => toggleArr(setAccepted, accepted, m)} />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Not accepted (type-specific common restrictions) */}
              <div>
                <Label>Not accepted (optional)</Label>
                <div className="mt-1 text-[11px] text-neutral-500">Critical for haulers — these auto-tag as &quot;no &lt;material&gt;&quot; so users can filter them out.</div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {notAcceptedOptions.map((m) => (
                    <label key={m} className="flex cursor-pointer items-center gap-2 rounded-md border border-red-200 bg-red-50/30 px-2 py-1.5 text-sm hover:bg-red-50">
                      <Checkbox checked={notAccepted.includes(m)} onCheckedChange={() => toggleArr(setNotAccepted, notAccepted, m)} />
                      <span className="text-red-900">{m}</span>
                    </label>
                  ))}
                </div>
                {/* Add custom not-accepted */}
                <Input
                  className="mt-2"
                  placeholder="Add another restriction and press Enter"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      e.preventDefault()
                      const v = e.currentTarget.value.trim()
                      if (!notAccepted.includes(v)) setNotAccepted((arr) => [...arr, v])
                      e.currentTarget.value = ''
                    }
                  }}
                />
              </div>

              {/* Current operational status */}
              <div className="rounded-lg border border-neutral-200 bg-white p-3">
                <Label className="text-sm font-bold">Current status (optional)</Label>
                <div className="mt-1 text-[11px] text-neutral-500">Tell other haulers what to expect right now — community-reported snapshot.</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {FACILITY_STATUS_OPTIONS.map((s) => {
                    const on = currentStatus === s.value
                    const colorMap = {
                      green: on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-neutral-600',
                      red:   on ? 'border-red-600 bg-red-50 text-red-800'       : 'border-neutral-200 bg-white text-neutral-600',
                      amber: on ? 'border-amber-600 bg-amber-50 text-amber-800' : 'border-neutral-200 bg-white text-neutral-600',
                      blue:  on ? 'border-blue-600 bg-blue-50 text-blue-800'    : 'border-neutral-200 bg-white text-neutral-600',
                    }
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setCurrentStatus(on ? '' : s.value)}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${colorMap[s.color]}`}
                      >
                        <StatusIcon status={s.value} className="h-3.5 w-3.5" /> {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Contractor notes */}
              <div className="rounded-lg border border-neutral-200 bg-white p-3">
                <Label className="text-sm font-bold">Contractor notes (optional)</Label>
                <div className="mt-1 text-[11px] text-neutral-500">Operational tips haulers should know before they roll up.</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CONTRACTOR_NOTE_PRESETS.map((n) => {
                    const on = contractorNotes.includes(n)
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleArr(setContractorNotes, contractorNotes, n)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-orange-600 bg-orange-50 text-orange-800' : 'border-neutral-200 bg-white text-neutral-600'}`}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
                <Input
                  className="mt-2"
                  value={contractorNoteCustom}
                  onChange={(e) => setContractorNoteCustom(e.target.value)}
                  placeholder="Add a custom note and press Enter (e.g. 'Strict 7a sharp')"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      e.preventDefault()
                      const v = e.currentTarget.value.trim()
                      if (!contractorNotes.includes(v)) setContractorNotes((arr) => [...arr, v])
                      setContractorNoteCustom('')
                    }
                  }}
                />
              </div>

              {/* Pricing */}
              <div className="rounded-lg border border-neutral-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Pricing</Label>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5">
                      <Checkbox checked={pricingUnknown} onCheckedChange={(v) => setPricingUnknown(!!v)} />
                      Pricing unknown
                    </label>
                    <label className="flex items-center gap-1.5">
                      <Checkbox checked={verifyLater} onCheckedChange={(v) => setVerifyLater(!!v)} />
                      Verify later
                    </label>
                  </div>
                </div>
                {!pricingUnknown && (
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {config.pricing.map((key) => {
                      const meta = PRICING_FIELDS[key]
                      if (!meta) return null
                      if (meta.kind === 'bool') {
                        return (
                          <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm">
                            <Checkbox checked={!!pricingFields[key]} onCheckedChange={(v) => handlePricing(key, !!v)} />
                            <span>{meta.label}</span>
                          </label>
                        )
                      }
                      if (meta.kind === 'multi') {
                        const selected = pricingFields[key] || []
                        return (
                          <div key={key} className="sm:col-span-2">
                            <Label className="text-xs">{meta.label}</Label>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {meta.options.map((opt) => {
                                const on = selected.includes(opt)
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handlePricing(key, on ? selected.filter((x) => x !== opt) : [...selected, opt])}
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-neutral-600'}`}
                                  >{opt}</button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      }
                      if (meta.kind === 'textarea') {
                        return (
                          <div key={key} className="sm:col-span-2">
                            <Label className="text-xs">{meta.label}</Label>
                            <Textarea rows={2} value={pricingFields[key] || ''} onChange={(e) => handlePricing(key, e.target.value)} placeholder={meta.placeholder} />
                          </div>
                        )
                      }
                      return (
                        <div key={key}>
                          <Label className="text-xs">{meta.label}</Label>
                          <Input value={pricingFields[key] || ''} onChange={(e) => handlePricing(key, e.target.value)} placeholder={meta.placeholder} />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Extra fields */}
              {config.extras && config.extras.length > 0 && (
                <div className="rounded-lg border border-neutral-200 bg-white p-3">
                  <Label className="text-sm font-bold">Type-specific details</Label>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {config.extras.map((key) => {
                      const meta = EXTRA_FIELDS[key]
                      if (!meta) return null
                      if (meta.kind === 'bool') {
                        return (
                          <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm">
                            <Checkbox checked={!!extraFields[key]} onCheckedChange={(v) => handleExtra(key, !!v)} />
                            <span>{meta.label}</span>
                          </label>
                        )
                      }
                      return (
                        <div key={key} className="sm:col-span-2">
                          <Label className="text-xs">{meta.label}</Label>
                          <Textarea rows={2} value={extraFields[key] || ''} onChange={(e) => handleExtra(key, e.target.value)} placeholder={meta.placeholder} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Auto-generated + custom tags */}
              <div>
                <Label className="text-sm">Auto-generated tags <span className="font-normal text-neutral-500">(searchable)</span></Label>
                <div className="mt-1 text-[11px] text-neutral-500">These update live based on type, materials, pricing, status, and notes above.</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {autoTags.length === 0 && (
                    <span className="text-[11px] italic text-neutral-400">No tags yet — fill the fields above.</span>
                  )}
                  {autoTags.map((t) => (
                    <span key={t} className="rounded-full border border-brand-600 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-2">
                  <Input
                    placeholder="Add a custom tag and press Enter"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        e.preventDefault()
                        const v = e.currentTarget.value.trim()
                        if (!customTags.includes(v)) setCustomTags((arr) => [...arr, v])
                        e.currentTarget.value = ''
                      }
                    }}
                  />
                  {customTags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {customTags.map((t) => (
                        <button
                          key={t}
                          onClick={() => setCustomTags((arr) => arr.filter((x) => x !== t))}
                          className="rounded-full border border-neutral-300 bg-white px-2.5 py-0.5 text-xs"
                        >{t} ×</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* === LIVE PREVIEW CARD === */}
          {config && (
            <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-brand-800">
                Live preview · how your listing will look
              </div>
              <FacilityPreviewCard
                facility={{
                  name: name || 'Your facility name',
                  type: config.label,
                  typeKey: type,
                  address: address || 'Address pending review',
                  hours,
                  accepted, notAccepted,
                  pricingFields, extraFields,
                  currentStatus, contractorNotes,
                  tags: [...autoTags, ...customTags],
                  status: 'pending',
                }}
              />
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gate codes, attendant tips, restrictions, signage…" rows={2} />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-3">
            <PhotoUploader value={photos} onChange={setPhotos} max={6} label="Facility photos" hint="Signs, entrance, bins — up to 6 photos" />
          </div>
          <div className="text-[11px] text-neutral-500">
            Submitted: {new Date().toLocaleDateString()} · Status: <span className="font-semibold text-amber-700">Pending admin review</span>
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full bg-brand-600 hover:bg-brand-700">
            {submitting ? 'Submitting…' : 'Submit for review'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
