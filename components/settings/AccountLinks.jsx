'use client'

// AccountLinks — the grid of navigational settings tiles (integrations,
// payments, inbox, marketplace, and contractor tools when applicable).

import Link from 'next/link'
import { Cog, CreditCard, Inbox, ShoppingBag, BadgeCheck, ArrowRight } from 'lucide-react'
import { hasContractorAccess } from '@/lib/contractor-access'

function SettingsLink({ href, icon: Icon, title, desc }) {
  return (
    <Link href={href} className="group block rounded-xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-bold text-neutral-900" dangerouslySetInnerHTML={{ __html: title }} />
            <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">{desc}</div>
        </div>
      </div>
    </Link>
  )
}

export default function AccountLinks({ user }) {
  const isContractor = hasContractorAccess(user)

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
      <SettingsLink href="/settings/integrations" icon={Cog} title="Integrations" desc="Connect external services like Stripe + email." />
      <SettingsLink href="/settings/payment-methods" icon={CreditCard} title="Payment methods" desc="Save cards on file for memberships, marketplace, and contractor charges." />
      <SettingsLink href="/inbox" icon={Inbox} title="Inbox &amp; notifications" desc="Messages, alerts, and admin actions." />
      <SettingsLink href="/marketplace/me" icon={ShoppingBag} title="My Marketplace" desc="Your listings, saves, alerts, and stats." />
      {isContractor && (
        <SettingsLink href="/disposal-intelligence" icon={BadgeCheck} title="Contractor tools" desc="Disposal Intelligence + Receipt Center." />
      )}
    </div>
  )
}
