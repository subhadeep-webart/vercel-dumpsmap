'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, ArrowLeft, BadgeCheck, MapPin, MessageCircle } from 'lucide-react'
import ContractorReviewDialog from '@/components/recommendations/ContractorReviewDialog'
import StartDmButton from '@/components/messaging/StartDmButton'
import { timeAgo } from '@/lib/community-categories'
import PageShell from '@/components/PageShell'

export default function ContractorProfilePage() {
  const params = useParams()
  const id = params.id
  const [data, setData] = useState(null)
  const [user, setUser] = useState(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [editingReview, setEditingReview] = useState(null)
  const [token, setToken] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setToken(typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null)
  }, [])

  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  useEffect(() => { if (token) fetch('/api/auth/me', { headers }).then((r) => r.json()).then((j) => setUser(j.user || null)).catch(() => {}) /* eslint-disable-line */ }, [token])

  const load = async () => {
    const r = await fetch(`/api/recommendations/contractors/${id}`)
    if (!r.ok) { setData('not_found'); return }
    const j = await r.json()
    setData(j)
  }
  useEffect(() => { if (id) load() /* eslint-disable-line */ }, [id])

  if (data === 'not_found') return <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">Contractor not found.</div>
  if (!data) return <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">Loading…</div>

  const c = data.contractor
  const myReview = data.reviews.find((r) => r.authorId === user?.id)

  return (
    <PageShell active="feed" breadcrumbs={[{ label: 'Recommendations', href: '/recommendations' }, { label: 'Contractors', href: '/recommendations/contractors' }, { label: 'Profile' }]} maxWidth="max-w-3xl">
      <div className="container mx-auto space-y-3 px-4 py-4">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white">{(c.name || '?')[0].toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <h1 className="flex items-center gap-1 text-xl font-extrabold leading-tight md:text-2xl">
                  {c.name}
                  {(c.verificationLevel === 'verified_contractor' || c.verificationLevel === 'verified_facility_owner') && <BadgeCheck className="h-5 w-5 text-blue-600" />}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-600">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    {c.contractorRating ? c.contractorRating.toFixed(1) : 'No rating yet'}
                    {c.contractorReviewCount > 0 && <span className="text-neutral-500">({c.contractorReviewCount} review{c.contractorReviewCount === 1 ? '' : 's'})</span>}
                  </span>
                  {c.completedJobs > 0 && <span>· {c.completedJobs} completed jobs</span>}
                  {c.city && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {c.city}{c.state ? `, ${c.state}` : ''}</span>}
                </div>
                {c.bio && <p className="mt-2 text-sm text-neutral-700">{c.bio}</p>}
                {Array.isArray(c.services) && c.services.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.services.map((s, i) => <Badge key={i} variant="outline">{s}</Badge>)}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {token && user?.id !== c.id && (
                <StartDmButton targetUserId={c.id} targetUserName={c.name} currentUser={user} token={token} className="bg-blue-600 text-white hover:bg-blue-700" />
              )}
              {token && user?.id !== c.id && (
                <Button onClick={() => { setEditingReview(myReview || null); setReviewOpen(true) }} variant={myReview ? 'outline' : 'default'} className={myReview ? '' : 'bg-amber-500 hover:bg-amber-600'}>
                  <Star className="mr-1 h-4 w-4" /> {myReview ? 'Edit your review' : 'Leave a review'}
                </Button>
              )}
              {!token && <p className="text-xs text-neutral-500">Log in to message or review this contractor.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-700">Reviews</h2>
              <span className="text-xs text-neutral-500">{data.aggregate.count} total</span>
            </div>
            {data.aggregate.count > 0 && (
              <div className="mb-3 grid gap-0.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const n = data.aggregate.distribution[star] || 0
                  const pct = data.aggregate.count ? Math.round((n / data.aggregate.count) * 100) : 0
                  return (
                    <div key={star} className="flex items-center gap-2 text-[11px]">
                      <span className="w-3 text-right text-neutral-500">{star}</span>
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <div className="flex-1 overflow-hidden rounded bg-neutral-100">
                        <div className="h-1.5 rounded bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-neutral-500">{n}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {data.reviews.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-neutral-500">No reviews yet. Be the first 📝</div>
            )}
            <div className="space-y-2">
              {data.reviews.map((r) => (
                <div key={r.id} className="rounded-lg border border-neutral-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-neutral-400 to-neutral-600 text-xs font-bold text-white">{(r.author?.name || '?')[0].toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-sm font-semibold">{r.author?.name || 'User'}</div>
                      <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                        <span className="inline-flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3 w-3 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}`} />)}</span>
                        · {timeAgo(r.createdAt)}
                        {r.jobType && <span>· {r.jobType}</span>}
                      </div>
                    </div>
                  </div>
                  {r.text && <p className="mt-1.5 whitespace-pre-wrap text-sm text-neutral-700">{r.text}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ContractorReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        contractorId={c.id}
        contractorName={c.name}
        token={token}
        existing={editingReview}
        onSaved={() => { setReviewOpen(false); load() }}
      />
    </PageShell>
  )
}
