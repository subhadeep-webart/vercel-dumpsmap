'use client'

// Right-rail sidebar for the profile editor — quick action links, a
// verification status readout, and a settings-hub link card. Purely
// presentational; reads from the `user` record.

import React from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldCheck, Settings, Wallet, Receipt, Inbox, ChevronRight, Check, Sparkles, PartyPopper } from 'lucide-react'

// Quick-action shortcuts — each has a leading Lucide icon matching its
// destination and a trailing chevron that slides on hover (see the group-hover
// micro-interaction in SidebarQuickActions).
const QUICK_ACTIONS = [
  { label: 'Settings hub',    href: '/settings',                 icon: Settings },
  { label: 'Payment methods', href: '/settings/payment-methods', icon: Wallet },
  { label: 'My receipts',     href: '/receipts',                 icon: Receipt },
  { label: 'Inbox',           href: '/inbox',                    icon: Inbox },
]

// Profile-completion checklist. Each item is scored complete when its `done`
// predicate passes against the live form. `tab` is the profile tab that item
// lives on, so tapping an unfinished item jumps straight there. Order = the
// order shown to the user.
const COMPLETION_ITEMS = [
  { key: 'name',    label: 'Add your name',          tab: 'personal',  done: (f) => !!f.name?.trim() },
  { key: 'phone',   label: 'Add a phone number',     tab: 'personal',  done: (f) => !!f.phone?.trim() },
  { key: 'address', label: 'Add your address',       tab: 'personal',  done: (f) => !!(f.addressLine1?.trim() && f.city?.trim()) },
  { key: 'avatar',  label: 'Upload a profile photo', tab: 'personal',  done: (f) => !!(f.profilePhotoUrl || f.avatarUrl) },
  { key: 'cover',   label: 'Add a cover photo',      tab: 'personal',  done: (f) => !!f.coverImageUrl },
  { key: 'bio',     label: 'Write a short bio',      tab: 'business',  done: (f) => !!f.bio?.trim() },
  { key: 'payment', label: 'Set payment methods',    tab: 'payment',   done: (f) => (f.paymentMethodsAccepted?.length || 0) > 0 },
  { key: 'docs',    label: 'Upload a document',      tab: 'documents', done: (f) => (f.documents?.length || 0) > 0 },
]

export default function ProfileSidebar({ user, form = {}, onNavigate }) {
  return (
    <aside className="space-y-4">
      <SidebarCompletionCard form={form} onNavigate={onNavigate} />
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

// Animated completion meter — a circular progress ring + the next few unfinished
// items as a nudge checklist. The ring fill animates whenever the percentage
// changes (stroke-dashoffset transition), so editing a field feels rewarding.
function SidebarCompletionCard({ form, onNavigate }) {
  // Jump to the tab an item lives on, then scroll to the top so the tab content
  // (and the hero, for avatar/cover) is in view.
  const goTo = (tab) => {
    onNavigate?.(tab)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return <CompletionInner form={form} goTo={goTo} />
}

function CompletionInner({ form, goTo }) {
  const results = COMPLETION_ITEMS.map((it) => ({ ...it, complete: !!it.done(form) }))
  const doneCount = results.filter((r) => r.complete).length
  const total = results.length
  const pct = Math.round((doneCount / total) * 100)
  const remaining = results.filter((r) => !r.complete).slice(0, 3)
  const allDone = doneCount === total

  // SVG ring geometry
  const R = 26
  const C = 2 * Math.PI * R
  const offset = C * (1 - pct / 100)

  return (
    <Card className="overflow-hidden border-neutral-200/80 shadow-sm transition-all duration-300 hover:shadow-md">
      <CardHeader className="border-b border-neutral-100 bg-gradient-to-b from-neutral-50/80 to-transparent py-3">
        <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
          <Sparkles className="h-3.5 w-3.5 text-green-600" /> Profile strength
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Circular progress ring */}
          <div className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
              <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="6" className="text-neutral-100" />
              <circle
                cx="32" cy="32" r={R} fill="none" strokeWidth="6" strokeLinecap="round"
                className={allDone ? 'text-green-500' : 'text-green-600'}
                stroke="currentColor"
                strokeDasharray={C}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-extrabold text-neutral-900">{pct}%</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-bold text-neutral-900">
              {allDone && <PartyPopper className="h-4 w-4 shrink-0 text-green-600" />}
              {allDone ? 'All set!' : 'Complete your profile'}
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">
              {allDone ? 'Your profile looks great.' : `${doneCount} of ${total} done`}
            </div>
          </div>
        </div>

        {!allDone && (
          <ul className="mt-3 space-y-1.5">
            {remaining.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => goTo(r.tab)}
                  className="group/ci flex w-full items-center gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-left text-xs text-neutral-600 transition-all hover:bg-green-50 hover:text-green-800 active:scale-[0.98]"
                >
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-dashed border-neutral-300 transition-colors group-hover/ci:border-green-400" />
                  <span className="flex-1">{r.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-300 transition-all group-hover/ci:translate-x-0.5 group-hover/ci:text-green-600" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {allDone && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 px-2.5 py-2 text-xs font-medium text-green-700 ring-1 ring-green-100">
            <Check className="h-3.5 w-3.5" /> Every section is filled in.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SidebarQuickActions() {
  return (
    <Card className="overflow-hidden border-neutral-200/80 shadow-sm">
      <CardHeader className="border-b border-neutral-100 bg-gradient-to-b from-neutral-50/80 to-transparent py-3"><CardTitle className="text-xs font-bold uppercase tracking-wider text-neutral-500">Quick actions</CardTitle></CardHeader>
      <CardContent className="space-y-1.5 p-3">
        {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href}
            className="group flex items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-green-50 hover:text-green-800 active:scale-[0.98]">
            <span className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 transition-colors group-hover:bg-green-100 group-hover:text-green-600">
                <Icon className="h-4 w-4 shrink-0" />
              </span>
              {label}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-green-600" />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

function VerificationRow({ label, ok }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {ok ? (
        <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
      ) : (
        <Badge variant="outline" className="border-neutral-200 text-neutral-400">Unverified</Badge>
      )}
    </div>
  )
}

function SidebarVerificationCard({ user }) {
  return (
    <Card className={`overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md ${user.verified ? 'border-green-200 bg-green-50/30' : 'border-neutral-200/80'}`}>
      <CardHeader className="border-b border-neutral-100 py-3"><CardTitle className="flex items-center gap-2 text-sm font-bold"><span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-sm shadow-green-600/25"><ShieldCheck className="h-4 w-4" /></span> Verification</CardTitle></CardHeader>
      <CardContent className="space-y-1.5 p-3">
        <VerificationRow label="Email" ok={user.emailVerified} />
        <VerificationRow label="Phone" ok={user.phoneVerified} />
        <VerificationRow label="Business" ok={user.businessVerified} />
      </CardContent>
    </Card>
  )
}

function SidebarLinkCard({ title, href, description }) {
  return (
    <Card className="overflow-hidden border-neutral-200/80 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-green-200 hover:shadow-md">
      <CardContent className="p-4">
        <Link href={href} className="group flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-neutral-900">{title}</div>
            <div className="mt-0.5 text-xs text-neutral-500">{description}</div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-green-600" />
        </Link>
      </CardContent>
    </Card>
  )
}
