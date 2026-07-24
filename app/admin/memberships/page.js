'use client'

// Admin → Memberships Dashboard
// ---------------------------------------------------------------------------
// Aggregated analytics on:
//   • Users by membership tier (free / verified_commercial / pro_commercial / enterprise)
//   • Estimated monthly recurring revenue (placeholder ARPU until Stripe products wire)
//   • Trial users (membership=free + commercialTrialEndsAt in future)
//   • Conversions in last 30 days
//   • Commercial account growth (new commercial approvals in last 30/90 days)
//   • Breakdown by role / verification level / commercial role / account status

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAdmin } from '@/components/admin/AdminContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  Loader2, Building2, Users, DollarSign, TrendingUp, Clock, RotateCcw, Award,
  Hammer, ShieldCheck, ArrowRight, Activity,
} from 'lucide-react'

const TIER_INFO = {
  free:                { label: 'Free',       color: 'neutral', desc: 'Read-only B2B browser' },
  verified_commercial: { label: 'Verified',   color: 'blue',    desc: 'Full B2B posting + messaging' },
  pro_commercial:      { label: 'Pro',        color: 'amber',   desc: 'Verified + featured placement' },
  enterprise:          { label: 'Enterprise', color: 'purple',  desc: 'Pro + dedicated account features' },
}
const TIER_COLOR = {
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  blue:    'bg-blue-100 text-blue-800 border-blue-200',
  amber:   'bg-amber-100 text-amber-900 border-amber-200',
  purple:  'bg-purple-100 text-purple-800 border-purple-200',
}

function fmtUSD(n) { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) } catch { return `$${n}` } }
function pct(part, whole) { if (!whole) return '0%'; return `${Math.round((part / whole) * 100)}%` }

function StatCard({ icon: Icon, label, value, sub, accent = 'brand' }) {
  const accentMap = {
    brand: 'text-brand-600 bg-brand-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    indigo: 'text-indigo-600 bg-indigo-50',
    blue: 'text-blue-600 bg-blue-50',
  }
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
            <div className="mt-1 truncate text-2xl font-extrabold tracking-tight text-neutral-900">{value}</div>
            {sub && <div className="mt-0.5 truncate text-xs text-neutral-600">{sub}</div>}
          </div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accentMap[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MembershipBar({ count, total, tier }) {
  const info = TIER_INFO[tier] || { label: tier, color: 'neutral', desc: '' }
  const cls = TIER_COLOR[info.color] || TIER_COLOR.neutral
  const widthPct = total ? Math.max(2, Math.round((count / total) * 100)) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{info.label}</span>
          <span className="text-neutral-500">{info.desc}</span>
        </div>
        <div className="font-bold text-neutral-800"><b>{count}</b> <span className="text-neutral-500">({pct(count, total)})</span></div>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full rounded-full ${cls.split(' ')[0]} transition-all`} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  )
}

export default function AdminMembershipsPage() {
  const { authFetch } = useAdmin()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [migrating, setMigrating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await authFetch('/api/admin/memberships')
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Load failed')
      setData(j)
    } catch (e) { toast.error(e.message || 'Load failed') } finally { setLoading(false) }
  }, [authFetch])

  useEffect(() => { load() }, [load])

  const runMigration = async () => {
    setMigrating(true)
    try {
      const r = await authFetch('/api/admin/users/migrate-memberships', { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Migration failed')
      toast.success(`Migrated ${j.verifiedToCommercial + j.proToCommercial} users (${j.verifiedToCommercial} verified→verified_commercial, ${j.proToCommercial} pro→pro_commercial)`)
      load()
    } catch (e) { toast.error(e.message || 'Migration failed') } finally { setMigrating(false) }
  }

  if (loading && !data) return (
    <div className="p-6 text-sm text-neutral-500"><Loader2 className="-mt-0.5 mr-1 inline h-4 w-4 animate-spin" /> Loading memberships dashboard…</div>
  )
  if (!data) return <div className="p-6 text-sm text-red-600">Failed to load.</div>

  const total = data.totalUsers || 0
  const m = data.byMembership || {}
  const paid = (m.verified_commercial || 0) + (m.pro_commercial || 0) + (m.enterprise || 0) + (m.verified || 0) + (m.pro || 0)
  const free = m.free || 0
  const conversionRate = total ? Math.round((paid / total) * 100) : 0
  const legacyTotal = (m.verified || 0) + (m.pro || 0)

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <h1 className="text-2xl font-extrabold tracking-tight">Memberships Dashboard</h1>
          </div>
          <p className="mt-1 text-sm text-neutral-600">Track tier distribution, commercial growth, trials, conversions, and estimated recurring revenue.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/users" className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50">
            <Users className="h-3.5 w-3.5" /> Manage users
          </Link>
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Migration banner (only shows if legacy values still exist) */}
      {legacyTotal > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="text-xs text-amber-900">
            <b>Migration available:</b> {legacyTotal} user{legacyTotal === 1 ? '' : 's'} still on legacy <code className="rounded bg-white/60 px-1">verified</code>/<code className="rounded bg-white/60 px-1">pro</code> values. Run migration to rename them.
          </div>
          <Button onClick={runMigration} disabled={migrating} size="sm" className="h-8 bg-amber-600 text-xs text-white hover:bg-amber-700">
            {migrating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="mr-1 h-3.5 w-3.5" />}
            Run migration
          </Button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users}          label="Total users"             value={total.toLocaleString()}                        sub={`${data.recentSignups || 0} new in last 30d`} accent="brand" />
        <StatCard icon={ShieldCheck}    label="Paid commercial members" value={paid.toLocaleString()}                         sub={`${conversionRate}% of users`}                accent="emerald" />
        <StatCard icon={Clock}          label="Active trials"           value={(data.onTrial || 0).toLocaleString()}          sub="Free + active trial period"                   accent="amber" />
        <StatCard icon={DollarSign}     label="Est. monthly revenue"    value={fmtUSD(data.revenue?.estimatedMonthlyRecurring || 0)} sub="placeholder ARPU"                       accent="indigo" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Membership distribution */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><Award className="h-4 w-4 text-indigo-600" /><h2 className="text-sm font-bold text-neutral-900">Membership distribution</h2></div>
              <div className="text-xs text-neutral-500">Total: <b>{total}</b></div>
            </div>
            <div className="space-y-3">
              {['free', 'verified_commercial', 'pro_commercial', 'enterprise'].map((tier) => (
                <MembershipBar key={tier} tier={tier} count={m[tier] || 0} total={total} />
              ))}
              {(m.verified || m.pro) ? (
                <div className="border-t border-neutral-200 pt-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Legacy (pre-migration)</div>
                  {m.verified ? <MembershipBar tier="verified_commercial" count={m.verified} total={total} /> : null}
                  {m.pro      ? <MembershipBar tier="pro_commercial"      count={m.pro}      total={total} /> : null}
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-2.5 text-[11px] text-neutral-600">
              <DollarSign className="-mt-0.5 mr-0.5 inline h-3 w-3" />
              Pricing assumption (ARPU): {Object.entries(data.revenue?.pricingAssumption || {}).map(([k, v]) => <span key={k} className="mx-1 inline-flex items-center"><b>{TIER_INFO[k]?.label || k}</b>=<span className="font-bold text-emerald-700">${v}/mo</span></span>)}
            </div>
          </CardContent>
        </Card>

        {/* Commercial growth */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" /><h2 className="text-sm font-bold text-neutral-900">Commercial growth</h2></div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">New approvals (30d)</div>
                <div className="text-2xl font-extrabold text-emerald-700">{data.commercialGrowth?.new30d || 0}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">New approvals (90d)</div>
                <div className="text-2xl font-extrabold text-emerald-700">{data.commercialGrowth?.new90d || 0}</div>
              </div>
              <div className="border-t border-neutral-100 pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Conversions to paid (30d)</div>
                <div className="text-2xl font-extrabold text-indigo-700">{data.conversions?.last30d || 0}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">All-time paid members</div>
                <div className="text-xl font-extrabold text-neutral-900">{data.conversions?.allTime || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownCard title="By role" icon={Shield} entries={data.byRole} />
        <BreakdownCard title="By verification" icon={ShieldCheck} entries={data.byVerificationLevel} />
        <BreakdownCard title="By commercial role" icon={Hammer} entries={data.byCommercialRole} />
      </div>
      <div className="grid gap-4 lg:grid-cols-1">
        <BreakdownCard title="By account status" icon={Activity} entries={data.byAccountStatus} />
      </div>
    </div>
  )
}

function Shield(props) { return <Award {...props} /> }

function BreakdownCard({ title, icon: Icon, entries }) {
  const items = Object.entries(entries || {}).sort((a, b) => b[1] - a[1])
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2"><Icon className="h-4 w-4 text-brand-600" /><h2 className="text-sm font-bold text-neutral-900">{title}</h2></div>
        {items.length === 0 ? <div className="text-xs text-neutral-500">No data.</div> : (
          <div className="space-y-1.5">
            {items.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="capitalize text-neutral-700">{String(k).replace(/_/g, ' ')}</span>
                <span className="font-bold text-neutral-900">{v}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
