'use client'

// ProfileEditPanel — the EDITABLE account profile, rendered inside the portal's
// "Profile" section. This restores the ability to edit name, email, phone,
// business info, payment, service area, documents, and preferences that the old
// standalone /profile editor had. It reuses the exact same tab components and the
// useProfile hook (SWR-backed load + instant PATCH save), just re-homed into the
// portal with a compact sub-tab bar instead of the full-page shell.
//
// The hero band on top carries the profile photo + cover photo uploaders. It was
// written for the old full-page editor and orphaned when that page became the
// portal, which left users with no way to set either image — it's mounted here so
// the portal's Profile section is a complete editor again. Both images upload via
// MediaUploader → POST /api/upload, then persist through the same save() the tabs
// use (PATCH /api/users/me/profile).

import { useState } from 'react'
import Link from 'next/link'
import { User, Briefcase, Wallet, MapPin, Image as ImageIcon, Sparkles, ExternalLink, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProfile } from '@/hooks/use-profile'
import ProfileHero from '@/components/profile/ProfileHero'
import { deriveInitials } from '@/components/profile/primitives'
import { AVAILABILITY_OPTIONS } from '@/constants/profile_constants'
import PersonalTab from '@/components/profile/PersonalTab'
import BusinessTab from '@/components/profile/BusinessTab'
import PaymentsTab from '@/components/profile/PaymentsTab'
import ServiceAreaTab from '@/components/profile/ServiceAreaTab'
import DocumentsTab from '@/components/profile/DocumentsTab'
import PreferencesTab from '@/components/profile/PreferencesTab'
import { Loader2 } from 'lucide-react'

const SUBTABS = [
  { key: 'personal', label: 'Personal', icon: User, Comp: PersonalTab },
  { key: 'business', label: 'Business', icon: Briefcase, Comp: BusinessTab },
  { key: 'payment', label: 'Payment', icon: Wallet, Comp: PaymentsTab },
  { key: 'service-area', label: 'Service Area', icon: MapPin, Comp: ServiceAreaTab },
  { key: 'documents', label: 'Documents', icon: ImageIcon, Comp: DocumentsTab },
  { key: 'preferences', label: 'Preferences', icon: Sparkles, Comp: PreferencesTab },
]

// `facility` is the owner's selected facility, or null for a resident — it only
// decides whether the "View facility page" link is offered alongside the
// personal one.
export default function ProfileEditPanel({ facility = null }) {
  const { status, user, form, setForm, save, savingField } = useProfile()
  const [tab, setTab] = useState('personal')

  if (status === 'loading' || status === 'redirecting') {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-neutral-200/80 bg-white p-10 text-sm text-neutral-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600" /> Loading your profile…
      </div>
    )
  }

  const Active = (SUBTABS.find((t) => t.key === tab) || SUBTABS[0]).Comp

  // Hero inputs. An image has no "save" button of its own (unlike the text inputs
  // in the tabs), so an upload persists immediately. save() folds the server's
  // response back into the form draft itself — including mirroring
  // profilePhotoUrl ↔ avatarUrl — so there's no separate setForm here.
  const availability =
    AVAILABILITY_OPTIONS.find((o) => o.value === form.availabilityStatus) || AVAILABILITY_OPTIONS[0]
  const role = user?.primaryProfile || user?.profileType || 'Member'

  return (
    <div className="space-y-4">
      {/* Photo + cover band. Full-bleed inside the card, so the cover meets the
          card edges the way it does on the public profile. */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
        <ProfileHero
          user={user || {}}
          form={form}
          availability={availability}
          role={role}
          initials={deriveInitials(user?.name || user?.email)}
          onChangeCover={(url) => save({ coverImageUrl: url }, 'Cover photo')}
          // profilePhotoUrl is the canonical field; useProfile.save() mirrors it
          // to avatarUrl so legacy surfaces (Marketplace, Community) still read it.
          onChangeAvatar={(url) => save({ profilePhotoUrl: url }, 'Profile photo')}
        />

        {/* See it the way everyone else does.
            A facility owner has TWO public pages and they are not
            interchangeable: the facility listing customers find on the map, and
            their personal account page. Offer whichever exist rather than
            guessing — a resident only ever has the personal one.
            `/users/me` is resolved server-side from the session, so it needs no
            id and works before the profile fetch resolves. New tab either way,
            so the editor isn't lost. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3">
          <p className="text-xs text-neutral-500">
            {facility
              ? 'See how your facility and your account look to other people.'
              : 'This is how your profile looks to other people on DumpMaps.'}
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            {facility && (
              <Link href={`/facilities/${facility.id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> View facility page
                </Button>
              </Link>
            )}
            <Link href="/users/me" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> View public profile
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-neutral-200/80 bg-white p-1.5 shadow-sm">
        {SUBTABS.map((t) => {
          const Icon = t.icon
          const active = t.key === tab
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Active tab editor — keyed so it re-mounts (fade) per tab. */}
      <div key={tab} className="dm-tab-panel rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
        <Active form={form} setForm={setForm} save={save} saving={savingField} />
      </div>
    </div>
  )
}
