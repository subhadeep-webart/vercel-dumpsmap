'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Briefcase,
  Flame,
  MapPin,
  Plus,
  Search,
  Filter as FilterIcon,
  CheckCircle2,
  Clock,
  Truck,
  Sparkles,
  Shield,
  AlertTriangle,
  Send,
  Heart,
  Navigation,
  X,
  ChevronRight,
  Camera,
  Image as ImageIcon,
  Lock,
  Building2,
  Home,
  Hammer,
  Package,
  Trash2,
  Recycle as RecycleIcon,
  Wrench,
  CreditCard,
  Star,
  Hand,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import PhotoUploader, { toUrlList } from '@/components/PhotoUploader'
import ReportButton from '@/components/ReportButton'
import StartDmButton from '@/components/messaging/StartDmButton'
import ContractorReviewDialog from '@/components/recommendations/ContractorReviewDialog'

// ---------- Constants ----------
export const JOB_CATEGORIES = [
  { value: 'junk_removal', label: 'Junk removal', icon: Trash2 },
  { value: 'furniture_removal', label: 'Furniture removal', icon: Package },
  { value: 'appliance_pickup', label: 'Appliance pickup', icon: Package },
  { value: 'ewaste_pickup', label: 'E-waste pickup', icon: Package },
  { value: 'donation_pickup', label: 'Donation pickup', icon: Heart },
  { value: 'construction_debris', label: 'Construction debris', icon: Hammer },
  { value: 'commercial_cleanout', label: 'Commercial cleanout', icon: Building2 },
  { value: 'apartment_trashout', label: 'Apartment trash-out', icon: Home },
  { value: 'garage_cleanout', label: 'Garage cleanout', icon: Home },
  { value: 'storage_cleanout', label: 'Storage unit cleanout', icon: Package },
  { value: 'moving_help', label: 'Moving help', icon: Truck },
  { value: 'pallet_pickup', label: 'Pallet pickup', icon: Package },
  { value: 'scrap_metal', label: 'Scrap metal pickup', icon: Wrench },
  { value: 'emergency_cleanup', label: 'Emergency cleanup', icon: AlertTriangle },
  { value: 'same_day', label: 'Same-day pickup', icon: Flame },
  { value: 'recurring', label: 'Recurring pickup', icon: RecycleIcon },
]

export const URGENCIES = [
  { value: 'flexible', label: 'Flexible', color: 'bg-neutral-100 text-neutral-700 border-neutral-200' },
  { value: 'today', label: 'Today', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'asap', label: 'ASAP · Hot Spot', color: 'bg-red-100 text-red-800 border-red-200', hot: true },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-sky-100 text-sky-800 border-sky-200' },
]

export const LOAD_SIZES = [
  { value: 'tiny', label: '1–2 items (tiny)' },
  { value: 'small', label: 'Pickup-truck bed (small)' },
  { value: 'medium', label: '~1/4 trailer (medium)' },
  { value: 'large', label: '~1/2 trailer (large)' },
  { value: 'xlarge', label: 'Full trailer (XL)' },
  { value: 'commercial', label: 'Commercial / multi-load' },
]

export const STATUS_LABEL = {
  draft: { label: 'Draft', color: 'bg-neutral-200 text-neutral-700' },
  pending_verification: { label: 'Pending review', color: 'bg-amber-100 text-amber-800' },
  open: { label: 'Open', color: 'bg-brand-100 text-brand-800' },
  accepted: { label: 'Accepted', color: 'bg-sky-100 text-sky-800' },
  on_the_way: { label: 'On the way', color: 'bg-sky-100 text-sky-800' },
  arrived: { label: 'Arrived', color: 'bg-sky-100 text-sky-800' },
  in_progress: { label: 'In progress', color: 'bg-sky-100 text-sky-800' },
  completed: { label: 'Completed', color: 'bg-brand-100 text-brand-800' },
  cancelled: { label: 'Cancelled', color: 'bg-neutral-200 text-neutral-600' },
  disputed: { label: 'Disputed', color: 'bg-red-100 text-red-800' },
}

const MATERIALS = ['Wood', 'Metal', 'Cardboard', 'Plastic', 'Furniture', 'Mattresses', 'Appliances', 'Electronics', 'Concrete', 'Dirt', 'Yard waste', 'Other']

const authHeaders = () => {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// ---------- Helpers ----------
const isVerifiedPoster = (user) =>
  !!(user && (user.isVerified || user.isPaidAccount || user.verifiedPosting || user.role === 'admin'))

const timeAgo = (d) => {
  if (!d) return ''
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return Math.floor(diff / 86400) + 'd ago'
}

// ============================================================
// MAIN JOBS DIALOG
// ============================================================
export function JobsDialog({ open, onOpenChange, user, onAuthRequest, initialTab = 'feed', onMapJump }) {
  const [tab, setTab] = useState(initialTab)
  const [postOpen, setPostOpen] = useState(false)
  const [detailJobId, setDetailJobId] = useState(null)

  useEffect(() => { if (open) setTab(initialTab) }, [open, initialTab])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-5xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-neutral-200 px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Briefcase className="h-5 w-5 text-brand-600" /> Jobs &amp; Hot Spots
                </DialogTitle>
                <DialogDescription className="hidden text-xs sm:block">
                  Real cleanup, hauling, and pickup jobs · verified posters · contractor matching
                </DialogDescription>
              </div>
              <Button
                onClick={() => {
                  if (!user) return onAuthRequest?.()
                  setPostOpen(true)
                }}
                className="bg-brand-600 hover:bg-brand-700"
                size="sm"
              >
                <Plus className="mr-1 h-4 w-4" /> Post job
              </Button>
            </div>
          </DialogHeader>
          <div className="px-3 pt-3 sm:px-6">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="feed" className="flex-1">
                  <Briefcase className="mr-1 h-3.5 w-3.5" /> Job Feed
                </TabsTrigger>
                <TabsTrigger value="hotspots" className="flex-1">
                  <Flame className="mr-1 h-3.5 w-3.5 text-red-500" /> Hot Spots
                </TabsTrigger>
                <TabsTrigger value="mine" className="flex-1">
                  <Home className="mr-1 h-3.5 w-3.5" /> My Posts
                </TabsTrigger>
                <TabsTrigger value="accepted" className="flex-1">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Accepted
                </TabsTrigger>
                <TabsTrigger value="saved" className="hidden flex-1 sm:flex">
                  <Heart className="mr-1 h-3.5 w-3.5" /> Saved
                </TabsTrigger>
              </TabsList>
              <div className="mt-3 max-h-[70vh] overflow-y-auto pb-4">
                <TabsContent value="feed" className="mt-0">
                  <JobFeed key="feed" user={user} onOpen={setDetailJobId} mode="feed" onMapJump={onMapJump} />
                </TabsContent>
                <TabsContent value="hotspots" className="mt-0">
                  <JobFeed key="hot" user={user} onOpen={setDetailJobId} mode="hotspots" onMapJump={onMapJump} />
                </TabsContent>
                <TabsContent value="mine" className="mt-0">
                  {user ? (
                    <JobFeed key="mine" user={user} onOpen={setDetailJobId} mode="mine" onMapJump={onMapJump} />
                  ) : (
                    <NeedsLogin onLogin={onAuthRequest} />
                  )}
                </TabsContent>
                <TabsContent value="accepted" className="mt-0">
                  {user ? (
                    <JobFeed key="acc" user={user} onOpen={setDetailJobId} mode="accepted" onMapJump={onMapJump} />
                  ) : (
                    <NeedsLogin onLogin={onAuthRequest} />
                  )}
                </TabsContent>
                <TabsContent value="saved" className="mt-0">
                  {user ? (
                    <JobFeed key="saved" user={user} onOpen={setDetailJobId} mode="saved" onMapJump={onMapJump} />
                  ) : (
                    <NeedsLogin onLogin={onAuthRequest} />
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <JobPostDialog open={postOpen} onOpenChange={setPostOpen} user={user} onPosted={() => setTab('mine')} />
      <JobDetailDialog
        jobId={detailJobId}
        onClose={() => setDetailJobId(null)}
        user={user}
        onAuthRequest={onAuthRequest}
        onMapJump={onMapJump}
      />
    </>
  )
}

function NeedsLogin({ onLogin }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
      <Lock className="h-8 w-8 text-neutral-400" />
      <div className="text-sm text-neutral-600">Log in to see your jobs.</div>
      <Button onClick={onLogin} className="bg-brand-600 hover:bg-brand-700">Log in</Button>
    </div>
  )
}

// ============================================================
// JOB FEED (filterable list)
// ============================================================
export function JobFeed({ user, onOpen, mode = 'feed', onMapJump, compact = false }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [urgency, setUrgency] = useState(mode === 'hotspots' ? 'asap' : 'all')
  const [maxKm, setMaxKm] = useState('any')
  const [userLoc, setUserLoc] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!navigator?.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setUserLoc({ lat: 37.3382, lng: -121.8863 }),
      { timeout: 5000 },
    )
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (mode === 'mine') p.set('mine', 'true')
      if (mode === 'accepted') p.set('accepted', 'true')
      if (mode === 'saved') p.set('saved', 'true')
      if (mode === 'hotspots') p.set('hotSpot', 'true')
      if (category !== 'all') p.set('category', category)
      if (urgency !== 'all' && mode !== 'hotspots') p.set('urgency', urgency)
      if (userLoc) {
        p.set('lat', userLoc.lat)
        p.set('lng', userLoc.lng)
        if (maxKm !== 'any') p.set('maxKm', maxKm)
      }
      const r = await fetch(`/api/jobs?${p.toString()}`, { headers: authHeaders() })
      const j = await r.json()
      let docs = j.jobs || []
      if (q) {
        const ql = q.toLowerCase()
        docs = docs.filter(
          (jb) =>
            jb.title.toLowerCase().includes(ql) ||
            (jb.description || '').toLowerCase().includes(ql) ||
            (jb.city || '').toLowerCase().includes(ql),
        )
      }
      setJobs(docs)
    } catch {
      setJobs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [mode, category, urgency, maxKm, userLoc, refreshKey])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setRefreshKey((k) => k + 1)}
            placeholder="Search title, city, description…"
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {JOB_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={maxKm} onValueChange={setMaxKm}>
          <SelectTrigger><SelectValue placeholder="Distance" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any distance</SelectItem>
            <SelectItem value="5">Within 5 km</SelectItem>
            <SelectItem value="10">Within 10 km</SelectItem>
            <SelectItem value="25">Within 25 km</SelectItem>
            <SelectItem value="50">Within 50 km</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode !== 'hotspots' && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setUrgency('all')}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${urgency === 'all' ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-neutral-600'}`}
          >
            All urgencies
          </button>
          {URGENCIES.map((u) => (
            <button
              key={u.value}
              onClick={() => setUrgency(u.value)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${urgency === u.value ? 'border-brand-600 bg-brand-50 text-brand-800' : u.color}`}
            >
              {u.hot && <Flame className="h-3 w-3" />} {u.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {loading && <div className="p-4 text-sm text-neutral-500">Loading jobs…</div>}
        {!loading && jobs.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            {mode === 'mine' && "You haven't posted any jobs yet."}
            {mode === 'accepted' && "You haven't accepted any jobs yet."}
            {mode === 'saved' && 'No saved jobs yet.'}
            {mode === 'hotspots' && 'No Hot Spots in your area right now.'}
            {mode === 'feed' && 'No open jobs match your filters.'}
          </div>
        )}
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} onOpen={() => onOpen?.(j.id)} onMapJump={onMapJump} compact={compact} />
        ))}
      </div>
    </div>
  )
}

// ============================================================
// JOB CARD
// ============================================================
export function JobCard({ job, onOpen, onMapJump, compact = false }) {
  const cat = JOB_CATEGORIES.find((c) => c.value === job.category)
  const Icon = cat?.icon || Briefcase
  const urgency = URGENCIES.find((u) => u.value === job.urgency)
  const isHot = job.urgency === 'asap'
  const status = STATUS_LABEL[job.status] || STATUS_LABEL.open
  return (
    <button
      onClick={onOpen}
      className={`group block w-full rounded-xl border p-3 text-left transition active:bg-neutral-50 ${
        isHot ? 'border-red-300 bg-red-50/40 hover:border-red-400' : 'border-neutral-200 bg-white hover:border-brand-600 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${isHot ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand-700'}`}>
          <Icon className="h-5 w-5" />
          {isHot && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white">
              <Flame className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="truncate text-sm font-semibold sm:text-base">{job.title}</div>
            {job.poster?.isVerified && (
              <Badge variant="outline" className="border-brand-300 bg-brand-50 text-[10px] text-brand-700">
                <Shield className="mr-0.5 h-3 w-3" /> Verified poster
              </Badge>
            )}
            <Badge className={`border text-[10px] ${status.color}`}>{status.label}</Badge>
          </div>
          <div className="mt-0.5 truncate text-xs text-neutral-500">
            {cat?.label || job.category} · {job.residentialOrCommercial}{' '}
            {job.city && <>· {job.city}{job.state ? `, ${job.state}` : ''}</>}
          </div>
          {!compact && job.description && (
            <div className="mt-1 line-clamp-2 text-xs text-neutral-600">{job.description}</div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-600">
            {urgency && (
              <span className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 ${urgency.color}`}>
                {urgency.hot && <Flame className="h-2.5 w-2.5" />} {urgency.label}
              </span>
            )}
            {job.loadSize && (
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">
                {(LOAD_SIZES.find((s) => s.value === job.loadSize)?.label) || job.loadSize}
              </span>
            )}
            {(job.budgetRange || job.fixedPriceOffer) && (
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">
                {job.fixedPriceOffer ? `$${job.fixedPriceOffer}` : job.budgetRange}
              </span>
            )}
            {job.distanceKm != null && (
              <span className="text-neutral-500">{job.distanceKm.toFixed(1)} km</span>
            )}
            <span className="text-neutral-400">· {timeAgo(job.createdAt)}</span>
          </div>
          {job.photos && job.photos.length > 0 && (
            <div className="mt-2 flex gap-1 overflow-x-auto">
              {job.photos.slice(0, 4).map((src, i) => (
                <img key={i} src={src} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <ChevronRight className="h-4 w-4 text-neutral-400" />
          <ReportButton kind="job" targetId={job.id} targetUserId={job.postedByUserId} />
        </div>
      </div>
    </button>
  )
}

// ============================================================
// JOB POST DIALOG (Create / Edit)
// ============================================================
export function JobPostDialog({ open, onOpenChange, user, onPosted, existing = null }) {
  const verified = isVerifiedPoster(user)
  const [showApplyGate, setShowApplyGate] = useState(false)

  // form state
  const [title, setTitle] = useState(existing?.title || '')
  const [category, setCategory] = useState(existing?.category || 'junk_removal')
  const [residentialOrCommercial, setResComm] = useState(existing?.residentialOrCommercial || 'residential')
  const [address, setAddress] = useState(existing?.address || '')
  const [city, setCity] = useState(existing?.city || '')
  const [stateField, setStateField] = useState(existing?.state || 'CA')
  const [zip, setZip] = useState(existing?.zip || '')
  const [description, setDescription] = useState(existing?.description || '')
  const [loadSize, setLoadSize] = useState(existing?.loadSize || 'medium')
  const [materials, setMaterials] = useState(existing?.materialTypes || [])
  const [accessNotes, setAccessNotes] = useState(existing?.accessNotes || '')
  const [parkingNotes, setParkingNotes] = useState(existing?.parkingNotes || '')
  const [preferredPickupTime, setPickupTime] = useState(existing?.preferredPickupTime || '')
  const [urgency, setUrgency] = useState(existing?.urgency || 'flexible')
  const [budgetRange, setBudgetRange] = useState(existing?.budgetRange || '')
  const [fixedPriceOffer, setFixedPrice] = useState(existing?.fixedPriceOffer || '')
  const [contactPreference, setContact] = useState(existing?.contactPreference || 'in_app')
  const [specialInstructions, setSpecial] = useState(existing?.specialInstructions || '')
  const [photos, setPhotos] = useState(existing?.photos ? existing.photos.map((u) => ({ url: u })) : [])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (!user) return
      // gate non-verified posters
      if (!verified) setShowApplyGate(true)
    }
  }, [open, verified, user])

  const reset = () => {
    setTitle(''); setCategory('junk_removal'); setResComm('residential')
    setAddress(''); setCity(''); setStateField('CA'); setZip('')
    setDescription(''); setLoadSize('medium'); setMaterials([])
    setAccessNotes(''); setParkingNotes(''); setPickupTime('')
    setUrgency('flexible'); setBudgetRange(''); setFixedPrice('')
    setContact('in_app'); setSpecial(''); setPhotos([])
  }

  const submit = async (asDraft = false) => {
    if (!title.trim()) return toast.error('Please add a job title')
    if (!city.trim()) return toast.error('Please add at least a city')
    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        category,
        residentialOrCommercial,
        address, city, state: stateField, zip,
        description,
        loadSize,
        materialTypes: materials,
        accessNotes, parkingNotes, preferredPickupTime,
        urgency, budgetRange,
        fixedPriceOffer: fixedPriceOffer ? parseFloat(fixedPriceOffer) : null,
        contactPreference, specialInstructions,
        photos: toUrlList(photos),
        status: asDraft ? 'draft' : undefined,
      }
      const r = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      if (j.verifiedPoster === false) {
        toast.success('Job submitted! It will be reviewed before going live.')
      } else {
        toast.success(asDraft ? 'Draft saved' : 'Job posted live!')
      }
      reset()
      onPosted?.(j.job)
      onOpenChange(false)
    } catch (e) {
      toast.error(e.message || 'Could not save job')
    } finally {
      setSubmitting(false)
    }
  }

  if (showApplyGate) {
    return (
      <VerifiedPostingApplyDialog
        open={open}
        onOpenChange={(v) => { onOpenChange(v); if (!v) setShowApplyGate(false) }}
        user={user}
        onContinueAsPilot={() => setShowApplyGate(false)}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-neutral-200 px-4 py-3 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-brand-600" />
            {existing ? 'Edit job' : 'Post a job / Hot Spot'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Contractors and haulers near you will get notified. Add photos and access details to attract better bids.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh] px-4 pb-4 pt-3 sm:px-6">
          <div className="space-y-4">
            {/* Verified posting banner */}
            {!verified && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">Pilot mode</div>
                    <div className="mt-0.5">
                      Your account isn't a Verified DumpMaps poster yet, so this job will be queued for review before going live.{' '}
                      <button onClick={() => setShowApplyGate(true)} className="underline">Apply for verified posting →</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>Job title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="E.g. 3 sofas + boxes - garage cleanout, San Jose" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOB_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Residential or commercial</Label>
                <Select value={residentialOrCommercial} onValueChange={setResComm}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="property_manager">Property manager</SelectItem>
                    <SelectItem value="hoa">HOA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Label>Pickup address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" />
              </div>
              <div>
                <Label>City *</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Jose" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>State</Label>
                  <Input value={stateField} onChange={(e) => setStateField(e.target.value)} maxLength={2} />
                </div>
                <div>
                  <Label>ZIP</Label>
                  <Input value={zip} onChange={(e) => setZip(e.target.value)} maxLength={10} />
                </div>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What items, how many, where they are, any helpful details…"
                rows={3}
              />
            </div>

            {/* Photos */}
            <div className="rounded-lg border border-neutral-200 bg-white p-3">
              <PhotoUploader
                value={photos}
                onChange={setPhotos}
                max={6}
                label="Photos"
                hint="Add up to 6 photos · device or phone camera"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Estimated load size</Label>
                <Select value={loadSize} onValueChange={setLoadSize}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOAD_SIZES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Urgency</Label>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {URGENCIES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Material types</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {MATERIALS.map((m) => {
                  const on = materials.includes(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMaterials((arr) => on ? arr.filter((x) => x !== m) : [...arr, m])}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-neutral-600'}`}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Access notes (stairs, elevator, gate code…)</Label>
                <Textarea rows={2} value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} placeholder="2nd floor, elevator, must use gate code 4571" />
              </div>
              <div>
                <Label>Parking / loading notes</Label>
                <Textarea rows={2} value={parkingNotes} onChange={(e) => setParkingNotes(e.target.value)} placeholder="Driveway fits 1 truck, side street OK, no permit needed" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Preferred pickup time</Label>
                <Input value={preferredPickupTime} onChange={(e) => setPickupTime(e.target.value)} placeholder="Sat morning, anytime today, etc." />
              </div>
              <div>
                <Label>Budget range</Label>
                <Input value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} placeholder="$80–$150" />
              </div>
              <div>
                <Label>Fixed price offer ($)</Label>
                <Input value={fixedPriceOffer} onChange={(e) => setFixedPrice(e.target.value)} placeholder="125" inputMode="decimal" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Contact preference</Label>
                <Select value={contactPreference} onValueChange={setContact}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_app">In-app messages</SelectItem>
                    <SelectItem value="phone">Phone call</SelectItem>
                    <SelectItem value="sms">SMS / Text</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Special instructions</Label>
                <Input value={specialInstructions} onChange={(e) => setSpecial(e.target.value)} placeholder="Watch dog in yard, ring before entering…" />
              </div>
            </div>

            {/* Payment teaser */}
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="inline-flex items-center gap-1 font-semibold"><CreditCard className="h-4 w-4" /> Verified job payments — coming soon</div>
                  <div className="mt-0.5">DumpMaps is building escrow-style funding so customers can pre-fund jobs and contractors get faster payouts. No payments are processed today.</div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="border-t border-neutral-200 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button variant="outline" onClick={() => submit(true)} disabled={submitting}>Save draft</Button>
            <Button onClick={() => submit(false)} disabled={submitting} className="bg-brand-600 hover:bg-brand-700">
              {submitting ? 'Posting…' : 'Post job'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// JOB DETAIL DIALOG
// ============================================================
export function JobDetailDialog({ jobId, onClose, user, onAuthRequest, onMapJump }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const [msgInput, setMsgInput] = useState('')
  const [tab, setTab] = useState('details')
  const [reviewOpen, setReviewOpen] = useState(false)
  const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null

  const load = async () => {
    if (!jobId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/jobs/${jobId}`, { headers: authHeaders() })
      const j = await r.json()
      setData(j.job || null)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async () => {
    if (!jobId || !user) return
    try {
      const r = await fetch(`/api/jobs/${jobId}/messages`, { headers: authHeaders() })
      const j = await r.json()
      if (r.ok) setMessages(j.messages || [])
    } catch {}
  }

  useEffect(() => { if (jobId) { load(); setTab('details') } }, [jobId])
  useEffect(() => { if (tab === 'messages') loadMessages() }, [tab, jobId])

  if (!jobId) return null

  const isPoster = user && data?.postedByUserId === user.id
  const isContractor = user && data?.acceptedByUserId === user.id
  const isParty = isPoster || isContractor
  const cat = JOB_CATEGORIES.find((c) => c.value === data?.category)
  const urgency = URGENCIES.find((u) => u.value === data?.urgency)
  const status = STATUS_LABEL[data?.status] || STATUS_LABEL.open

  const doAction = async (path, body = {}, successMsg = 'Done') => {
    if (!user) return onAuthRequest?.()
    try {
      const r = await fetch(`/api/jobs/${jobId}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      toast.success(successMsg)
      load()
    } catch (e) {
      toast.error(e.message || 'Failed')
    }
  }

  const sendMsg = async () => {
    if (!msgInput.trim()) return
    try {
      const r = await fetch(`/api/jobs/${jobId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ message: msgInput.trim() }),
      })
      if (r.ok) {
        setMsgInput('')
        loadMessages()
      }
    } catch {
      toast.error('Could not send message')
    }
  }

  return (
    <Dialog open={!!jobId} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-neutral-200 px-4 py-3 sm:px-6">
          <DialogTitle className="flex items-start gap-2 pr-6">
            {data?.urgency === 'asap' && <Flame className="mt-1 h-5 w-5 text-red-600" />}
            <span className="line-clamp-2">{loading ? 'Loading…' : data?.title || 'Job'}</span>
          </DialogTitle>
          {data && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <Badge className={status.color}>{status.label}</Badge>
              {urgency && (
                <Badge variant="outline" className={urgency.color}>
                  {urgency.hot && <Flame className="mr-0.5 h-3 w-3" />} {urgency.label}
                </Badge>
              )}
              {cat && <Badge variant="outline">{cat.label}</Badge>}
              <span className="text-neutral-500">· {timeAgo(data.createdAt)}</span>
              {data.distanceKm != null && <span className="text-neutral-500">· {data.distanceKm.toFixed(1)} km</span>}
            </div>
          )}
        </DialogHeader>

        {data && (
          <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden px-4 sm:px-6">
            <TabsList className="mt-3 w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="status" className="flex-1">Status</TabsTrigger>
              <TabsTrigger value="messages" className="flex-1">
                Messages {data.messageCount > 0 && <Badge className="ml-1 h-4 px-1 text-[9px]">{data.messageCount}</Badge>}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="mt-3 h-full max-h-[58vh] pr-2">
              <TabsContent value="details" className="space-y-3">
                <div>
                  <div className="text-xs font-semibold text-neutral-500">Location</div>
                  <div className="mt-0.5 text-sm">{data.address ? `${data.address}, ` : ''}{data.city}{data.state ? `, ${data.state}` : ''} {data.zip}</div>
                </div>
                {data.description && (
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">Description</div>
                    <div className="mt-0.5 whitespace-pre-wrap text-sm">{data.description}</div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">Load size</div>
                    <div>{LOAD_SIZES.find((s) => s.value === data.loadSize)?.label || data.loadSize}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">Type</div>
                    <div className="capitalize">{data.residentialOrCommercial?.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">Pickup time</div>
                    <div>{data.preferredPickupTime || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">Budget</div>
                    <div className="font-semibold text-brand-700">
                      {data.fixedPriceOffer ? `$${data.fixedPriceOffer}` : data.budgetRange || 'Open to bids'}
                    </div>
                  </div>
                </div>
                {data.materialTypes?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">Materials</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {data.materialTypes.map((m) => (
                        <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {data.accessNotes && <DetailRow label="Access notes" value={data.accessNotes} />}
                {data.parkingNotes && <DetailRow label="Parking / loading" value={data.parkingNotes} />}
                {data.specialInstructions && <DetailRow label="Special instructions" value={data.specialInstructions} />}
                {data.photos && data.photos.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">Photos</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {data.photos.map((src, i) => (
                        <img key={i} src={src} alt="" className="h-20 w-20 rounded-md object-cover" />
                      ))}
                    </div>
                  </div>
                )}
                {data.poster && (
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-neutral-800">Posted by {data.poster.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] capitalize">{data.poster.accountType}</Badge>
                          {data.poster.isVerified && (
                            <Badge className="bg-brand-100 text-[10px] text-brand-800"><Shield className="mr-0.5 h-3 w-3" /> Verified</Badge>
                          )}
                          {!data.poster.isVerified && (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">Pilot</Badge>
                          )}
                        </div>
                      </div>
                      {user && data.poster.id && data.poster.id !== user.id && (
                        <StartDmButton
                          targetUserId={data.poster.id}
                          targetUserName={data.poster.name}
                          currentUser={user}
                          token={token}
                          size="sm"
                          variant="outline"
                          label="Message"
                          className="shrink-0"
                        />
                      )}
                    </div>
                  </div>
                )}
                {data.contractor && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sky-900">Accepted by {data.contractor.name}</div>
                        <div className="mt-0.5">Karma {data.contractor.karma}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {user && data.contractor.id && data.contractor.id !== user.id && (
                          <StartDmButton
                            targetUserId={data.contractor.id}
                            targetUserName={data.contractor.name}
                            currentUser={user}
                            token={token}
                            size="sm"
                            variant="outline"
                            label="Message"
                          />
                        )}
                        <a
                          href={`/recommendations/contractors/${data.contractor.id}`}
                          className="rounded-md border border-sky-300 bg-white px-2 py-1 text-[10px] font-semibold text-sky-700 hover:bg-sky-100"
                        >View profile →</a>
                      </div>
                    </div>
                  </div>
                )}
                {data.status === 'completed' && isPoster && data.contractor && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="inline-flex items-center gap-1 text-sm font-bold text-amber-900"><Star className="h-4 w-4" /> How was {data.contractor.name}?</div>
                        <p className="mt-0.5 text-xs text-amber-800">Job completed. Your review helps the community find trustworthy contractors.</p>
                      </div>
                      <Button onClick={() => setReviewOpen(true)} size="sm" className="shrink-0 bg-amber-500 hover:bg-amber-600">Leave review</Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="status">
                <JobStatusPanel
                  job={data}
                  user={user}
                  isPoster={isPoster}
                  isContractor={isContractor}
                  onAction={doAction}
                />
              </TabsContent>

              <TabsContent value="messages">
                {!user && <NeedsLogin onLogin={onAuthRequest} />}
                {user && !isParty && (
                  <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
                    Only the poster and the accepting contractor can message on this job.
                  </div>
                )}
                {user && isParty && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {messages.length === 0 && (
                        <div className="inline-flex w-full items-center justify-center gap-1 text-center text-xs text-neutral-500">No messages yet — say hi <Hand className="h-3.5 w-3.5" /></div>
                      )}
                      {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.senderId === user.id ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                            {m.message}
                            <div className={`mt-0.5 text-[10px] ${m.senderId === user.id ? 'text-brand-100' : 'text-neutral-500'}`}>{timeAgo(m.createdAt)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={msgInput}
                        onChange={(e) => setMsgInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
                        placeholder="Type your message…"
                      />
                      <Button onClick={sendMsg} className="bg-brand-600 hover:bg-brand-700"><Send className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}

        {data && (
          <div className="sticky bottom-0 z-10 flex-none border-t border-neutral-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {data.lat != null && data.lng != null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMapJump?.({ lat: data.lat, lng: data.lng })}
                >
                  <MapPin className="mr-1 h-4 w-4" /> Show on map
                </Button>
              )}
              {data.address && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([data.address, data.city, data.state, data.zip].filter(Boolean).join(', '))}`}
                  target="_blank" rel="noreferrer"
                >
                  <Button variant="outline" size="sm"><Navigation className="mr-1 h-4 w-4" /> Directions</Button>
                </a>
              )}
              {user && !isPoster && data.status === 'open' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => doAction('/save', {}, 'Saved')}>
                    <Heart className="mr-1 h-4 w-4" /> Save
                  </Button>
                  <Button className="bg-brand-600 hover:bg-brand-700" size="sm" onClick={() => doAction('/accept', {}, 'Job accepted!')}>
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Accept job
                  </Button>
                </>
              )}
              {!user && data.status === 'open' && (
                <Button className="bg-brand-600 hover:bg-brand-700" size="sm" onClick={onAuthRequest}>
                  Log in to accept
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
      {data?.contractor?.id && (
        <ContractorReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          contractorId={data.contractor.id}
          contractorName={data.contractor.name}
          token={token}
          onSaved={() => { setReviewOpen(false); load() }}
        />
      )}
    </Dialog>
  )
}

function DetailRow({ label, value }) {
  return (
    <div>
      <div className="text-xs font-semibold text-neutral-500">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap text-sm">{value}</div>
    </div>
  )
}

// Status panel: shows current state + appropriate action buttons
function JobStatusPanel({ job, user, isPoster, isContractor, onAction }) {
  if (!job) return null
  const transitions = []
  if (isContractor) {
    if (job.status === 'accepted') transitions.push({ to: 'on_the_way', label: 'On the way', cls: 'bg-sky-600 hover:bg-sky-700' })
    if (job.status === 'on_the_way') transitions.push({ to: 'arrived', label: 'Arrived on site', cls: 'bg-sky-600 hover:bg-sky-700' })
    if (job.status === 'arrived') transitions.push({ to: 'in_progress', label: 'Start job', cls: 'bg-brand-600 hover:bg-brand-700' })
    if (job.status === 'in_progress') transitions.push({ to: 'completed', label: 'Mark complete', cls: 'bg-brand-600 hover:bg-brand-700' })
  }
  if (isPoster) {
    if (['open', 'accepted', 'on_the_way', 'arrived', 'in_progress'].includes(job.status)) {
      transitions.push({ to: 'cancelled', label: 'Cancel job', cls: 'bg-neutral-600 hover:bg-neutral-700' })
    }
    if (['accepted', 'on_the_way', 'arrived', 'in_progress', 'completed'].includes(job.status)) {
      transitions.push({ to: 'disputed', label: 'Report issue', cls: 'bg-red-600 hover:bg-red-700' })
    }
  }
  const history = job.statusHistory || []
  return (
    <div className="space-y-3">
      {(isPoster || isContractor) && transitions.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="text-xs font-semibold text-neutral-700">Update status</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {transitions.map((t) => (
              <Button key={t.to} size="sm" className={`text-white ${t.cls}`} onClick={() => onAction('/status', { status: t.to }, `Marked as ${t.label}`)}>
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="text-xs font-semibold text-neutral-500">Timeline</div>
        <div className="mt-2 space-y-2">
          {history.length === 0 && <div className="text-xs text-neutral-500">No updates yet.</div>}
          {history.map((h) => (
            <div key={h.id} className="rounded-md border border-neutral-200 bg-neutral-50 p-2 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-neutral-500" />
                <span className="font-semibold capitalize">{(STATUS_LABEL[h.status]?.label || h.status).replace('_', ' ')}</span>
                <span className="ml-auto text-neutral-500">{timeAgo(h.createdAt)}</span>
              </div>
              {h.message && <div className="mt-1 text-neutral-700">{h.message}</div>}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="inline-flex items-center gap-1 font-semibold"><CreditCard className="h-4 w-4" /> Verified job payments — coming soon</div>
            <div className="mt-0.5">Once payments launch, contractor payout will release on completion confirmation.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// VERIFIED POSTING APPLY DIALOG
// ============================================================
export function VerifiedPostingApplyDialog({ open, onOpenChange, user, onContinueAsPilot }) {
  const [accountType, setAccountType] = useState('resident')
  const [businessName, setBusinessName] = useState('')
  const [contactName, setContactName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [expected, setExpected] = useState('1-5')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!email) return toast.error('Email is required')
    setSubmitting(true)
    try {
      const r = await fetch('/api/verified-posting-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          accountType, businessName, contactName, email, phone,
          reasonForPosting: reason, expectedMonthlyJobs: expected,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      toast.success("Application received! We'll be in touch within 1–2 business days.")
      onOpenChange(false)
    } catch (e) {
      toast.error(e.message || 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-600" /> Verified Posting Account
          </DialogTitle>
          <DialogDescription>
            To post live paid jobs on DumpMaps, you need a verified posting account. Apply for the pilot — approval is free during early access.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Account type</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resident">Resident</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="property_manager">Property manager</SelectItem>
                <SelectItem value="facility">Facility</SelectItem>
                <SelectItem value="commercial_account">Commercial account</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label>Business name (if any)</Label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div>
              <Label>Contact name</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <Label>Email *</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Reason for posting</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Property turnover, recurring junk removal, commercial cleanouts…" />
          </div>
          <div>
            <Label>Expected jobs / month</Label>
            <Select value={expected} onValueChange={setExpected}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1-5">1–5</SelectItem>
                <SelectItem value="6-20">6–20</SelectItem>
                <SelectItem value="21-50">21–50</SelectItem>
                <SelectItem value="50+">50+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
            <div className="inline-flex items-center gap-1 font-semibold"><CreditCard className="h-4 w-4" /> Verified job payments — coming soon</div>
            <div className="mt-0.5">DumpMaps is building verified funds, escrow-style job payments, instant contractor payouts, and a payout dashboard. Approve as a pilot now to be first in line.</div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {onContinueAsPilot && (
            <Button variant="outline" onClick={() => { onContinueAsPilot(); }}>Continue in pilot mode</Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={submit} disabled={submitting} className="bg-brand-600 hover:bg-brand-700">
            {submitting ? 'Submitting…' : 'Apply for verified posting'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// FLOATING "+ POST" FAB (with action menu)
// ============================================================
export function PostFab({ onSubmitFacility, onPostJob, onPostAlert, onPostCommunity, onUploadPhoto }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 active:scale-95 md:hidden"
        aria-label="Post"
      >
        <Plus className="h-6 w-6" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-6">
          <SheetHeader className="text-left">
            <SheetTitle>What do you want to post?</SheetTitle>
            <SheetDescription className="text-xs">Pick one — you can always add more later.</SheetDescription>
          </SheetHeader>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <FabRow icon={Flame} color="text-red-600" title="Post Job / Hot Spot" desc="Hire a verified contractor for cleanup, hauling, or pickup" onClick={() => { setOpen(false); onPostJob?.() }} />
            <FabRow icon={AlertTriangle} color="text-orange-600" title="Post Facility Alert" desc="Wait times, closures, accepting now, donation needs" onClick={() => { setOpen(false); onPostAlert?.() }} />
            <FabRow icon={MapPin} color="text-brand-600" title="Submit a Facility" desc="Add a recycling/donation/transfer station to the map" onClick={() => { setOpen(false); onSubmitFacility?.() }} />
            <FabRow icon={ImageIcon} color="text-sky-600" title="Add Community Update" desc="Share tips, finds, or news with the community" onClick={() => { setOpen(false); onPostCommunity?.() }} />
            <FabRow icon={Camera} color="text-purple-600" title="Upload Photo" desc="Add a photo to a facility, alert, or job (PR 2)" onClick={() => { setOpen(false); onUploadPhoto?.() }} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function FabRow({ icon: Icon, color, title, desc, onClick }) {
  return (
    <button onClick={onClick} className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 text-left active:bg-neutral-50">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-neutral-600">{desc}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
    </button>
  )
}

// ============================================================
// JOBS BUTTON for top nav
// ============================================================
export function JobsButton({ onOpen, label = 'Jobs', hotSpotCount = 0 }) {
  return (
    <Button variant="outline" size="sm" onClick={onOpen} className="relative">
      <Briefcase className="mr-1 h-4 w-4 text-brand-600" />
      {label}
      {hotSpotCount > 0 && (
        <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {hotSpotCount}
        </span>
      )}
    </Button>
  )
}

// ============================================================
// HOT SPOT MAP PINS (overlay helper — returns pin data for the existing MockMap)
// ============================================================
export function useHotSpots() {
  const [hotSpots, setHotSpots] = useState([])
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const r = await fetch('/api/jobs?hotSpot=true', {})
        const j = await r.json()
        if (alive) setHotSpots((j.jobs || []).filter((x) => x.lat != null && x.lng != null))
      } catch {}
    }
    load()
    const t = setInterval(load, 45000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return hotSpots
}
