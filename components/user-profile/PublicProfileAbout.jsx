'use client'

// About tab — bio + a details list of the PUBLIC fields (company, location,
// website, role, member-since). Uses the shared ProfileCard primitive so it
// matches the editor's card styling (tinted icon chip, hover lift, stagger).

import React from 'react'
import { ProfileCard } from '@/components/profile/primitives'
import { PROFILE_TYPE_LABEL } from '@/components/user-profile/public-profile-helpers'
import { Building2, MapPin, Globe, BadgeCheck, CalendarDays, Tag } from 'lucide-react'

// One labelled detail row with a tinted icon chip.
function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</div>
        <div className="text-sm font-medium text-neutral-800 break-words">{children}</div>
      </div>
    </div>
  )
}

function memberSince(createdAt) {
  if (!createdAt) return null
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function PublicProfileAbout({ user }) {
  const location = [user.city, user.state].filter(Boolean).join(', ')
  const joined = memberSince(user.createdAt)
  const profileType = user.profileType ? (PROFILE_TYPE_LABEL[user.profileType] || user.profileType.replace(/_/g, ' ')) : null

  const hasDetails = user.companyName || location || user.website || profileType || joined

  // Bio + the inline detail chips already render in the hero (Facebook style),
  // so About focuses on the fuller "Personal details" card — mirroring FB's
  // "Personal details" section lower on the mobile profile.
  return (
    <div className="space-y-4">
      <ProfileCard title="Personal details" icon={BadgeCheck} index={0}>
        {hasDetails ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {user.companyName && <DetailRow icon={Building2} label="Company">{user.companyName}</DetailRow>}
            {location && <DetailRow icon={MapPin} label="Location">{location}</DetailRow>}
            {profileType && <DetailRow icon={Tag} label="Member type"><span className="capitalize">{profileType}</span></DetailRow>}
            {user.website && (
              <DetailRow icon={Globe} label="Website">
                <a href={user.website} target="_blank" rel="noopener noreferrer nofollow" className="text-green-700 hover:underline">
                  {user.website.replace(/^https?:\/\//, '')}
                </a>
              </DetailRow>
            )}
            {joined && <DetailRow icon={CalendarDays} label="Member since">{joined}</DetailRow>}
          </div>
        ) : (
          <p className="text-sm text-neutral-400">This member hasn't added any details yet.</p>
        )}
      </ProfileCard>
    </div>
  )
}
