'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'

const MODULES = [
  { key: 'marketplaceEnabled',          label: 'Marketplace' },
  { key: 'jobsEnabled',                 label: 'Jobs & Hot Spots' },
  { key: 'chatEnabled',                 label: 'Chat / Messaging' },
  { key: 'paymentsEnabled',             label: 'Payments' },
  { key: 'facilitySubmissionsEnabled',  label: 'Facility submissions' },
  { key: 'mapEnabled',                  label: 'Map view' },
  { key: 'communityEnabled',            label: 'Community feed' },
]

export default function AdminPlatformSettings() {
  const { authFetch } = useAdmin()
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const r = await authFetch('/api/admin/platform-settings')
    const j = await r.json()
    setS(j.settings)
  }
  useEffect(() => { load() }, [])

  const save = async (patch) => {
    setSaving(true)
    const r = await authFetch('/api/admin/platform-settings', { method: 'PATCH', body: JSON.stringify(patch) })
    const j = await r.json()
    setS(j.settings); setSaving(false)
    toast.success('Saved')
  }

  if (!s) return <div className="text-sm text-neutral-500">Loading…</div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Platform Settings</h1>
        <p className="text-sm text-neutral-500">Master controls. Maintenance mode blocks the public site for non-staff users.</p>
      </div>

      {/* Maintenance Mode */}
      <Card className={s.maintenanceMode ? 'border-red-300 bg-red-50/40' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className={`h-4 w-4 ${s.maintenanceMode ? 'text-red-600' : 'text-neutral-400'}`} />
            Maintenance mode
            {s.maintenanceMode && <Badge variant="outline" className="border-red-400 bg-red-100 text-red-800">ACTIVE</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Block public site for non-staff</div>
              <div className="text-xs text-neutral-500">Staff can still log in. The /admin area is always reachable.</div>
            </div>
            <Switch checked={!!s.maintenanceMode} onCheckedChange={(v) => save({ maintenanceMode: v })} />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-neutral-600">Maintenance message</div>
            <Input
              value={s.maintenanceMessage || ''}
              onChange={(e) => setS({ ...s, maintenanceMessage: e.target.value })}
              onBlur={(e) => save({ maintenanceMessage: e.target.value })}
              placeholder="We'll be back shortly…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Module toggles */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Module toggles</CardTitle></CardHeader>
        <CardContent className="divide-y divide-neutral-100">
          {MODULES.map((m) => (
            <div key={m.key} className="flex items-center justify-between py-2">
              <div className="text-sm font-medium">{m.label}</div>
              <Switch
                checked={!!s.modules?.[m.key]}
                onCheckedChange={(v) => save({ modules: { ...s.modules, [m.key]: v } })}
                disabled={saving}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Facility owner features (platform-wide defaults) */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Facility owner features <span className="text-xs font-normal text-neutral-500">(platform-wide defaults)</span></CardTitle></CardHeader>
        <CardContent className="divide-y divide-neutral-100">
          {[
            ['claimListing',   'Claim listing'],
            ['updatePricing',  'Update pricing'],
            ['postClosures',   'Post closures'],
            ['manageMessages', 'Manage messages'],
            ['paymentPilot',   'Accept payment pilot'],
            ['uploadDocs',     'Upload documents'],
          ].map(([k, label]) => (
            <div key={k} className="flex items-center justify-between py-2">
              <div className="text-sm font-medium">{label}</div>
              <Switch
                checked={!!s.facilityOwnerFeatures?.[k]}
                onCheckedChange={(v) => save({ facilityOwnerFeatures: { ...s.facilityOwnerFeatures, [k]: v } })}
                disabled={saving}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
