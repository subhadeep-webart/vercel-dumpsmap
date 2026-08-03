'use client'

// /admin/feature-controls — Phase A
// Super Admin-only page to manage global feature flags + view audit log.
// AdminShell is provided by /app/admin/layout.js — do not re-wrap.
//
// Two tabs:
//   • Features    — list of all features with status pill + edit dialog
//   • Audit log   — every flag change with diff (old → new)

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ToggleRight, Loader2, ShieldCheck, History, RefreshCw, Edit3, Eye, Lock, EyeOff, Save, X,
  Sparkles, AlertTriangle, CircleDot, Pause, Rocket, FlaskConical, Layers,
} from 'lucide-react'
import { toast } from 'sonner'

const STATUS_META = {
  live:        { label: 'Live',        cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200', icon: Rocket },
  beta:        { label: 'Beta',        cls: 'bg-violet-100 text-violet-800 ring-violet-200',     icon: FlaskConical },
  demo:        { label: 'Demo',        cls: 'bg-amber-100 text-amber-800 ring-amber-200',         icon: Sparkles },
  paused:      { label: 'Paused',      cls: 'bg-orange-100 text-orange-800 ring-orange-200',     icon: Pause },
  not_active:  { label: 'Not Active',  cls: 'bg-neutral-200 text-neutral-700 ring-neutral-300',  icon: EyeOff },
}

const CATEGORY_META = {
  navigation: { label: 'Navigation Pages',  cls: 'bg-brand-100 text-brand-800' },
  contractor:  { label: 'Contractor Ops',    cls: 'bg-sky-100 text-sky-800' },
  marketplace: { label: 'Marketplace',       cls: 'bg-blue-100 text-blue-800' },
  monetization:{ label: 'Monetization',      cls: 'bg-emerald-100 text-emerald-800' },
  rewards:     { label: 'Rewards',           cls: 'bg-pink-100 text-pink-800' },
  enterprise:  { label: 'Enterprise',        cls: 'bg-indigo-100 text-indigo-800' },
}

export default function FeatureControlsPage() {
  return <FeatureControls />
}

function FeatureControls() {
  const [flags, setFlags] = useState([])
  const [statuses, setStatuses] = useState([])
  const [tiers, setTiers] = useState([])
  const [roles, setRoles] = useState([])
  const [audit, setAudit] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('features')
  const [editFlag, setEditFlag] = useState(null) // the flag object currently being edited

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [f, a] = await Promise.all([
        fetch('/api/admin/feature-flags').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/feature-flags/audit?limit=100').then((r) => r.json()).catch(() => ({ entries: [] })),
      ])
      if (f?.flags) {
        setFlags(f.flags)
        setStatuses(f.featureStatuses || [])
        setTiers(f.membershipTiers || [])
        setRoles(f.validRoles || [])
      }
      setAudit(a?.entries || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const counters = useMemo(() => {
    const c = { live: 0, beta: 0, demo: 0, paused: 0, not_active: 0 }
    for (const f of flags) c[f.globalStatus] = (c[f.globalStatus] || 0) + 1
    return c
  }, [flags])

  const onSaveFlag = async (key, patch) => {
    try {
      const res = await fetch(`/api/admin/feature-flags/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Update failed'); return false }
      toast.success(`${j.flag.name} updated`)
      setEditFlag(null)
      await load()
      return true
    } catch (e) {
      toast.error('Update failed')
      return false
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-brand-600">Super Admin · Phase A</div>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight">Feature Controls</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Globally control every major module on the platform. Set status, roles, required tier, trial defaults.
            All changes are recorded in the audit log. Per-account controls coming in Phase B.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>

      {/* Status counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <Card key={k} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ${m.cls}`}>
                  <m.icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{m.label}</span>
              </div>
              <div className="mt-1.5 text-xl font-extrabold tracking-tight">{counters[k] || 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        <TabButton active={tab === 'features'} onClick={() => setTab('features')} icon={Layers} label={`Features (${flags.length})`} />
        <TabButton active={tab === 'audit'} onClick={() => setTab('audit')} icon={History} label={`Audit log (${audit.length})`} />
      </div>

      {/* Loading */}
      {loading && (
        <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</CardContent></Card>
      )}

      {!loading && tab === 'features' && (
        <div className="space-y-2">
          {flags.map((f) => (
            <FeatureRow key={f.key} flag={f} onEdit={() => setEditFlag(f)} />
          ))}
        </div>
      )}

      {!loading && tab === 'audit' && (
        <AuditLog entries={audit} />
      )}

      {/* Edit dialog */}
      {editFlag && (
        <EditFlagDialog
          flag={editFlag}
          statuses={statuses}
          tiers={tiers}
          roles={roles}
          onClose={() => setEditFlag(null)}
          onSave={onSaveFlag}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition ${
        active ? 'border-brand-600 text-brand-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  )
}

function FeatureRow({ flag, onEdit }) {
  const status = STATUS_META[flag.globalStatus] || STATUS_META.not_active
  const cat = CATEGORY_META[flag.category] || { label: flag.category, cls: 'bg-neutral-100 text-neutral-700' }
  const StatusIcon = status.icon
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-neutral-900">{flag.name}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${status.cls}`}>
                <StatusIcon className="h-3 w-3" /> {status.label}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cat.cls}`}>{cat.label}</span>
              {flag.visibleToUsers ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200"><Eye className="h-3 w-3" /> visible</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 ring-1 ring-neutral-200"><Lock className="h-3 w-3" /> hidden</span>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-600">{flag.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
              <span><b className="font-bold text-neutral-700">Roles:</b> {(flag.allowedRoles || []).join(', ') || '—'}</span>
              <span>·</span>
              <span><b className="font-bold text-neutral-700">Tier:</b> {flag.requiredMembershipTier || 'free'}</span>
              <span>·</span>
              <span><b className="font-bold text-neutral-700">Trial:</b> {flag.trialEligible ? `${flag.defaultTrialDays || 0}d eligible` : 'none'}</span>
              {flag.updatedByEmail && (
                <>
                  <span>·</span>
                  <span><b className="font-bold text-neutral-700">Updated:</b> {flag.updatedByEmail} {flag.updatedAt ? `(${new Date(flag.updatedAt).toLocaleString()})` : ''}</span>
                </>
              )}
            </div>
            {flag.notes && <div className="mt-1.5 rounded border border-neutral-200 bg-neutral-50 p-2 text-[11px] text-neutral-600"><b>Notes:</b> {flag.notes}</div>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onEdit} className="gap-1"><Edit3 className="h-3.5 w-3.5" /> Edit</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EditFlagDialog({ flag, statuses, tiers, roles, onClose, onSave }) {
  const [form, setForm] = useState({
    globalStatus: flag.globalStatus,
    visibleToUsers: flag.visibleToUsers,
    allowedRoles: [...(flag.allowedRoles || [])],
    requiredMembershipTier: flag.requiredMembershipTier,
    trialEligible: !!flag.trialEligible,
    defaultTrialDays: Number(flag.defaultTrialDays || 0),
    notes: flag.notes || '',
    auditNotes: '',
  })
  const [saving, setSaving] = useState(false)

  const toggleRole = (role) => {
    setForm((s) => ({
      ...s,
      allowedRoles: s.allowedRoles.includes(role)
        ? s.allowedRoles.filter((r) => r !== role)
        : [...s.allowedRoles, role],
    }))
  }

  const submit = async () => {
    setSaving(true)
    const ok = await onSave(flag.key, form)
    setSaving(false)
    if (ok) {/* dialog closed by parent */}
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ToggleRight className="h-4 w-4 text-brand-600" /> {flag.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-neutral-500">{flag.description}</p>

          {/* Status */}
          <div>
            <Label className="text-xs">Global status</Label>
            <Select value={form.globalStatus} onValueChange={(v) => setForm((s) => ({ ...s, globalStatus: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s]?.label || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-neutral-500">
              <b>Demo</b>: super-admin only · <b>Beta</b>: granted accounts only · <b>Live</b>: role+tier gated · <b>Paused</b>: existing access read-only, new use blocked · <b>Not Active</b>: hidden entirely.
            </p>
          </div>

          {/* Visible toggle */}
          <div className="flex items-center justify-between rounded border border-neutral-200 p-3">
            <div>
              <Label className="text-xs font-bold">Visible to users</Label>
              <p className="text-[11px] text-neutral-500">Marketing/UI surfaces show this feature even when locked. Disable to hide entirely.</p>
            </div>
            <Switch checked={form.visibleToUsers} onCheckedChange={(v) => setForm((s) => ({ ...s, visibleToUsers: v }))} />
          </div>

          {/* Roles */}
          <div>
            <Label className="text-xs">Allowed roles</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {roles.map((r) => {
                const active = form.allowedRoles.includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      active ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tier + trial */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Required membership tier</Label>
              <Select value={form.requiredMembershipTier} onValueChange={(v) => setForm((s) => ({ ...s, requiredMembershipTier: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tiers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Default trial days (0-365)</Label>
              <Input type="number" min={0} max={365} value={form.defaultTrialDays} onChange={(e) => setForm((s) => ({ ...s, defaultTrialDays: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded border border-neutral-200 p-3">
            <div>
              <Label className="text-xs font-bold">Trial eligible</Label>
              <p className="text-[11px] text-neutral-500">When enabled, Super Admins can grant a time-boxed trial per-account (Phase B).</p>
            </div>
            <Switch checked={form.trialEligible} onCheckedChange={(v) => setForm((s) => ({ ...s, trialEligible: v }))} />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs">Internal notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Visible only to admins" />
          </div>
          <div>
            <Label className="text-xs">Audit reason (this change)</Label>
            <Input value={form.auditNotes} onChange={(e) => setForm((s) => ({ ...s, auditNotes: e.target.value }))} placeholder="e.g. opening beta to QA testers" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}><X className="mr-1 h-3.5 w-3.5" /> Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1 h-3.5 w-3.5" /> Save changes</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AuditLog({ entries }) {
  if (!entries.length) {
    return <Card><CardContent className="p-6 text-sm text-neutral-500">No audit entries yet.</CardContent></Card>
  }
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <Card key={e.id}>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                <span className="font-mono text-[11px] text-neutral-500">{new Date(e.createdAt).toLocaleString()}</span>
                <span className="text-neutral-400">·</span>
                <span className="font-semibold text-neutral-800">{e.adminEmail}</span>
                <span className="text-neutral-400">·</span>
                <span className="text-neutral-700">{e.action}</span>
                <span className="text-neutral-400">·</span>
                <Badge className="bg-violet-100 text-violet-800">{e.featureKey}</Badge>
                {e.scope && e.scope !== 'global' && (
                  <Badge variant="outline">{e.scope}{e.scopeId ? `:${String(e.scopeId).slice(0, 8)}` : ''}</Badge>
                )}
              </div>
            </div>
            {(e.oldValue || e.newValue) && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <DiffPanel title="Before" data={e.oldValue} tone="rose" />
                <DiffPanel title="After"  data={e.newValue} tone="emerald" />
              </div>
            )}
            {e.notes && <div className="mt-1.5 text-[11px] italic text-neutral-500">Reason: {e.notes}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function DiffPanel({ title, data, tone }) {
  const cls = tone === 'rose' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
  return (
    <div className={`rounded border ${cls} p-2`}>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-70">{title}</div>
      {data && Object.keys(data).length > 0 ? (
        <ul className="space-y-0.5 text-[11px] font-mono">
          {Object.entries(data).map(([k, v]) => (
            <li key={k}><b>{k}:</b> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</li>
          ))}
        </ul>
      ) : (
        <div className="text-[11px] opacity-60">—</div>
      )}
    </div>
  )
}
