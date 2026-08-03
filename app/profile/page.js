'use client'

// /profile — DumpMaps unified Profile editor (Phase 1 redesign)
// ----------------------------------------------------------------------------
// Single comprehensive profile page. Every authenticated user lands here to
// manage personal info, business details, payments, service area, documents,
// and preferences (availability, visibility, notifications, security).
//
// This page is purely presentational: all data loading + saving lives in the
// useProfile hook (SWR-backed fetch, auth-redirect, save/mutate), and the three
// visual regions are their own components — ProfileHero, ProfileTabsNav, and
// ProfileBody (which owns the active-tab switch + sidebar). The page just holds
// the active-tab state and wires them together.
//
// Layout:
//   ┌────────────────────────────────────────┐
//   │ Cover image (with edit overlay)        │  → ProfileHero
//   │ Avatar  Name | Role | Verified         │
//   │         Availability status pill       │
//   ├────────────────────────────────────────┤
//   │ Tabs: Personal · Business · …          │  → ProfileTabsNav
//   ├────────────────────────────────────────┤
//   │ Active tab content        │  Sidebar   │  → ProfileBody
//   └────────────────────────────────────────┘
//
// All edits save immediately (PATCH /api/users/me/profile) with toast feedback.

import React, { useState } from 'react'
import PageShell from '@/components/PageShell'

import { AVAILABILITY_OPTIONS } from '@/constants/profile_constants'
import { useProfile } from '@/hooks/use-profile'
import { deriveInitials } from '@/components/profile/primitives'
import { ProfileSkeleton, ProfileError } from '@/components/profile/ProfileStates'
import ProfileHero from '@/components/profile/ProfileHero'
import ProfileTabsNav from '@/components/profile/ProfileTabsNav'
import ProfileBody from '@/components/profile/ProfileBody'

export default function ProfilePage() {
  const { status, user, form, setForm, save, savingField, retry } = useProfile()
  const [activeTab, setActiveTab] = useState('personal')

  // 'redirecting' resolves to a login bounce inside the hook; show the skeleton
  // meanwhile so there's no flash of the error card.
  if (status === 'loading' || status === 'redirecting') return <ProfileSkeleton />
  if (status !== 'ready' || !user) return <ProfileError onRetry={retry} />

  const initials = deriveInitials(user.name || user.email)
  const role = (user.role || 'user').replace(/_/g, ' ')
  const availability = AVAILABILITY_OPTIONS.find((o) => o.value === form.availabilityStatus) || AVAILABILITY_OPTIONS[0]

  return (
    <PageShell active="profile" maxWidth={null} padding="" bg="bg-neutral-50"
      breadcrumbs={[{ label: 'Profile' }]}
    >
      <ProfileHero
        user={user}
        form={form}
        availability={availability}
        onChangeCover={(url) => save({ coverImageUrl: url }, 'Cover photo')}
        onChangeAvatar={(url) => save({ avatarUrl: url }, 'Profile photo')}
        initials={initials}
        role={role}
      />

      <ProfileTabsNav activeTab={activeTab} onChange={setActiveTab} />

      <ProfileBody
        activeTab={activeTab}
        user={user}
        form={form}
        setForm={setForm}
        save={save}
        savingField={savingField}
      />
    </PageShell>
  )
}
