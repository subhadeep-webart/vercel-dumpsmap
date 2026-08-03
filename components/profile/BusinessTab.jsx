'use client'

// Business Info tab — bio, company, website, business type/EIN, and the
// independent vs. company-representative toggle. Text fields save on blur;
// the representation toggle saves on click.

import React from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldRow, SavingHint } from '@/components/profile/primitives'
import { Sparkles, Briefcase, Globe, Lock, User } from 'lucide-react'

export default function BusinessTab({ form, setForm, save, saving }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Business information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Bio / About you" icon={Sparkles}>
            <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
              onBlur={() => save({ bio: form.bio }, 'Bio')}
              placeholder="Tell the community who you are and what you do. 1-2 sentences works best." />
          </FieldRow>
          <FieldRow label="Company name" icon={Briefcase}>
            <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              onBlur={() => save({ companyName: form.companyName.trim() }, 'Company name')}
              placeholder="DumpMaps Inc · ABC Hauling · etc." />
          </FieldRow>
          <FieldRow label="Website" icon={Globe}>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
              onBlur={() => save({ website: form.website.trim() }, 'Website')}
              placeholder="example.com" />
          </FieldRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Business type" icon={Briefcase} note="LLC, Sole Prop, Corp, etc.">
              <Input value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                onBlur={() => save({ businessType: form.businessType.trim() }, 'Business type')}
                placeholder="e.g. LLC" />
            </FieldRow>
            <FieldRow label="EIN (optional)" icon={Lock} note="Required for verified business status">
              <Input value={form.ein} onChange={(e) => setForm({ ...form, ein: e.target.value })}
                onBlur={() => save({ ein: form.ein.trim() }, 'EIN')}
                placeholder="XX-XXXXXXX" />
            </FieldRow>
          </div>
          <FieldRow label="Representation" icon={User} note="Are you an individual or representing a company?">
            <div className="flex gap-2">
              {['independent', 'company_representative'].map((v) => (
                <button key={v} type="button"
                  onClick={() => { setForm({ ...form, isRepresentative: v }); save({ isRepresentative: v }, 'Representation') }}
                  className={`flex-1 rounded-lg border p-3 text-left text-sm transition ${form.isRepresentative === v ? 'border-green-500 bg-green-50' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}
                >
                  <div className="font-bold text-neutral-900">{v === 'independent' ? 'Independent' : 'Company Representative'}</div>
                  <div className="text-xs text-neutral-600">{v === 'independent' ? 'Solo contractor / individual' : 'I represent a business'}</div>
                </button>
              ))}
            </div>
          </FieldRow>
          {saving && <SavingHint label={saving} />}
        </CardContent>
      </Card>
    </div>
  )
}
