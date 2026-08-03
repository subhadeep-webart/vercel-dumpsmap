'use client'

// Right-rail sidebar for the profile editor — quick action links, a
// verification status readout, and a settings-hub link card. Purely
// presentational; reads from the `user` record.

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldCheck, Settings, Wallet, Receipt, Inbox, ChevronRight } from 'lucide-react'

// Quick-action shortcuts — each has a leading Lucide icon matching its
// destination and a trailing chevron that slides on hover (see the group-hover
// micro-interaction in SidebarQuickActions).
const QUICK_ACTIONS = [
  { label: 'Settings hub',    href: '/settings',                 icon: Settings },
  { label: 'Payment methods', href: '/settings/payment-methods', icon: Wallet },
  { label: 'My receipts',     href: '/receipts',                 icon: Receipt },
  { label: 'Inbox',           href: '/inbox',                    icon: Inbox },
]

export default function ProfileSidebar({ user }) {
  return (
    <aside className="space-y-4">
      <SidebarQuickActions />
      <SidebarVerificationCard user={user} />
      <SidebarLinkCard
        title="Settings hub"
        href="/settings"
        description="Integrations, payment methods, app preferences"
      />
    </aside>
  )
}

function SidebarQuickActions() {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Quick actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
          <Button key={href} asChild variant="outline"
            className="group w-full justify-between transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-800 active:scale-[0.98]">
            <Link href={href}>
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-neutral-500 transition-colors group-hover:text-green-600" />
                {label}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-green-600" />
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}

function SidebarVerificationCard({ user }) {
  return (
    <Card className={user.verified ? 'border-green-200 bg-green-50/40' : ''}>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-green-600" /> Verification</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between"><span>Email</span>{user.emailVerified ? <Badge className="bg-green-100 text-green-800">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}</div>
        <div className="flex items-center justify-between"><span>Phone</span>{user.phoneVerified ? <Badge className="bg-green-100 text-green-800">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}</div>
        <div className="flex items-center justify-between"><span>Business</span>{user.businessVerified ? <Badge className="bg-green-100 text-green-800">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}</div>
      </CardContent>
    </Card>
  )
}

function SidebarLinkCard({ title, href, description }) {
  return (
    <Card className="transition-colors hover:border-green-200">
      <CardContent className="p-4">
        <Link href={href} className="group flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-neutral-900">{title}</div>
            <div className="text-xs text-neutral-600">{description}</div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-green-600" />
        </Link>
      </CardContent>
    </Card>
  )
}
