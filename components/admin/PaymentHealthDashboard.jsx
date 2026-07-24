'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Webhook, Heart,
  TrendingUp, DollarSign, Users, Target, ShieldCheck, KeyRound, Wifi, WifiOff,
  Loader2, Copy, Info, Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAdmin } from '@/components/admin/AdminContext'

const fmtMoney = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—'

function StatusPill({ ok, label, sublabel, icon: Icon }) {
  return (
    <div className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${ok ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      <div className="leading-tight">
        <div className="font-bold">{label}</div>
        {sublabel && <div className="text-[10px] opacity-75">{sublabel}</div>}
      </div>
    </div>
  )
}

function Metric({ label, value, sublabel, icon: Icon, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-neutral-200 bg-white',
    brand: 'border-brand-200 bg-brand-50',
    amber: 'border-amber-200 bg-amber-50',
    red: 'border-red-200 bg-red-50',
  }
  return (
    <div className={`flex-1 min-w-[140px] rounded-lg border p-2.5 ${tones[tone] || tones.neutral}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-neutral-500">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className="mt-0.5 text-xl font-extrabold text-neutral-900">{value}</div>
      {sublabel && <div className="text-[10px] text-neutral-500">{sublabel}</div>}
    </div>
  )
}

function ProgressBar({ value, label }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-neutral-600">
        <span>{label}</span>
        <span className="font-bold">{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full bg-brand-600 transition-all" style={{ width: `${Math.min(100, value || 0)}%` }} />
      </div>
    </div>
  )
}

export default function PaymentHealthDashboard({ paymentSettings, onSettingsChanged }) {
  const { authFetch, isSuperAdmin } = useAdmin()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [monthlyGoal, setMonthlyGoal] = useState('')
  const [yearlyGoal, setYearlyGoal] = useState('')
  const [savingGoals, setSavingGoals] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [syncLookback, setSyncLookback] = useState(30)

  const load = async () => {
    setLoading(true)
    try {
      const r = await authFetch('/api/admin/payment-health')
      if (!r.ok) { setData(null); return }
      const j = await r.json()
      setData(j)
      setMonthlyGoal(String(j.donations?.monthlyGoal || ''))
      setYearlyGoal(String(j.donations?.yearlyGoal || ''))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [])

  const runConnectionTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      const r = await authFetch('/api/admin/payment-health/test-connection', { method: 'POST' })
      const j = await r.json()
      setTestResult(j)
      if (j.ok) toast.success('Stripe connection OK')
      else toast.error(j.message || 'Stripe connection failed')
      load()
    } catch (e) {
      toast.error('Connection test failed: ' + (e?.message || 'network'))
    } finally { setTesting(false) }
  }

  const verifySetup = async () => {
    setVerifying(true); setVerifyResult(null)
    try {
      const r = await authFetch('/api/admin/payment-health/verify-setup', { method: 'POST' })
      const j = await r.json()
      setVerifyResult(j)
      if (j.allOk) toast.success('All Stripe keys look valid')
      else if (j.anyMissing) toast.error('One or more Stripe keys are missing')
      else toast.error('One or more Stripe keys have an invalid shape')
    } catch (e) {
      toast.error('Verify failed: ' + (e?.message || 'network'))
    } finally { setVerifying(false) }
  }

  const saveGoals = async () => {
    setSavingGoals(true)
    try {
      const r = await authFetch('/api/admin/payment-health/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyDonationGoal: Number(monthlyGoal) || 0,
          yearlyDonationGoal: Number(yearlyGoal) || 0,
        }),
      })
      if (r.ok) { toast.success('Goals saved'); load() }
      else { const j = await r.json().catch(() => ({})); toast.error(j.error || 'Save failed') }
    } finally { setSavingGoals(false) }
  }

  const runSync = async (dryRun) => {
    setSyncing(true); setSyncResult(null)
    try {
      const r = await authFetch('/api/admin/payment-health/sync-from-stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookbackDays: Number(syncLookback) || 30, dryRun: !!dryRun }),
      })
      const j = await r.json()
      setSyncResult(j)
      if (!r.ok || j.ok === false) {
        toast.error(j.message || (j.errors?.[0]?.message) || 'Sync failed')
      } else if (dryRun) {
        toast.success(`Preview: ${j.newDonations} new donation${j.newDonations === 1 ? '' : 's'} would be imported`)
      } else {
        toast.success(`Synced ${j.newDonations} new donation${j.newDonations === 1 ? '' : 's'} from Stripe`)
        load()
      }
    } catch (e) {
      toast.error('Sync failed: ' + (e?.message || 'network'))
    } finally { setSyncing(false) }
  }

  if (!isSuperAdmin) {
    return (
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-amber-900">
          <ShieldCheck className="h-4 w-4" /> Payment Health is restricted to super-administrators.
        </CardContent>
      </Card>
    )
  }
  if (loading || !data) {
    return <div className="rounded-md border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading payment health…</div>
  }

  const s = data.stripe
  const w = data.webhooks
  const d = data.donations
  const isConnected = s.configured

  return (
    <div className="space-y-4">
      {/* --- Section 1: Payment Health Dashboard ---------------------------- */}
      <Card className="border-neutral-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-brand-600" /> Payment Health Dashboard
          </CardTitle>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="h-8">
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Status row */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              ok={isConnected}
              icon={isConnected ? Wifi : WifiOff}
              label={isConnected ? 'Connected' : 'Disconnected'}
              sublabel={isConnected ? `Mode: ${s.environment}` : 'Add Stripe keys above to connect'}
            />
            <StatusPill
              ok={s.environment === 'test'}
              icon={s.environment === 'live' ? AlertTriangle : ShieldCheck}
              label={s.environment === 'live' ? 'LIVE MODE' : 'TEST MODE'}
              sublabel={s.environment === 'live' ? '⚠ Real charges' : 'Safe — test keys only'}
            />
            <StatusPill
              ok={!data.failures.failedTransactions && !data.failures.failedWebhooks}
              icon={data.failures.failedTransactions || data.failures.failedWebhooks ? XCircle : CheckCircle2}
              label={`${data.failures.failedTransactions} failed tx · ${data.failures.failedWebhooks} failed webhooks`}
            />
            <Badge variant="outline" className="text-[11px]">Last sync: {fmtDate(data.lastStripeSyncAt)}</Badge>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={runConnectionTest} disabled={testing} className="bg-brand-600 hover:bg-brand-700">
              {testing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wifi className="mr-1 h-4 w-4" />}
              Run Connection Test
            </Button>
            <Button onClick={verifySetup} disabled={verifying} variant="outline">
              {verifying ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />}
              Verify Stripe Setup
            </Button>

            {/* Sync from Stripe — backfill missed donations */}
            <div className="ml-auto flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-1.5 py-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Last</label>
              <select
                value={syncLookback}
                onChange={(e) => setSyncLookback(Number(e.target.value))}
                disabled={syncing}
                className="h-7 rounded border border-neutral-200 bg-white px-1 text-xs font-semibold"
              >
                <option value={7}>7d</option>
                <option value={30}>30d</option>
                <option value={60}>60d</option>
                <option value={90}>90d</option>
              </select>
              <Button onClick={() => runSync(true)} disabled={syncing} variant="ghost" size="sm" className="h-7 px-2 text-xs">
                {syncing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : 'Preview'}
              </Button>
              <Button onClick={() => runSync(false)} disabled={syncing} size="sm" className="h-7 bg-emerald-600 px-2.5 text-xs hover:bg-emerald-700">
                {syncing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
                Sync from Stripe
              </Button>
            </div>
          </div>

          {/* Sync result inline */}
          {syncResult && (
            <div className={`rounded-md border p-2.5 text-xs ${syncResult.ok !== false ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-start gap-2">
                {syncResult.ok !== false ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />}
                <div className="flex-1">
                  <div className="font-bold text-neutral-900">
                    {syncResult.ok === false ? 'Sync failed' : syncResult.dryRun ? 'Sync preview' : 'Sync complete'}
                    {' · '}
                    <span className="font-normal text-neutral-600">last {syncResult.lookbackDays || 30}d</span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-4">
                    <div><b>{syncResult.scannedSessions || 0}</b> scanned</div>
                    <div className="text-emerald-800"><b>{syncResult.newDonations || 0}</b> {syncResult.dryRun ? 'would import' : 'imported'}</div>
                    <div className="text-neutral-600"><b>{syncResult.alreadyRecorded || 0}</b> already recorded</div>
                    <div className="text-neutral-600"><b>{syncResult.skippedIncomplete || 0}</b> skipped</div>
                  </div>
                  {(syncResult.errors || []).length > 0 && (
                    <div className="mt-1 text-red-800">
                      Errors: {syncResult.errors.map((e) => e.message).join(' · ')}
                    </div>
                  )}
                  {(syncResult.details || []).length > 0 && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-neutral-500 hover:text-neutral-800">Details ({syncResult.details.length})</summary>
                      <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto rounded border border-neutral-200 bg-white p-1.5">
                        {syncResult.details.map((d) => (
                          <div key={d.sessionId} className="flex items-center justify-between gap-2 border-b border-neutral-100 py-0.5 last:border-b-0">
                            <span className="truncate font-mono text-[10px] text-neutral-600">{d.sessionId}</span>
                            <span className="font-bold text-emerald-700">{fmtMoney(d.amount)}</span>
                            <span className="truncate text-[10px] text-neutral-500">{d.email || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Test result inline */}
          {testResult && (
            <div className={`rounded-md border p-2.5 text-xs ${testResult.ok ? 'border-brand-200 bg-brand-50 text-brand-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <div className="flex items-start gap-2">
                {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />}
                <div className="flex-1">
                  <div className="font-bold">{testResult.ok ? '✅ Connected' : '❌ ' + (testResult.status || 'Failed')}</div>
                  <div className="mt-0.5 opacity-80">{testResult.message}</div>
                  {testResult.keyEnvironment && <div className="mt-0.5 text-[10px] opacity-60">Key environment: {testResult.keyEnvironment}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Verify result inline */}
          {verifyResult && (
            <div className={`space-y-1.5 rounded-md border p-2.5 text-xs ${verifyResult.allOk ? 'border-brand-200 bg-brand-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="font-bold text-neutral-900">Verify Stripe Setup</div>
              {verifyResult.checks.map((c) => (
                <div key={c.key} className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-700">{c.label}</span>
                  {!c.present
                    ? <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">❌ Missing</Badge>
                    : !c.ok
                      ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">⚠ Invalid shape</Badge>
                      : <Badge variant="outline" className="border-brand-300 bg-brand-50 text-brand-800">✅ OK ({c.environment || 'n/a'})</Badge>}
                </div>
              ))}
              {verifyResult.environmentMismatch && (
                <div className="mt-1 rounded border border-red-300 bg-red-50 p-1.5 text-red-800">
                  ⚠ Publishable and Secret keys belong to different environments. Use both <code>pk_test_</code>+<code>sk_test_</code> OR both <code>pk_live_</code>+<code>sk_live_</code>.
                </div>
              )}
            </div>
          )}

          {/* Webhook + sync details */}
          <div className="flex flex-wrap gap-2 pt-1">
            <div className="flex-1 min-w-[200px] rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
              <div className="flex items-center gap-1 font-bold text-neutral-700"><Webhook className="h-3 w-3" /> Last Webhook</div>
              <div className="mt-0.5 text-neutral-600">{w.lastReceivedAt ? `${fmtDate(w.lastReceivedAt)} · ${w.lastReceivedType || 'event'}` : 'None received yet'}</div>
              {w.failedCount > 0 && <div className="mt-0.5 text-red-700">⚠ {w.failedCount} failed webhook{w.failedCount === 1 ? '' : 's'}</div>}
            </div>
            <div className="flex-1 min-w-[200px] rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
              <div className="flex items-center gap-1 font-bold text-neutral-700"><Heart className="h-3 w-3" /> Last Donation</div>
              <div className="mt-0.5 text-neutral-600">
                {d.lastDonation ? `${fmtMoney(d.lastDonation.amount)} from ${d.lastDonation.email || 'anonymous'} · ${fmtDate(d.lastDonation.createdAt)}` : 'No completed donations yet'}
              </div>
            </div>
          </div>

          {/* Volumes */}
          <div className="flex flex-wrap gap-2">
            <Metric label="Total Donations" value={fmtMoney(d.lifetimeAmount)} sublabel={`${d.lifetimeCount} donations`} icon={DollarSign} tone="brand" />
            <Metric label="Marketplace Volume" value={fmtMoney(data.marketplace.volume)} sublabel={`${data.marketplace.count} orders`} icon={DollarSign} />
            <Metric label="Job Payment Volume" value={fmtMoney(data.jobs.volume)} sublabel={`${data.jobs.count} jobs`} icon={DollarSign} />
            <Metric label="Failed Transactions" value={data.failures.failedTransactions} icon={XCircle} tone={data.failures.failedTransactions ? 'red' : 'neutral'} />
            <Metric label="Failed Webhooks" value={data.failures.failedWebhooks} icon={XCircle} tone={data.failures.failedWebhooks ? 'red' : 'neutral'} />
          </div>
        </CardContent>
      </Card>

      {/* --- Section 2: Donation Metrics Dashboard ------------------------- */}
      <Card className="border-neutral-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-5 w-5 text-brand-600" /> Donation Metrics
          </CardTitle>
          <p className="text-xs text-neutral-500">Real-time stats for grant applications and nonprofit reporting. Once Stripe is connected and live donations flow, these update automatically.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Metric label="Lifetime Donations" value={fmtMoney(d.lifetimeAmount)} sublabel={`${d.lifetimeCount} total`} icon={Heart} tone="brand" />
            <Metric label="This Month" value={fmtMoney(d.thisMonthAmount)} sublabel={`${d.thisMonthCount} donations`} icon={TrendingUp} />
            <Metric label="Active Donors (90d)" value={d.activeDonors90d} sublabel={`${d.uniqueDonors} unique lifetime`} icon={Users} />
            <Metric label="Largest Donation" value={d.largestDonation ? fmtMoney(d.largestDonation.amount) : '—'} sublabel={d.largestDonation?.email || ''} icon={DollarSign} />
            <Metric label="Average Donation" value={fmtMoney(d.averageDonation)} icon={DollarSign} />
            <Metric label="Pending Intents" value={d.intentCount} sublabel="queued / not paid" icon={Info} />
          </div>

          {/* Goal progress */}
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-sm font-bold text-neutral-800"><Target className="h-4 w-4 text-brand-600" /> Fundraising goals</div>
              <div className="flex items-center gap-1.5">
                <Input value={monthlyGoal} onChange={(e) => setMonthlyGoal(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Monthly $" className="h-8 w-28 text-xs" inputMode="numeric" />
                <Input value={yearlyGoal} onChange={(e) => setYearlyGoal(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Yearly $" className="h-8 w-28 text-xs" inputMode="numeric" />
                <Button size="sm" onClick={saveGoals} disabled={savingGoals} className="h-8 bg-brand-600 hover:bg-brand-700">
                  {savingGoals ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
            <div className="space-y-2.5">
              <ProgressBar value={d.monthlyProgressPercent} label={`Monthly · ${fmtMoney(d.thisMonthAmount)} / ${fmtMoney(d.monthlyGoal)}`} />
              <ProgressBar value={d.yearlyProgressPercent} label={`Yearly · ${fmtMoney(d.ytdAmount)} / ${fmtMoney(d.yearlyGoal)}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- Section 3: Safe env-variable instructions --------------------- */}
      {!isConnected && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-5 w-5 text-blue-700" /> Connect Stripe — safe setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-blue-900">
            <ol className="list-inside list-decimal space-y-1.5 text-xs">
              <li>Sign in to <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noopener noreferrer" className="font-semibold underline">dashboard.stripe.com/test/apikeys</a> and copy your <b>test</b> publishable + secret keys.</li>
              <li>(Optional) Create a webhook endpoint at <code className="rounded bg-white px-1">https://dumpmaps.org/api/stripe/webhook</code> with events <code className="rounded bg-white px-1">checkout.session.completed</code>, <code className="rounded bg-white px-1">payment_intent.succeeded</code>, <code className="rounded bg-white px-1">invoice.paid</code> and copy the signing secret.</li>
              <li>Paste the keys in the <b>Stripe API Keys</b> section above (they will be stored encrypted server-side, never echoed back).</li>
              <li>Click <b>Run Connection Test</b> to confirm connectivity, then <b>Verify Stripe Setup</b> to confirm each key’s shape and environment match.</li>
              <li>Toggle <b>Test mode → Live mode</b> only after running at least one successful end-to-end test donation. Production keys start with <code>pk_live_</code> and <code>sk_live_</code>.</li>
            </ol>
            <details className="rounded border border-blue-200 bg-white p-2 text-xs">
              <summary className="cursor-pointer font-bold text-blue-900">Optional: also load keys from environment variables</summary>
              <div className="mt-2 space-y-1 text-neutral-800">
                <p>For self-hosted production deployments, you can paste keys here OR set them in <code>.env</code>:</p>
                <pre className="overflow-x-auto rounded bg-neutral-50 p-2 text-[11px] leading-relaxed">{`# .env (server-side only)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...`}</pre>
                <p className="text-[11px] text-neutral-500">Database-stored keys take precedence so admins can rotate without redeploying. Env keys are a fallback for first boot.</p>
              </div>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
