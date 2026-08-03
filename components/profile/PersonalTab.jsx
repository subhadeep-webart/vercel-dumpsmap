'use client'

// Personal Info tab — name, email, phone, and full address. Every field saves
// on blur via the shared `save(patch, label)` handler passed from the page.

import React from 'react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldRow, SavingHint } from '@/components/profile/primitives'
import { User, Mail, Phone, MapPin } from 'lucide-react'

export default function PersonalTab({ form, setForm, save, saving }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Personal information</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <FieldRow label="Full name" icon={User}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => save({ name: form.name.trim() }, 'Name')}
            placeholder="e.g. Jane Smith" />
        </FieldRow>
        <FieldRow label="Email" icon={Mail} note="Changing email resets verification status">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            onBlur={() => { const trimmed = form.email.trim().toLowerCase(); if (trimmed) save({ email: trimmed }, 'Email') }} />
        </FieldRow>
        <FieldRow label="Phone" icon={Phone}>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            onBlur={() => save({ phone: form.phone.trim() }, 'Phone')}
            placeholder="(555) 555-5555" />
        </FieldRow>
        <FieldRow label="Address line 1" icon={MapPin}>
          <Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
            onBlur={() => save({ addressLine1: form.addressLine1.trim() }, 'Address')}
            placeholder="123 Main St" />
        </FieldRow>
        <FieldRow label="Address line 2" icon={MapPin}>
          <Input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
            onBlur={() => save({ addressLine2: form.addressLine2.trim() }, 'Address line 2')}
            placeholder="Apt, suite, unit (optional)" />
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-3">
          <FieldRow label="City">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
              onBlur={() => save({ city: form.city.trim() }, 'City')} />
          </FieldRow>
          <FieldRow label="State">
            <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}
              onBlur={() => save({ state: form.state.trim() }, 'State')}
              maxLength={2} placeholder="CA" />
          </FieldRow>
          <FieldRow label="ZIP">
            <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })}
              onBlur={() => save({ zip: form.zip.trim() }, 'ZIP')}
              maxLength={10} />
          </FieldRow>
        </div>
        {saving && <SavingHint label={saving} />}
      </CardContent>
    </Card>
  )
}
