'use client'

// Panels for the sidebar sections that aren't a single existing card:
//   - DashboardPanel : the overview landing panel (a broad summary — pricing,
//                      wait/capacity, and recent activity together)
//   - ProfilePanel   : facility identity + details (read view of the hero data)
//   - PhotosPanel    : facility gallery + add-photo
//   - CashbackPanel  : promotions (stub — "coming soon", per dev doc §5)
//
// The other sections (pricing, wait, hours, announcements, activity) reuse the
// existing cards directly from FacilityPortal, so they aren't duplicated here.

import { Image as ImageIcon, BadgePercent, MapPin, Phone, Globe, ShieldCheck } from 'lucide-react'
import PortalCard from './PortalCard'
import PricingCard from './cards/PricingCard'
import WaitCapacityCard from './cards/WaitCapacityCard'
import ActivityCard from './cards/ActivityCard'
import { memberSince } from './portal-helpers'
import SettingsProfileCard from '@/components/settings/ProfileCard'
import AccountLinks from '@/components/settings/AccountLinks'
import LayoutPreferenceCard from '@/components/settings/LayoutPreferenceCard'
import SignOutButton from '@/components/settings/SignOutButton'

// ── Dashboard (overview) ──────────────────────────────────────────────────────
// A broad-view landing panel so the user sees the whole picture at a glance, then
// drills into a specific section via the sidebar.
export function DashboardPanel({ facility, saving, onSavePricing, onSaveOwner }) {
  return (
    <>
      <PricingCard facility={facility} saving={saving === 'pricing'} onSave={(p) => onSavePricing(p)} />
      <WaitCapacityCard facility={facility} saving={saving === 'wait'} onSave={(p) => onSaveOwner(p, { label: 'Wait time', key: 'wait' })} />
      <ActivityCard facility={facility} />
    </>
  )
}

// ── Profile (identity + details) ──────────────────────────────────────────────
export function ProfilePanel({ facility }) {
  if (!facility) return null
  const rows = [
    { icon: MapPin, label: 'Address', value: facility.address || [facility.city, facility.state, facility.zip].filter(Boolean).join(', ') },
    { icon: Phone, label: 'Phone', value: facility.phone },
    { icon: Globe, label: 'Website', value: facility.website },
  ].filter((r) => r.value)

  return (
    <PortalCard id="profile" title="Facility Details">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold text-neutral-900">{facility.name}</span>
          {facility.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-green-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified Facility
            </span>
          )}
        </div>
        <dl className="divide-y divide-neutral-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 py-2.5 text-sm">
              <r.icon className="h-4 w-4 shrink-0 text-neutral-400" />
              <dt className="w-24 shrink-0 text-neutral-500">{r.label}</dt>
              <dd className="min-w-0 flex-1 truncate font-medium text-neutral-800">{r.value}</dd>
            </div>
          ))}
          <div className="flex items-center gap-3 py-2.5 text-sm">
            <span className="w-4" />
            <dt className="w-24 shrink-0 text-neutral-500">Facility ID</dt>
            <dd className="min-w-0 flex-1 truncate font-medium text-neutral-800">{facility.id}</dd>
          </div>
          {memberSince(facility.createdAt) && (
            <div className="flex items-center gap-3 py-2.5 text-sm">
              <span className="w-4" />
              <dt className="w-24 shrink-0 text-neutral-500">Member since</dt>
              <dd className="min-w-0 flex-1 font-medium text-neutral-800">{memberSince(facility.createdAt)}</dd>
            </div>
          )}
        </dl>
      </div>
    </PortalCard>
  )
}

// ── Photos ────────────────────────────────────────────────────────────────────
export function PhotosPanel({ facility }) {
  const photos = [...(facility?.photos || []), ...(facility?.images || [])].filter(Boolean)
  return (
    <PortalCard id="photos" title="Photos">
      {photos.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((src, i) => (
            <div key={i} className="aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Facility photo ${i + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-200 p-8 text-center">
          <ImageIcon className="h-8 w-8 text-neutral-300" />
          <p className="text-sm text-neutral-500">No photos yet.</p>
        </div>
      )}
    </PortalCard>
  )
}

// ── Cashback (stub) ───────────────────────────────────────────────────────────
export function CashbackPanel() {
  return (
    <PortalCard id="cashback" title="Cashback Offers">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-200 p-8 text-center">
        <BadgePercent className="h-8 w-8 text-neutral-300" />
        <p className="text-sm font-semibold text-neutral-700">Cashback offers are coming soon</p>
        <p className="max-w-sm text-xs text-neutral-500">Set up promotions and incentives to bring more drivers to your facility.</p>
      </div>
    </PortalCard>
  )
}

// ── Account Settings ──────────────────────────────────────────────────────────
// The former /settings page, rendered INSIDE the portal so the sidebar's
// "Account Settings" item stays in the same layout instead of navigating away.
// Reuses the exact settings components (account info, links, layout preference,
// sign-out) — one source of truth.
export function SettingsPanel({ user }) {
  return (
    <div className="space-y-5">
      <SettingsProfileCard user={user} />
      <AccountLinks user={user} />
      <LayoutPreferenceCard />
      <SignOutButton />
    </div>
  )
}
