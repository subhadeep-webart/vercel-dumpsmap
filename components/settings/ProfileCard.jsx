'use client'

// ProfileCard — signed-in user summary: avatar, name/email, role badge, and a
// grid of read-only account facts. Presentational; takes the resolved user.

import { Mail, BadgeCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { resolveMarketplaceRole } from '@/lib/marketplace-roles'
import { hasContractorAccess } from '@/lib/contractor-access'

function Row({ label, value }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-neutral-800" title={typeof value === 'string' ? value : undefined}>{value}</div>
    </div>
  )
}

export default function ProfileCard({ user }) {
  const role = resolveMarketplaceRole(user)
  const firstName = (user?.name || user?.email?.split('@')[0] || 'there').split(' ')[0]
  const isContractor = hasContractorAccess(user)

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-extrabold text-brand-700">
            {(firstName[0] || 'U').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-base font-bold text-neutral-900">{user.name || firstName}</div>
              {user.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />}
            </div>
            <div className="flex min-w-0 items-center gap-1 text-xs text-neutral-500"><Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{user.email}</span></div>
          </div>
          <span className="shrink-0 rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-700">{role.label}</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 [&>*]:min-w-0">
          <Row label="Primary profile" value={user.primaryProfile || '—'} />
          <Row label="Verification" value={user.verificationLevel || (user.isVerified ? 'verified' : 'unverified')} />
          <Row label="Role" value={user.role || 'user'} />
          <Row label="Contractor tools" value={isContractor ? 'enabled' : '—'} />
        </div>
      </CardContent>
    </Card>
  )
}
