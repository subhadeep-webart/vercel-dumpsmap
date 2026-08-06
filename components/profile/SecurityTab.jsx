'use client'

// Security card — change password (validated client-side, POSTed to
// /api/auth/change-password) plus a reset-link fallback. Self-contained: owns
// its own draft state and doesn't touch the shared profile form. Rendered at
// the bottom of the Preferences tab.

import React, { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FieldRow, ProfileCard, profileInputClass } from '@/components/profile/primitives'
import { Lock, Loader2, Save, KeyRound } from 'lucide-react'

export default function SecurityTab() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!current || !next) return toast.error('All fields required')
    if (next.length < 8) return toast.error('New password must be at least 8 characters')
    if (next !== confirm) return toast.error('Passwords do not match')
    setBusy(true)
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next })
      toast.success('Password updated')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (e) {
      // api.post throws ApiError on non-2xx; the server error body is on
      // `e.data`, preserving the old `j.error || 'Update failed'` message.
      toast.error(e?.data?.error || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <ProfileCard index={3} title="Change password" desc="Use at least 8 characters" icon={Lock}>
        <FieldRow label="Current password" icon={Lock}>
          <Input className={profileInputClass} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </FieldRow>
        <FieldRow label="New password" icon={Lock}>
          <Input className={profileInputClass} type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Minimum 8 characters" />
        </FieldRow>
        <FieldRow label="Confirm new password" icon={Lock}>
          <Input className={profileInputClass} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </FieldRow>
        <div className="pt-1">
          <Button onClick={submit} disabled={busy} className="bg-green-700 shadow-sm shadow-green-700/25 transition-all hover:bg-green-800 hover:shadow-md active:scale-95">
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Update password
          </Button>
        </div>
      </ProfileCard>

      <ProfileCard index={4} title="Forgot your password?" desc="Reset it via email instead" icon={KeyRound}>
        <p className="text-sm text-neutral-600">If you can&apos;t remember your current password, use the password reset flow.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link href="/?reset=1">Send reset link to my email</Link>
        </Button>
      </ProfileCard>
    </div>
  )
}
