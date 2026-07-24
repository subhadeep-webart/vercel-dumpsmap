'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Briefcase, MapPin, Clock, DollarSign, MessageCircle, Bookmark, BadgeCheck, AlertTriangle, Loader2, Navigation } from 'lucide-react'
import FieldFrame from '@/components/field/FieldFrame'
import ReportButton from '@/components/ReportButton'
import { timeAgo } from '@/lib/community-categories'
import { SoftLoginModal } from '@/components/SoftLoginModal'

function authHeaders() {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function JobDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [softLogin, setSoftLogin] = useState(null)
  const requireAuth = (action) => {
    if (user) return true
    setSoftLogin(action)
    return false
  }

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!t) return
    fetch('/api/auth/me', { headers: authHeaders() }).then((r) => r.ok ? r.json() : null).then((j) => setUser(j?.user || null)).catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/jobs/${id}`, { headers: authHeaders() })
      if (!r.ok) { setErr((await r.json()).error || 'Not found'); return }
      const j = await r.json()
      setJob(j.job || j)
    } finally { setLoading(false) }
  }
  useEffect(() => { if (id) load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [id])

  const accept = async () => {
    if (!requireAuth('bid')) return
    setActionBusy(true)
    try {
      const r = await fetch(`/api/jobs/${id}/accept`, { method: 'POST', headers: authHeaders() })
      if (!r.ok) throw new Error((await r.json()).error || 'Could not accept')
      toast.success('Job accepted')
      await load()
    } catch (e) { toast.error(e.message || 'Could not accept') } finally { setActionBusy(false) }
  }

  const save = async () => {
    if (!requireAuth('save')) return
    try {
      const r = await fetch(`/api/jobs/${id}/save`, { method: 'POST', headers: authHeaders() })
      const j = await r.json()
      toast.success(j.saved ? 'Saved' : 'Unsaved')
      load()
    } catch {}
  }

  const message = () => {
    if (!requireAuth('message')) return
    if (job?.poster?.id) router.push(`/inbox?dm=${job.poster.id}`)
  }

  if (loading) return <FieldFrame title="Job" back="/jobs"><div className="py-10 text-center text-sm text-neutral-400">Loading…</div></FieldFrame>
  if (err || !job) return <FieldFrame title="Job" back="/jobs"><div className="px-4 py-10 text-center text-sm text-neutral-500">{err || 'Job not found.'}</div></FieldFrame>

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([job.address, job.city, job.state, job.zip].filter(Boolean).join(' '))}`

  return (
    <FieldFrame
      title="Job / Pickup"
      back="/jobs"
      right={<ReportButton kind="job" targetId={job.id} variant="inline" label="" />}
      bodyClassName="!pb-28"
    >
      <div className="space-y-3 p-3">
        <Card>
          <CardContent className="space-y-2 p-3">
            <header className="flex items-start gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                {(job.poster?.name || '?')[0].toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-sm font-bold">
                  <span className="truncate">{job.poster?.name || 'Someone'}</span>
                  {job.poster?.isVerified && <BadgeCheck className="h-3.5 w-3.5 text-brand-600" />}
                </div>
                <div className="text-[11px] text-neutral-500">{timeAgo(job.createdAt)}</div>
              </div>
              <Badge variant="outline" className="text-[10px]">{job.status}</Badge>
            </header>
            <h1 className="text-base font-extrabold leading-snug text-neutral-900">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {job.urgency && <Badge className="bg-amber-100 text-amber-800"><Clock className="mr-0.5 inline h-2.5 w-2.5" />{job.urgency}</Badge>}
              {job.fixedPriceOffer != null && <Badge className="bg-brand-100 text-brand-800"><DollarSign className="mr-0.5 inline h-2.5 w-2.5" />${job.fixedPriceOffer}</Badge>}
              {job.budgetRange && <Badge variant="outline">{job.budgetRange}</Badge>}
              {job.loadSize && <Badge variant="outline">{job.loadSize} load</Badge>}
            </div>
            {job.description && <p className="whitespace-pre-wrap text-sm text-neutral-800">{job.description}</p>}
            {(job.address || job.city) && (
              <div className="flex items-start gap-1 text-[11px] text-neutral-600">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{[job.address, job.city, job.state, job.zip].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {job.materialTypes?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {job.materialTypes.map((m) => <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>)}
              </div>
            )}
            {job.photos?.length > 0 && (
              <div className="-mx-3 grid grid-cols-1 gap-1">
                {job.photos.map((p, i) => (
                  <div key={i} className="aspect-[4/3] w-full bg-neutral-100"><img src={p} alt="" className="h-full w-full object-cover" loading="lazy" /></div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-2 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>Payments are not active yet — coordinate directly with the poster.</span>
          </CardContent>
        </Card>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-neutral-200 bg-white/95 p-2 backdrop-blur" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" onClick={save} className="h-11 shrink-0 px-3" aria-label="Save"><Bookmark className="h-4 w-4" /></Button>
          <Button variant="outline" asChild className="h-11 shrink-0 px-3">
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label="Directions"><Navigation className="h-4 w-4" /></a>
          </Button>
          <Button onClick={message} className="h-11 flex-1 bg-neutral-900 text-white hover:bg-neutral-800"><MessageCircle className="mr-1 h-4 w-4" /> Message</Button>
          {job.status === 'open' && user?.id !== job.poster?.id && (
            <Button onClick={accept} disabled={actionBusy} className="h-11 flex-1 bg-brand-600 hover:bg-brand-700">
              {actionBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Briefcase className="mr-1 h-4 w-4" />}
              Accept
            </Button>
          )}
        </div>
      </div>
      <SoftLoginModal action={softLogin} onClose={() => setSoftLogin(null)} />
    </FieldFrame>
  )
}
