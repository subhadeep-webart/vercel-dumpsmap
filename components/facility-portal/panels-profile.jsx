'use client'

// ProfileEditPanel — the EDITABLE account profile, rendered inside the portal's
// "Profile" section. This restores the ability to edit name, email, phone,
// business info, payment, service area, documents, and preferences that the old
// standalone /profile editor had. It reuses the exact same tab components and the
// useProfile hook (SWR-backed load + instant PATCH save), just re-homed into the
// portal with a compact sub-tab bar instead of the full-page shell.

import { useState } from 'react'
import { User, Briefcase, Wallet, MapPin, Image as ImageIcon, Sparkles } from 'lucide-react'
import { useProfile } from '@/hooks/use-profile'
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

export default function ProfileEditPanel() {
  const { status, form, setForm, save, savingField } = useProfile()
  const [tab, setTab] = useState('personal')

  if (status === 'loading' || status === 'redirecting') {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-neutral-200/80 bg-white p-10 text-sm text-neutral-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600" /> Loading your profile…
      </div>
    )
  }

  const Active = (SUBTABS.find((t) => t.key === tab) || SUBTABS[0]).Comp

  return (
    <div className="space-y-4">
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
