'use client'

// Preferences tab — availability status picker, profile visibility toggle,
// notification switches, and the Security card. Availability/visibility save on
// change; each notification switch persists the merged notifications object.

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { SavingHint, ProfileCard } from '@/components/profile/primitives'
import SecurityTab from '@/components/profile/SecurityTab'
import { AVAILABILITY_OPTIONS } from '@/constants/profile_constants'
import { Eye, EyeOff, CheckCircle2, Sparkles, Bell } from 'lucide-react'

const NOTIFICATION_OPTIONS = [
  { key: 'email',            label: 'Email notifications' },
  { key: 'sms',              label: 'SMS notifications' },
  { key: 'push',             label: 'Push notifications' },
  { key: 'newJobs',          label: 'New jobs near me' },
  { key: 'newBounties',      label: 'New bounty campaigns' },
  { key: 'rewardsEarned',    label: 'When I earn rewards' },
  { key: 'workOrderUpdates', label: 'Work order updates' },
]

export default function PreferencesTab({ form, setForm, save, saving }) {
  const current = form.availabilityStatus || 'available'
  const isPublic = (form.profileVisibility || 'public') === 'public'
  const notifications = form.notifications || {}

  const setNotification = (key, value) => {
    const next = { ...notifications, [key]: value, _existing: notifications }
    setForm({ ...form, notifications: { ...notifications, [key]: value } })
    save({ notifications: next }, 'Notifications')
  }

  return (
    <div className="space-y-4">
      {/* Availability */}
      <ProfileCard index={0} title="Availability status" desc="Tap a status to change instantly — shown on your public profile and to job posters" icon={Sparkles}>
        <div className="grid gap-2 sm:grid-cols-2">
          {AVAILABILITY_OPTIONS.map((o) => {
            const isActive = current === o.value
            return (
              <button key={o.value}
                onClick={() => { setForm({ ...form, availabilityStatus: o.value }); save({ availabilityStatus: o.value }, 'Availability') }}
                className={`group/av flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200 active:scale-[0.98] ${
                  isActive ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-green-300 hover:shadow-sm'
                }`}
              >
                {o.Icon && <o.Icon className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover/av:scale-110 ${isActive ? 'text-green-600' : 'text-neutral-700'}`} />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-neutral-900">{o.label}</div>
                  <div className="text-xs text-neutral-600">{o.desc}</div>
                </div>
                {isActive && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />}
              </button>
            )
          })}
        </div>
      </ProfileCard>

      {/* Visibility */}
      <ProfileCard index={1} title="Profile visibility" desc="Control who can find and view your profile" icon={Eye}>
        <div className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isPublic ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-neutral-500" />}
              <span className="text-sm font-bold text-neutral-900">{isPublic ? 'Public profile' : 'Private profile'}</span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-600">
              {isPublic ? 'Anyone can find and view your profile.' : 'Only people you connect with can see your details.'}
            </p>
          </div>
          <Switch checked={isPublic} onCheckedChange={(v) => {
            const next = v ? 'public' : 'private'
            setForm({ ...form, profileVisibility: next })
            save({ profileVisibility: next }, 'Visibility')
          }} />
        </div>
      </ProfileCard>

      {/* Notifications */}
      <ProfileCard index={2} title="Notifications" desc="Choose which updates you want to receive" icon={Bell} bodyClassName="space-y-2">
        {NOTIFICATION_OPTIONS.map((opt) => (
          <div key={opt.key} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2 transition-colors hover:border-green-200 hover:bg-green-50/40">
            <span className="text-sm text-neutral-800">{opt.label}</span>
            <Switch checked={!!notifications[opt.key]} onCheckedChange={(v) => setNotification(opt.key, v)} />
          </div>
        ))}
      </ProfileCard>

      {/* Security */}
      <SecurityTab />
      {saving && <SavingHint label={saving} />}
    </div>
  )
}
