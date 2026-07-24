'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PageShell from '@/components/PageShell'
import { HeartHandshake, ShieldCheck, ArrowRight, Recycle, Sparkles, CheckCircle2 } from 'lucide-react'

function Inner() {
  const sp = useSearchParams()
  const queued = sp.get('queued') === '1'
  const amount = sp.get('amount') || ''
  const email = sp.get('email') || ''
  return (
    <PageShell active="donate" breadcrumbs={[{ label: 'Donate', href: '/donate' }, { label: 'Thank you' }]} maxWidth="max-w-xl" bg="bg-gradient-to-br from-neutral-50 via-white to-brand-50">
      <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Thank you.</h1>
        <p className="mt-3 text-neutral-600">
          {queued ? (
            <>We’ve logged your support {amount && <>of <b>${amount}</b></>} — secure donation processing is being finalized. We’ll email <b>{email}</b> the moment it goes live so your contribution is the first one through.</>
          ) : (
            <>Your donation {amount && <>of <b>${amount}</b></>} has been received. A receipt is on its way to <b>{email}</b>.</>
          )}
        </p>
        <div className="mt-6 grid gap-2 text-left text-sm">
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3"><Sparkles className="h-4 w-4 text-brand-600" /> Your support funds live facility data, donation routing, and contractor tools.</div>
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3"><ShieldCheck className="h-4 w-4 text-brand-600" /> Powered securely by Stripe.</div>
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700"><Recycle className="h-4 w-4" /> <span>Explore DumpMaps</span></Link>
          <Link href="/donate" className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:border-neutral-400"><HeartHandshake className="h-4 w-4" /> Back to donations <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </PageShell>
  )
}

export default function DonateSuccess() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">Loading…</div>}>
      <Inner />
    </Suspense>
  )
}
