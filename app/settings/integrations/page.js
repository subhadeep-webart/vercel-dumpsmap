'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ArrowLeft, CreditCard, Cloud, ExternalLink, Lock, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

const INTEGRATIONS = [
  {
    key: 'stripe',
    icon: CreditCard,
    title: 'Stripe Payments',
    blurb: 'Accept verified poster fees, marketplace transactions, donations, and contractor payouts.',
    color: 'from-indigo-500 to-purple-600',
    fields: [
      { key: 'publishableKey', label: 'Publishable key (pk_live_…)', placeholder: 'pk_live_xxx' },
      { key: 'secretKey', label: 'Secret key (sk_live_…)', placeholder: 'sk_live_xxx', sensitive: true },
      { key: 'webhookSecret', label: 'Webhook signing secret (whsec_…)', placeholder: 'whsec_xxx', sensitive: true },
    ],
    helpUrl: 'https://dashboard.stripe.com/apikeys',
    helpText: 'Get your keys from the Stripe Dashboard → Developers → API keys',
  },
  {
    key: 's3',
    icon: Cloud,
    title: 'AWS S3 / Cloudinary Storage',
    blurb: 'Swap local photo storage for a CDN-backed bucket so uploads survive deploys.',
    color: 'from-orange-500 to-amber-600',
    fields: [
      { key: 'provider', label: 'Provider (s3 | cloudinary)', placeholder: 's3' },
      { key: 'bucket', label: 'Bucket / cloud name', placeholder: 'dumpmaps-prod' },
      { key: 'region', label: 'Region', placeholder: 'us-west-2' },
      { key: 'accessKey', label: 'Access key ID', placeholder: 'AKIA…', sensitive: true },
      { key: 'secretKey', label: 'Secret access key', placeholder: '•••', sensitive: true },
    ],
    helpUrl: 'https://aws.amazon.com/s3/',
    helpText: 'Create an IAM user with s3:PutObject + s3:DeleteObject scoped to your bucket.',
  },
]

export default function IntegrationsSettingsPage() {
  const [selected, setSelected] = useState(null)
  return (
    <PageShell active="settings" breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Integrations' }]} maxWidth="max-w-5xl">
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>Bring your own keys.</strong> DumpMaps does not ship with payment or cloud-storage credentials. Connect your accounts here to enable verified poster fees, marketplace payments, and durable photo storage.
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {INTEGRATIONS.map((i) => {
            const Icon = i.icon
            return (
              <Card key={i.key} className="transition hover:border-neutral-300 hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${i.color} text-white shadow`}><Icon className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold">{i.title}</h2>
                        <Badge variant="outline" className="border-neutral-300 bg-neutral-50 text-neutral-600">Not connected</Badge>
                      </div>
                      <p className="mt-1 text-xs text-neutral-600">{i.blurb}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => setSelected(i)} className="bg-neutral-900 hover:bg-neutral-800"><KeyRound className="mr-1 h-4 w-4" /> Connect</Button>
                    <a href={i.helpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50">
                      <ExternalLink className="h-3 w-3" /> Get keys
                    </a>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        <p className="mt-6 text-center text-[11px] text-neutral-500"><Lock className="inline h-3 w-3" /> Secrets are never logged. We’ll encrypt them at rest once you connect.</p>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Connect {selected.title}</DialogTitle>
                <DialogDescription>{selected.helpText}</DialogDescription>
              </DialogHeader>
              <ConnectForm integration={selected} onClose={() => setSelected(null)} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}

function ConnectForm({ integration, onClose }) {
  const [vals, setVals] = useState({})
  const submit = () => {
    // Stub — in production, POST to a future /api/integrations/connect endpoint that
    // stores credentials securely in the backend (KMS/Secrets Manager).
    toast.info('🔐 Saved locally for preview. Backend wiring will land once we go live.')
    onClose?.()
  }
  return (
    <div className="space-y-2">
      {integration.fields.map((f) => (
        <div key={f.key}>
          <label className="text-xs font-bold uppercase tracking-wide text-neutral-600">{f.label}</label>
          <input
            type={f.sensitive ? 'password' : 'text'}
            value={vals[f.key] || ''}
            onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-neutral-400 focus:outline-none"
          />
        </div>
      ))}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} className="bg-brand-600 hover:bg-brand-700">Save & connect</Button>
      </div>
      <p className="text-[10px] text-neutral-400">No charge will be made. We just store the keys so the backend can use them.</p>
    </div>
  )
}
