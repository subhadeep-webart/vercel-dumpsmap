'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  MapPin, Star, Navigation, BadgeCheck, Heart, Phone, Globe, Clock, Activity,
} from 'lucide-react'
import { FacilityAlertSection } from '@/components/AlertSystem'
import { PricingSection, PaymentInterestDialog } from '@/components/Pricing'
import { ScaleWorkflowDialog } from '@/components/ScaleWorkflow'
import { TYPE_COLORS, MATERIALS } from '@/components/home/home-facility-meta'

export default function FacilityDetail({ open, onOpenChange, facilityId, onClose, onReport, user, favoriteIds, toggleFavorite, refreshFacilities }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('info')
  const [rating, setRating] = useState('5')
  const [text, setText] = useState('')
  const [material, setMaterial] = useState('')
  const [payInterestOpen, setPayInterestOpen] = useState(false)
  const [scaleOpen, setScaleOpen] = useState(false)

  const fetchData = () => {
    if (!facilityId) return
    setLoading(true)
    return fetch(`/api/facilities/${facilityId}`)
      .then((r) => r.json())
      .then((j) => {
        setData(j)
        setLoading(false)
      })
  }

  useEffect(() => {
    if (!open || !facilityId) return
    fetchData()
  }, [open, facilityId])

  const submitReview = async () => {
    const r = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, rating, text, material }),
    })
    if (r.ok) {
      toast.success('Review posted')
      setText('')
      setMaterial('')
      fetchData()
    }
  }

  const reportFlag = async () => {
    const reason = prompt('Why are you reporting this facility?')
    if (!reason) return
    await fetch('/api/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, reason }),
    })
    toast.success('Reported. Thanks!')
  }

  const f = data?.facility
  const reviews = data?.reviews || []
  const alerts = data?.alerts || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
        {loading || !f ? (
          <div className="p-8 text-center text-sm text-neutral-500">Loading…</div>
        ) : (
          <>
            <div className="relative h-48 w-full overflow-hidden bg-neutral-100">
              {f.images?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.images[0]} alt={f.name} className="h-full w-full object-cover" />
              )}
              <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                <Badge className={TYPE_COLORS[f.type] || 'bg-neutral-200'}>{f.type}</Badge>
                {f.verified ? (
                  <Badge className="bg-brand-600 text-white">
                    <BadgeCheck className="mr-1 h-3 w-3" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-white/90">User submitted</Badge>
                )}
              </div>
            </div>
            <div className="p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl">{f.name}</DialogTitle>
              </DialogHeader>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {f.rating?.toFixed?.(1) || '—'} · {f.reviewsCount || 0} reviews
                </span>
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {f.address}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button className="bg-brand-600 hover:bg-brand-700">
                    <Navigation className="mr-1 h-4 w-4" /> Directions
                  </Button>
                </a>
                <Button onClick={() => onReport?.(f)} className="bg-orange-600 hover:bg-orange-700">
                  <Activity className="mr-1 h-4 w-4" /> Report status
                </Button>
                <Button
                  onClick={() => toggleFavorite?.(f.id)}
                  variant={favoriteIds?.includes(f.id) ? 'default' : 'outline'}
                  className={favoriteIds?.includes(f.id) ? 'bg-rose-500 hover:bg-rose-600' : ''}
                >
                  <Heart className={`mr-1 h-4 w-4 ${favoriteIds?.includes(f.id) ? 'fill-white' : ''}`} />
                  {favoriteIds?.includes(f.id) ? 'Saved' : 'Save'}
                </Button>
                {f.phone && (
                  <a href={`tel:${f.phone}`}>
                    <Button variant="outline">
                      <Phone className="mr-1 h-4 w-4" /> {f.phone}
                    </Button>
                  </a>
                )}
                {f.website && (
                  <a href={f.website} target="_blank" rel="noreferrer">
                    <Button variant="outline">
                      <Globe className="mr-1 h-4 w-4" /> Website
                    </Button>
                  </a>
                )}
                <Button variant="ghost" onClick={reportFlag}>
                  Flag
                </Button>
              </div>

              {/* Live alerts section — TOP priority for haulers */}
              <div className="mt-4">
                <FacilityAlertSection
                  facilityId={f.id}
                  alerts={alerts}
                  onRefresh={() => { fetchData(); refreshFacilities?.() }}
                  onReport={() => onReport?.(f)}
                />
              </div>

              {/* Owner panel — Phase 2 */}
              {user && (
                <button
                  onClick={() => {
                    // Phase 2 teaser - dispatch through window event so we don't have to wire props
                    window.dispatchEvent(new CustomEvent('dm:teaser', { detail: 'owner_claim' }))
                  }}
                  className="mt-3 w-full rounded-md border-2 border-dashed border-purple-300 bg-white px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50"
                >
                  🏢 Manage this facility? · Claim listing
                  <Badge className="ml-2 bg-sky-100 text-sky-900 hover:bg-sky-100">Coming in Phase 2</Badge>
                </button>
              )}

              <Tabs value={tab} onValueChange={setTab} className="mt-6">
                <TabsList>
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="materials">Materials</TabsTrigger>
                  <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="info" className="space-y-3 pt-4 text-sm">
                  {f.hours && (
                    <div className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 text-neutral-500" /> <span>{f.hours}</span></div>
                  )}
                  {f.pricing && (
                    <PricingSection
                      facility={f}
                      onReportPrice={() => onReport?.(f)}
                      onOpenPaymentInterest={() => setPayInterestOpen(true)}
                      onOpenScaleWorkflow={() => setScaleOpen(true)}
                    />
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {f.flags?.freeDropOff && <Badge className="bg-brand-100 text-brand-800">Free drop-off</Badge>}
                    {f.flags?.paidDisposal && <Badge className="bg-amber-100 text-amber-800">Paid disposal</Badge>}
                    {f.flags?.donation && <Badge className="bg-sky-100 text-sky-800">Donation accepted</Badge>}
                    {f.flags?.contractorFriendly && <Badge className="bg-neutral-200 text-neutral-800">Contractor-friendly</Badge>}
                  </div>
                </TabsContent>
                <TabsContent value="materials" className="space-y-3 pt-4 text-sm">
                  <div>
                    <div className="mb-2 font-semibold">Accepted</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(f.accepted || []).map((m) => (
                        <Badge key={m} variant="outline" className="border-brand-200 bg-brand-50 text-brand-800">
                          {m}
                        </Badge>
                      ))}
                      {(!f.accepted || !f.accepted.length) && <span className="text-neutral-500">No data yet.</span>}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <div className="mb-2 font-semibold">Restricted</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(f.restricted || []).map((m) => (
                        <Badge key={m} variant="outline" className="border-red-200 bg-red-50 text-red-700">
                          {m}
                        </Badge>
                      ))}
                      {(!f.restricted || !f.restricted.length) && <span className="text-neutral-500">No restrictions listed.</span>}
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="reviews" className="space-y-3 pt-4 text-sm">
                  <Card className="bg-neutral-50">
                    <CardContent className="space-y-2 pt-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Rating</Label>
                          <Select value={rating} onValueChange={setRating}>
                            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[5, 4, 3, 2, 1].map((n) => (
                                <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Material dumped</Label>
                          <Select value={material} onValueChange={setMaterial}>
                            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Optional" /></SelectTrigger>
                            <SelectContent>
                              {MATERIALS.map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Share your experience…" />
                      <Button onClick={submitReview} className="bg-brand-600 hover:bg-brand-700">Post review</Button>
                    </CardContent>
                  </Card>
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-lg border border-neutral-200 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{r.authorName}</div>
                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: r.rating }).map((_, i) => (
                            <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>
                      {r.material && <div className="text-xs text-neutral-500">Material: {r.material}</div>}
                      <div className="mt-1 text-neutral-700">{r.text}</div>
                    </div>
                  ))}
                  {!reviews.length && <div className="text-neutral-500">No reviews yet. Be the first!</div>}
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
        <PaymentInterestDialog open={payInterestOpen} onOpenChange={setPayInterestOpen} facilityName={data?.facility?.name || ''} />
        <ScaleWorkflowDialog open={scaleOpen} onOpenChange={setScaleOpen} facility={data?.facility} />
      </DialogContent>
    </Dialog>
  )
}
