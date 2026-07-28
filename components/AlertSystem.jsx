'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import PhotoUploader, { toUrlList } from '@/components/PhotoUploader'
import {
  Clock,
  Truck,
  Ban,
  Scale,
  Package,
  Zap,
  CheckCircle2,
  CircleDollarSign,
  PartyPopper,
  Megaphone,
  XCircle,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Activity,
  Navigation,
  MapPin,
  Flag,
} from 'lucide-react'

export const ALERT_TYPES = {
  WAIT_TIME:     { label: 'Wait Time',       severity: 'warn', Icon: Clock,        color: 'bg-amber-500', hours: 2 },
  LONG_LINE:     { label: 'Long Line',       severity: 'warn', Icon: Truck,        color: 'bg-amber-500', hours: 6 },
  FAST_MOVING:   { label: 'Fast Moving',     severity: 'good', Icon: Zap,          color: 'bg-brand-600', hours: 6 },
  CLOSED:        { label: 'Facility Closed', severity: 'bad',  Icon: Ban,          color: 'bg-red-600',   hours: 24 },
  NOT_ACCEPTING: { label: 'Not Accepting',   severity: 'warn', Icon: AlertTriangle,color: 'bg-amber-500', hours: 12 },
  ACCEPTING_NOW: { label: 'Accepting Now',   severity: 'good', Icon: CheckCircle2, color: 'bg-brand-600', hours: 12 },
  YARD_FULL:     { label: 'Yard Full',       severity: 'bad',  Icon: Package,      color: 'bg-red-600',   hours: 6 },
  SCALE_ISSUE:   { label: 'Scale Issue',     severity: 'bad',  Icon: Scale,        color: 'bg-red-600',   hours: 6 },
  PRICE_UPDATE:  { label: 'Price Update',    severity: 'info', Icon: CircleDollarSign,   color: 'bg-sky-500',   hours: 12 },
  DONATION_NEED: { label: 'Donation Need',   severity: 'info', Icon: Megaphone,    color: 'bg-sky-500',   hours: 12 },
  EVENT:         { label: 'Event',           severity: 'good', Icon: PartyPopper,  color: 'bg-brand-600', hours: 24 },
  GENERAL_NOTE:  { label: 'General Note',    severity: 'info', Icon: XCircle,      color: 'bg-neutral-500', hours: 6 },
}

export const SEVERITY_RING = {
  bad: { ring: 'ring-red-500/70', glow: 'shadow-red-500/40', label: 'Issue' },
  warn: { ring: 'ring-amber-500/70', glow: 'shadow-amber-500/40', label: 'Heads up' },
  info: { ring: 'ring-sky-500/70', glow: 'shadow-sky-500/40', label: 'Info' },
  good: { ring: 'ring-brand-500/70', glow: 'shadow-brand-500/40', label: 'All good' },
}

const MATERIALS = [
  'Metal', 'Aluminum', 'Copper', 'Appliances', 'E-waste', 'Cardboard', 'Plastic', 'Wood',
  'Furniture', 'Mattresses', 'Concrete', 'Dirt', 'Green waste', 'Household goods', 'Clothing',
  'Pallets', 'Fixtures', 'Construction debris',
]

export function timeAgo(date) {
  if (!date) return ''
  const d = new Date(date)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ---------- Post alert dialog ----------
export function AlertPostDialog({ open, onOpenChange, facility, onPosted }) {
  const [type, setType] = useState(null)
  const [text, setText] = useState('')
  const [waitMinutes, setWaitMinutes] = useState('')
  const [truckCount, setTruckCount] = useState('')
  const [material, setMaterial] = useState('')
  const [photos, setPhotos] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setType(null); setText(''); setWaitMinutes(''); setTruckCount(''); setMaterial(''); setPhotos([])
    }
  }, [open])

  const submit = async () => {
    if (!type || !facility) return
    setSubmitting(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
      const urls = toUrlList(photos)
      const r = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          facilityId: facility.id,
          type,
          text,
          waitMinutes: waitMinutes || undefined,
          truckCount: truckCount || undefined,
          material: material || undefined,
          photoUrl: urls[0] || undefined,
          photos: urls,
        }),
      })
      if (!r.ok) throw new Error('fail')
      toast.success('Alert posted. Other haulers will see this.')
      onPosted?.()
      onOpenChange(false)
    } catch {
      toast.error('Failed to post alert')
    } finally {
      setSubmitting(false)
    }
  }

  const needsMaterial = type === 'NOT_ACCEPTING' || type === 'ACCEPTING_NOW' || type === 'DONATION_NEED' || type === 'PRICE_UPDATE'
  const needsWait = type === 'WAIT_TIME'
  const needsTrucks = type === 'LONG_LINE'
  const selectedMeta = type ? ALERT_TYPES[type] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-500" />
            Report what&apos;s happening at {facility?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="text-sm text-neutral-600">
            Help other haulers and contractors. Pick what you&apos;re seeing right now:
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(ALERT_TYPES).map(([k, m]) => {
              const Icon = m.Icon
              const active = type === k
              return (
                <button
                  key={k}
                  onClick={() => setType(k)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition ${
                    active
                      ? 'border-brand-600 bg-brand-50 shadow-sm'
                      : 'border-neutral-200 bg-white hover:border-brand-600/40 hover:bg-neutral-50'
                  }`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${m.color} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-xs font-semibold text-neutral-900">{m.label}</div>
                </button>
              )
            })}
          </div>

          {selectedMeta && (
            <div className="rounded-md bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
              <b>{selectedMeta.label}</b> auto-expires in <b>{selectedMeta.hours} hours</b> unless renewed by confirmations.
            </div>
          )}

          {needsWait && (
            <div>
              <Label className="text-xs">Estimated wait (minutes)</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={waitMinutes}
                onChange={(e) => setWaitMinutes(e.target.value)}
                placeholder="e.g. 45"
                className="mt-1"
              />
            </div>
          )}
          {needsTrucks && (
            <div>
              <Label className="text-xs">Approximate trucks in line</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={truckCount}
                onChange={(e) => setTruckCount(e.target.value)}
                placeholder="e.g. 6"
                className="mt-1"
              />
            </div>
          )}
          {needsMaterial && (
            <div>
              <Label className="text-xs">Material</Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a material" /></SelectTrigger>
                <SelectContent>
                  {MATERIALS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">Message (e.g. &ldquo;9 trucks ahead, been here 30 min&rdquo;)</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tell other haulers what they need to know…"
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <PhotoUploader
              value={photos}
              onChange={setPhotos}
              max={3}
              label="Photo (optional)"
              hint="Snap from camera or upload — up to 3 photos"
              compact
            />
          </div>

          <Button
            onClick={submit}
            disabled={!type || submitting}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {submitting ? 'Posting…' : 'Post alert'}
          </Button>
          <p className="text-center text-[11px] text-neutral-500">
            Confirms from others extend life · 3+ flags auto-remove · Owners&apos; official alerts last 2× as long.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Alert card (compact) ----------
export function AlertCard({ alert, onVote, onJump, onFlag, showFacilityName = false }) {
  const meta = ALERT_TYPES[alert.type] || { label: alert.label, Icon: Activity, color: 'bg-neutral-500', severity: alert.severity }
  const Icon = meta.Icon
  const sev = SEVERITY_RING[meta.severity] || SEVERITY_RING.info
  const expiresInMs = alert.expiresAt ? new Date(alert.expiresAt).getTime() - Date.now() : null
  const expiryLabel = expiresInMs && expiresInMs > 0
    ? expiresInMs > 3600000
      ? `${Math.round(expiresInMs / 3600000)}h left`
      : `${Math.max(1, Math.round(expiresInMs / 60000))}m left`
    : 'expired'
  return (
    <div className={`relative rounded-lg border ${alert.isOfficial ? 'border-purple-300' : 'border-neutral-200'} bg-white p-3 shadow-sm ring-2 ${sev.ring}`}>
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.color} text-white shadow ${sev.glow} shadow-md`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="truncate text-sm font-semibold text-neutral-900">{meta.label}</div>
              {alert.isOfficial && (
                <Badge className="bg-purple-600 text-[10px] text-white hover:bg-purple-600">Official</Badge>
              )}
            </div>
            <span className="shrink-0 text-[10px] font-medium text-neutral-500">{timeAgo(alert.createdAt)}</span>
          </div>
          {showFacilityName && (
            <button
              onClick={() => onJump?.(alert.facilityId)}
              className="mt-0.5 flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
            >
              <MapPin className="h-3 w-3" />
              {alert.facilityName}
            </button>
          )}
          {alert.text && (
            <div className="mt-1 rounded-md bg-neutral-50 px-2 py-1.5 text-xs italic text-neutral-700">
              &ldquo;{alert.text}&rdquo;
            </div>
          )}
          {(alert.waitMinutes || alert.truckCount || alert.material) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
              {alert.waitMinutes && (
                <Badge variant="outline" className="bg-amber-50 text-amber-900">
                  ~{alert.waitMinutes} min wait
                </Badge>
              )}
              {alert.truckCount && (
                <Badge variant="outline" className="bg-amber-50 text-amber-900">
                  ~{alert.truckCount} trucks
                </Badge>
              )}
              {alert.material && (
                <Badge variant="outline" className="bg-sky-50 text-sky-900">
                  {alert.material}
                </Badge>
              )}
            </div>
          )}
          {alert.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={alert.photoUrl}
              alt="alert"
              className="mt-2 h-24 w-full rounded-md border border-neutral-200 object-cover"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[10px] text-neutral-500">
              <span>by {alert.userName || 'Guest'}</span>
              {alert.userRole && <span>· {alert.userRole}</span>}
              <span>·</span>
              <span title={`Expires ${new Date(alert.expiresAt).toLocaleString()}`}>{expiryLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onVote?.(alert.id, 'confirm')}
                className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
                title="Still happening"
              >
                <ThumbsUp className="h-3 w-3" /> {alert.confirmCount || 0}
              </button>
              <button
                onClick={() => onVote?.(alert.id, 'deny')}
                className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                title="Not happening anymore"
              >
                <ThumbsDown className="h-3 w-3" /> {alert.denyCount || 0}
              </button>
              {onFlag && (
                <button
                  onClick={() => onFlag(alert.id)}
                  className="rounded-md border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-500 hover:bg-neutral-50"
                  title="Flag this alert"
                >
                  <Flag className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Live feed (right panel) ----------
export function LiveFeed({ onJump, refreshKey = 0 }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const r = await fetch('/api/alerts?recent=true')
      const j = await r.json()
      setAlerts(j.alerts || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30000) // 30s polling
    return () => clearInterval(t)
  }, [refreshKey])

  const vote = async (id, kind) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    const r = await fetch(`/api/alerts/${id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ vote: kind }),
    })
    const j = await r.json()
    if (j.error === 'Already voted') {
      toast('You already voted on this alert')
    } else if (j.alert) {
      setAlerts((arr) => arr.map((a) => (a.id === id ? { ...a, ...j.alert } : a)))
      toast.success(kind === 'confirm' ? 'Confirmed — thanks!' : 'Denied — thanks!')
    }
  }

  const flag = async (id) => {
    const reason = prompt('Why are you flagging this alert? (e.g., wrong info, spam)')
    if (!reason) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    await fetch(`/api/alerts/${id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ reason }),
    })
    toast.success('Flagged. Thanks for keeping the feed clean.')
    load()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
          </span>
          <div className="font-semibold">Live Alerts</div>
        </div>
        <Badge variant="outline" className="text-[10px]">{alerts.length} active</Badge>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {loading && <div className="text-center text-xs text-neutral-500">Loading…</div>}
          {!loading && alerts.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-500">
              No active alerts.<br />
              Be the first to report — tap a facility, then <b>Report</b>.
            </div>
          )}
          {alerts.map((a) => (
            <AlertCard key={a.id} alert={a} onVote={vote} onJump={onJump} onFlag={flag} showFacilityName />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ---------- Inline alert list (for facility detail) ----------
export function FacilityAlertSection({ facilityId, alerts, onRefresh, onReport }) {
  const vote = async (id, kind) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    const r = await fetch(`/api/alerts/${id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ vote: kind }),
    })
    const j = await r.json()
    if (j.error === 'Already voted') toast('You already voted on this alert')
    else if (j.alert) {
      toast.success(kind === 'confirm' ? 'Confirmed' : 'Denied')
      onRefresh?.()
    }
  }

  const flag = async (id) => {
    const reason = prompt('Why are you flagging this alert?')
    if (!reason) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    await fetch(`/api/alerts/${id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ reason }),
    })
    toast.success('Flagged')
    onRefresh?.()
  }

  const topSeverity = useMemo(() => {
    const rank = { bad: 3, warn: 2, info: 1, good: 0 }
    return alerts.reduce((m, a) => {
      const r = rank[a.severity] ?? -1
      return r > m.r ? { r, sev: a.severity } : m
    }, { r: -1, sev: null }).sev
  }, [alerts])

  const banner = topSeverity ? SEVERITY_RING[topSeverity] : null

  return (
    <div className="rounded-xl border-2 border-orange-200 bg-orange-50/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-neutral-900">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
          </span>
          Live Status
          {alerts.length > 0 && (
            <Badge className="ml-1 bg-orange-600 text-white">{alerts.length}</Badge>
          )}
        </div>
        <Button size="sm" onClick={onReport} className="bg-orange-600 hover:bg-orange-700">
          <Activity className="mr-1 h-4 w-4" /> Report
        </Button>
      </div>
      {alerts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-orange-200 bg-white p-3 text-center text-xs text-neutral-600">
          No live reports yet. Tap <b>Report</b> if you&apos;ve been here today — help your fellow haulers.
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.slice(0, 5).map((a) => (
            <AlertCard key={a.id} alert={a} onVote={vote} onFlag={flag} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Tiny alert badge (for facility list cards) ----------
export function AlertChipRow({ facility, onClick }) {
  if (!facility?.activeAlertCount) return null
  const sev = facility.topAlertSeverity || 'info'
  const meta = SEVERITY_RING[sev] || SEVERITY_RING.info
  const colorMap = {
    bad: 'bg-red-100 text-red-800 border-red-200',
    warn: 'bg-amber-100 text-amber-900 border-amber-200',
    info: 'bg-sky-100 text-sky-800 border-sky-200',
    good: 'bg-brand-100 text-brand-800 border-brand-200',
  }
  const top = facility.activeAlerts?.[0]
  const topMeta = top ? ALERT_TYPES[top.type] : null
  const TopIcon = topMeta?.Icon || AlertTriangle
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={`mt-2 flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] font-semibold ${colorMap[sev]}`}
    >
      <TopIcon className="h-4 w-4 shrink-0" />
      <span className="truncate">
        {topMeta?.label || 'Alert'} · {facility.activeAlertCount} live · {timeAgo(facility.lastAlertAt)}
      </span>
    </button>
  )
}
