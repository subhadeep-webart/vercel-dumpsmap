'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const TRIGGERS = [
  { key: 'newFacility',     label: 'New facility submission' },
  { key: 'newListing',      label: 'New marketplace listing' },
  { key: 'newJob',          label: 'New job posted' },
  { key: 'reportedContent', label: 'Reported content' },
  { key: 'paymentEvent',    label: 'Payment event' },
  { key: 'claimRequest',    label: 'Facility claim request' },
]

export default function AdminEmailNotifications() {
  const { authFetch } = useAdmin()
  const [s, setS] = useState(null)

  const load = async () => {
    const r = await authFetch('/api/admin/email-settings')
    const j = await r.json()
    setS(j.settings)
  }
  useEffect(() => { load() }, [])

  const save = async (patch) => {
    const r = await authFetch('/api/admin/email-settings', { method: 'PATCH', body: JSON.stringify(patch) })
    const j = await r.json()
    setS(j.settings)
    toast.success('Saved')
  }

  if (!s) return <div className="text-sm text-neutral-500">Loading…</div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Email Notifications</h1>
        <p className="text-sm text-neutral-500">Configure transactional triggers. Actual delivery requires SendGrid or Resend integration.</p>
      </div>

      {/* Provider */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Provider</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold text-neutral-600">Email provider</div>
            <Select value={s.provider || 'none'} onValueChange={(v) => save({ provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (don’t send)</SelectItem>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="resend">Resend</SelectItem>
              </SelectContent>
            </Select>
            {s.provider !== 'none' && (
              <div className="mt-1 text-[11px] text-amber-700">⚠ {s.provider.toUpperCase()} API key required in Integrations.</div>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-neutral-600">From address</div>
            <Input value={s.from || ''} onChange={(e) => setS({ ...s, from: e.target.value })} onBlur={(e) => save({ from: e.target.value })} placeholder="no-reply@dumpmaps.org" />
          </div>
        </CardContent>
      </Card>

      {/* Triggers */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Triggers</CardTitle></CardHeader>
        <CardContent className="divide-y divide-neutral-100">
          {TRIGGERS.map((t) => {
            const cfg = s.triggers?.[t.key] || { enabled: false, recipients: 'admin', custom: '' }
            return (
              <div key={t.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold">{t.label}
                    {cfg.enabled && <Badge variant="outline" className="border-brand-300 bg-brand-50 text-[10px] text-brand-700">ON</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={cfg.recipients} onValueChange={(v) => save({ triggers: { ...s.triggers, [t.key]: { ...cfg, recipients: v } } })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">All admins</SelectItem>
                      <SelectItem value="custom">Custom address</SelectItem>
                    </SelectContent>
                  </Select>
                  {cfg.recipients === 'custom' && (
                    <Input className="w-56" placeholder="alerts@dumpmaps.org" defaultValue={cfg.custom || ''} onBlur={(e) => save({ triggers: { ...s.triggers, [t.key]: { ...cfg, custom: e.target.value } } })} />
                  )}
                  <Switch checked={!!cfg.enabled} onCheckedChange={(v) => save({ triggers: { ...s.triggers, [t.key]: { ...cfg, enabled: v } } })} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
