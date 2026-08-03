'use client'

// Body layout for the profile editor — the active tab's content in the main
// column and the sidebar in the right rail. Owns the activeTab → tab-component
// switch so the page doesn't have to import every tab; it just passes the shared
// form/save props straight through.

import React from 'react'
import ProfileSidebar from '@/components/profile/ProfileSidebar'
import PersonalTab from '@/components/profile/PersonalTab'
import BusinessTab from '@/components/profile/BusinessTab'
import PaymentsTab from '@/components/profile/PaymentsTab'
import ServiceAreaTab from '@/components/profile/ServiceAreaTab'
import DocumentsTab from '@/components/profile/DocumentsTab'
import PreferencesTab from '@/components/profile/PreferencesTab'

// Map each tab key to its component. Keeping this as a lookup (rather than a
// chain of &&s) means adding a tab is a one-line change here + in TABS.
const TAB_COMPONENTS = {
  personal: PersonalTab,
  business: BusinessTab,
  payment: PaymentsTab,
  'service-area': ServiceAreaTab,
  documents: DocumentsTab,
  preferences: PreferencesTab,
}

export default function ProfileBody({ activeTab, user, form, setForm, save, savingField }) {
  const ActiveTab = TAB_COMPONENTS[activeTab] || PersonalTab
  return (
    <main className="container mx-auto grid gap-6 px-4 py-6 pb-28 md:grid-cols-3 md:pb-10">
      <div className="space-y-4 md:col-span-2">
        <ActiveTab form={form} setForm={setForm} save={save} saving={savingField} />
      </div>

      {/* Sidebar — quick stats / shortcuts */}
      <ProfileSidebar user={user} />
    </main>
  )
}
