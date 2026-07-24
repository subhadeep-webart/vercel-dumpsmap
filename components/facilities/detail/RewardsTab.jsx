'use client'

// Rewards tab — partner state (earn/scan CTAs + reward stats) or a non-partner
// empty state. Extracted from app/facilities/[id]/page.js. The RewardStat helper
// is colocated as its only consumer.

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Gift, Trophy, Sparkles, Recycle } from 'lucide-react'

export default function RewardsTab({ facility }) {
  const isPartner = !!facility.rewardsPartner
  return (
    <div className="space-y-4">
      {isPartner ? (
        <Card className="overflow-hidden border-green-300 bg-gradient-to-br from-green-50 via-white to-white">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white shadow">
                <Gift className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <Badge variant="outline" className="border-green-300 bg-green-100 text-[10px] font-bold uppercase tracking-wider text-green-800">
                  <Trophy className="mr-0.5 h-3 w-3" /> Rewards Partner
                </Badge>
                <h2 className="mt-1 text-xl font-extrabold text-neutral-900">Earn while you dump</h2>
                <p className="mt-1 text-sm text-neutral-700">
                  Check in at this facility, scan your receipt, and earn DumpMaps points. Redeem for cashback, fuel cards, or facility credits.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button className="bg-green-700 hover:bg-green-800">
                    <Sparkles className="mr-1.5 h-4 w-4" /> Check In & Earn
                  </Button>
                  <Button asChild variant="outline" className="border-green-300 text-green-800 hover:bg-green-50">
                    <Link href="/receipt-scanner"><Recycle className="mr-1.5 h-4 w-4" /> Scan Receipt</Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <RewardStat label="Points per visit" value={facility.rewardsPointsPerVisit || 25} icon={Sparkles} />
              <RewardStat label="Bonus on receipts" value={`${facility.rewardsReceiptBonus || 50} pts`} icon={Recycle} />
              <RewardStat label="Your balance" value={facility.userRewardsBalance != null ? `${facility.userRewardsBalance} pts` : '— pts'} icon={Trophy} muted />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-neutral-300">
          <CardContent className="space-y-2 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <Gift className="h-6 w-6 text-neutral-400" />
            </div>
            <h3 className="text-base font-bold text-neutral-800">Not a rewards partner yet</h3>
            <p className="text-sm text-neutral-600">
              This facility hasn't joined the DumpMaps Rewards program. Ask them to opt in to start sharing rewards with their regulars.
            </p>
            <Button asChild variant="outline" className="mt-2">
              <Link href="/rewards">Learn about rewards</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function RewardStat({ label, value, icon: Icon, muted }) {
  return (
    <div className={`rounded-xl border p-3 ${muted ? 'border-neutral-200 bg-neutral-50' : 'border-green-200 bg-white'}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        <Icon className={`h-3.5 w-3.5 ${muted ? 'text-neutral-400' : 'text-green-600'}`} /> {label}
      </div>
      <div className={`mt-1 text-xl font-extrabold ${muted ? 'text-neutral-500' : 'text-green-700'}`}>{value}</div>
    </div>
  )
}
