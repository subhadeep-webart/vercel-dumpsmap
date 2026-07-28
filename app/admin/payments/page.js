'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  CreditCard, AlertTriangle, ShieldCheck, KeyRound, Eye, EyeOff, Lock, Trash2,
  CheckCircle2, ExternalLink, Info, Zap, FlaskConical, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import PaymentHealthDashboard from '@/components/admin/PaymentHealthDashboard'

export default function AdminPayments() {
  const { authFetch, isSuperAdmin } = useAdmin()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [edit, setEdit] = useState({}) // staged values

  // input state for the secret/publishable keys
  const [pubInput, setPubInput] = useState('')
  const [secInput, setSecInput] = useState('')
  const [whInput, setWhInput] = useState('')
  const [revealPub, setRevealPub] = useState(false)
  const [revealSec, setRevealSec] = useState(false)
  const [revealWh, setRevealWh] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await authFetch('/api/admin/payment-settings')
    if (r.status === 403) {
      setSettings('forbidden')
      setLoading(false)
      return
    }
    const j = await r.json()
    setSettings(j.settings)
    setEdit({
      mode: j.settings.mode || 'test',
      platformFeePercent: j.settings.platformFeePercent ?? 5,
      payoutsEnabled: !!j.settings.payoutsEnabled,
      marketplacePaymentsEnabled: !!j.settings.marketplacePaymentsEnabled,
      jobsPaymentsEnabled: !!j.settings.jobsPaymentsEnabled,
      donationsEnabled: !!j.settings.donationsEnabled,
      currency: j.settings.currency || 'usd',
      statementDescriptor: j.settings.statementDescriptor || 'DUMPMAPS',
    })
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async (extra = {}) => {
    setSaving(true)
    const body = { ...edit, ...extra }
    if (pubInput.trim() && !pubInput.includes('••')) body.stripePublishableKey = pubInput.trim()
    if (secInput.trim() && !secInput.includes('••')) body.stripeSecretKey = secInput.trim()
    if (whInput.trim() && !whInput.includes('••'))  body.stripeWebhookSecret = whInput.trim()
    const r = await authFetch('/api/admin/payment-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await r.json()
    setSaving(false)
    if (!r.ok) { toast.error(j.error || 'Save failed'); return }
    toast.success('Payment settings saved')
    setPubInput(''); setSecInput(''); setWhInput('')
    load()
  }

  const clearKey = async (key) => {
    if (!confirm(`Clear ${key}? This will disable payment processing if it removes the last secret.`)) return
    const map = {
      publishable: { clearStripePublishableKey: true },
      secret:      { clearStripeSecretKey: true },
      webhook:     { clearStripeWebhookSecret: true },
    }
    await save(map[key])
  }

  if (settings === 'forbidden') {
    return (
      <Card className="border-red-200 bg-red-50/40">
        <CardContent className="flex items-center gap-3 p-6">
          <Lock className="h-5 w-5 text-red-600" />
          <div>
            <div className="text-sm font-bold text-red-900">Super-admin only</div>
            <p className="text-xs text-red-800/80">Payment settings are restricted to super-administrators for security reasons.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading || !settings) {
    return <div className="p-8 text-center text-sm text-neutral-500">Loading payment settings…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <CreditCard className="h-6 w-6 text-brand-600" /> Payments
          </h1>
          <p className="text-sm text-neutral-500">Stripe configuration for marketplace, jobs, and donations. Keys are stored securely server-side and masked here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.configured
            ? <Badge variant="outline" className="border-brand-300 bg-brand-50 text-brand-800"><CheckCircle2 className="mr-1 h-3 w-3" /> Configured</Badge>
            : <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800"><AlertTriangle className="mr-1 h-3 w-3" /> Not configured</Badge>}
          <Badge variant="outline" className={`inline-flex items-center gap-1 ${settings.mode === 'live' ? 'border-red-300 bg-red-50 text-red-800' : 'border-neutral-200 bg-neutral-50 text-neutral-700'}`}>
            {settings.mode === 'live' ? <><Zap className="h-3 w-3" /> Live mode</> : <><FlaskConical className="h-3 w-3" /> Test mode</>}
          </Badge>
        </div>
      </div>

      {/* Banner */}
      {!settings.configured && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex items-start gap-3 p-4">
            <Info className="mt-0.5 h-5 w-5 text-amber-700" />
            <div className="flex-1">
              <div className="text-sm font-bold text-amber-900">Payments not configured yet</div>
              <p className="mt-0.5 text-xs text-amber-900/80">
                Add a Stripe publishable + secret key below to start accepting payments. Until then, DumpMaps shows
                &quot;Payments not configured yet&quot; on Donate / Pay / Featured listings, and writes don&apos;t hit Stripe.
              </p>
              <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline">
                Open Stripe Dashboard <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Health Dashboard (NEW) */}
      <PaymentHealthDashboard paymentSettings={settings} onSettingsChanged={load} />

      {/* Mode + Currency */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Mode &amp; Currency</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-semibold">Mode</div>
            <div className="inline-flex rounded-md border border-neutral-200 p-0.5">
              <button
                onClick={() => setEdit((e) => ({ ...e, mode: 'test' }))}
                className={`inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold transition ${edit.mode === 'test' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
              ><FlaskConical className="h-3 w-3" /> Test</button>
              <button
                onClick={() => { if (confirm('Switch to LIVE mode? Real charges will be made when payments are enabled.')) setEdit((e) => ({ ...e, mode: 'live' })) }}
                className={`inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold transition ${edit.mode === 'live' ? 'bg-red-600 text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
              ><Zap className="h-3 w-3" /> Live</button>
            </div>
            <span className="text-[11px] text-neutral-500">Switch keys when toggling.</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase">Currency</Label>
              <Input value={edit.currency} onChange={(e) => setEdit((s) => ({ ...s, currency: e.target.value.toLowerCase().slice(0, 3) }))} maxLength={3} className="uppercase" />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase">Statement descriptor</Label>
              <Input value={edit.statementDescriptor} onChange={(e) => setEdit((s) => ({ ...s, statementDescriptor: e.target.value.slice(0, 22) }))} maxLength={22} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><KeyRound className="h-4 w-4 text-amber-600" /> Stripe API keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {/* Publishable key */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase">Publishable key</Label>
              {settings.stripePublishableKey && <span className="text-[11px] text-neutral-500">…{settings.publishableKeyLast4}</span>}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={revealPub ? 'text' : 'password'}
                  placeholder={settings.stripePublishableKey ? `pk_${settings.mode}_••••${settings.publishableKeyLast4}` : 'pk_test_…'}
                  value={pubInput}
                  onChange={(e) => setPubInput(e.target.value)}
                  className="pr-10 font-mono text-xs"
                />
                <button onClick={() => setRevealPub((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 hover:bg-neutral-100" aria-label={revealPub ? 'Hide' : 'Show'}>
                  {revealPub ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {settings.stripePublishableKey && (
                <Button variant="outline" size="icon" onClick={() => clearKey('publishable')} className="h-10 w-10 text-red-600 hover:bg-red-50" aria-label="Clear"><Trash2 className="h-3.5 w-3.5" /></Button>
              )}
            </div>
            <p className="mt-1 text-[10px] text-neutral-500">Safe to expose in the browser. Starts with <code>pk_test_</code> or <code>pk_live_</code>.</p>
          </div>

          {/* Secret key */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase">Secret key <Lock className="ml-1 inline h-3 w-3 text-amber-600" /></Label>
              {settings.hasSecretKey && <span className="inline-flex items-center gap-0.5 text-[11px] text-brand-700"><Check className="h-3 w-3" /> Saved</span>}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={revealSec ? 'text' : 'password'}
                  placeholder={settings.hasSecretKey ? settings.stripeSecretKey : 'sk_test_…'}
                  value={secInput}
                  onChange={(e) => setSecInput(e.target.value)}
                  className="pr-10 font-mono text-xs"
                />
                <button onClick={() => setRevealSec((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 hover:bg-neutral-100" aria-label={revealSec ? 'Hide' : 'Show'}>
                  {revealSec ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {settings.hasSecretKey && (
                <Button variant="outline" size="icon" onClick={() => clearKey('secret')} className="h-10 w-10 text-red-600 hover:bg-red-50" aria-label="Clear"><Trash2 className="h-3.5 w-3.5" /></Button>
              )}
            </div>
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-neutral-500"><AlertTriangle className="h-3 w-3" /> Server-side only. Never exposed in the browser. Stored encrypted at rest.</p>
          </div>

          {/* Webhook secret */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase">Webhook signing secret</Label>
              {settings.hasWebhookSecret && <span className="inline-flex items-center gap-0.5 text-[11px] text-brand-700"><Check className="h-3 w-3" /> Saved</span>}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={revealWh ? 'text' : 'password'}
                  placeholder={settings.hasWebhookSecret ? settings.stripeWebhookSecret : 'whsec_…'}
                  value={whInput}
                  onChange={(e) => setWhInput(e.target.value)}
                  className="pr-10 font-mono text-xs"
                />
                <button onClick={() => setRevealWh((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 hover:bg-neutral-100" aria-label={revealWh ? 'Hide' : 'Show'}>
                  {revealWh ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {settings.hasWebhookSecret && (
                <Button variant="outline" size="icon" onClick={() => clearKey('webhook')} className="h-10 w-10 text-red-600 hover:bg-red-50" aria-label="Clear"><Trash2 className="h-3.5 w-3.5" /></Button>
              )}
            </div>
            <p className="mt-1 text-[10px] text-neutral-500">Used to verify incoming webhook events from Stripe.</p>
          </div>
        </CardContent>
      </Card>

      {/* Modules */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Modules &amp; payouts</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow
            label="Marketplace payments"
            desc="Charge buyers + payout sellers via Stripe Connect for marketplace listings."
            value={edit.marketplacePaymentsEnabled}
            onChange={(v) => setEdit((s) => ({ ...s, marketplacePaymentsEnabled: v }))}
          />
          <ToggleRow
            label="Jobs payments"
            desc="Escrow + release contractor payouts for completed jobs."
            value={edit.jobsPaymentsEnabled}
            onChange={(v) => setEdit((s) => ({ ...s, jobsPaymentsEnabled: v }))}
          />
          <ToggleRow
            label="Donations"
            desc="Accept one-time donations on the Donate / Support page."
            value={edit.donationsEnabled}
            onChange={(v) => setEdit((s) => ({ ...s, donationsEnabled: v }))}
          />
          <ToggleRow
            label="Payouts"
            desc="Enable Stripe Connect payouts to verified facility owners and contractors."
            value={edit.payoutsEnabled}
            onChange={(v) => setEdit((s) => ({ ...s, payoutsEnabled: v }))}
          />
          <div className="border-t border-neutral-100 pt-3">
            <Label className="text-xs font-bold uppercase">Platform fee (%)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.5"
                min={0}
                max={50}
                value={edit.platformFeePercent}
                onChange={(e) => setEdit((s) => ({ ...s, platformFeePercent: parseFloat(e.target.value || '0') }))}
                className="w-28"
              />
              <span className="text-[11px] text-neutral-500">0–50%. Applied on top of Stripe&apos;s 2.9% + 30¢.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 border-t border-neutral-200 bg-white px-4 py-3 md:rounded-lg md:border md:bg-white/95 md:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-neutral-500">
            <ShieldCheck className="mr-1 inline h-3 w-3 text-brand-600" /> Super-admin only. Changes are logged in the activity log.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={saving}>Cancel</Button>
            <Button onClick={() => save()} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, desc, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[11px] text-neutral-500">{desc}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  )
}
