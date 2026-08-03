'use client'

// Preferences tab — availability status picker, profile visibility toggle,
// notification switches, and the Security card. Availability/visibility save on
// change; each notification switch persists the merged notifications object.

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { SavingHint } from '@/components/profile/primitives'
import SecurityTab from '@/components/profile/SecurityTab'
import { AVAILABILITY_OPTIONS } from '@/constants/profile_constants'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'

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
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Availability status</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-neutral-600">Tap a status to change instantly. Shown on your public profile and to job posters.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {AVAILABILITY_OPTIONS.map((o) => {
              const isActive = current === o.value
              return (
                <button key={o.value}
                  onClick={() => { setForm({ ...form, availabilityStatus: o.value }); save({ availabilityStatus: o.value }, 'Availability') }}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                    isActive ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  {o.Icon && <o.Icon className="h-5 w-5 shrink-0 text-neutral-700" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-neutral-900">{o.label}</div>
                    <div className="text-xs text-neutral-600">{o.desc}</div>
                  </div>
                  {isActive && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Visibility */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Profile visibility</CardTitle></CardHeader>
        <CardContent className="space-y-3">
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
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {NOTIFICATION_OPTIONS.map((opt) => (
            <div key={opt.key} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2">
              <span className="text-sm text-neutral-800">{opt.label}</span>
              <Switch checked={!!notifications[opt.key]} onCheckedChange={(v) => setNotification(opt.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security */}
      <SecurityTab />
      {saving && <SavingHint label={saving} />}
    </div>
  )
}
