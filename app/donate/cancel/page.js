'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PageShell from '@/components/PageShell'
import { XCircle, Heart, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DonateCancelPage() {
  const router = useRouter()
  return (
    <PageShell active="donate" breadcrumbs={[{ label: 'Donate', href: '/donate' }, { label: 'Cancelled' }]} maxWidth="max-w-md">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <XCircle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-extrabold text-neutral-900">Donation cancelled</h1>
        <p className="mt-2 text-sm text-neutral-600">
          No charges were made. Your donation intent was recorded — you can try again any time, or just keep helping by sharing DumpMaps with your neighbors.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button asChild className="bg-brand-600 hover:bg-brand-700">
            <Link href="/donate"><Heart className="mr-1 h-4 w-4" /> Try again</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Back to DumpMaps</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  )
}
