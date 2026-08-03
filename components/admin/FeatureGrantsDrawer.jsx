'use client'

// FeatureGrantsDrawer
// ---------------------------------------------------------------------------
// Reusable inline panel for Phase B of the Feature Control System.
//
// Lets a Super Admin grant/revoke/trial individual features on a per-account
// basis. Works for both user-scoped and facility-scoped grants by passing
// `scope` + `scopeId`.
//
// Filters the feature registry to those relevant for the scope:
//   • user      — all features visible to user (non-not_active)
//   • facility  — only facility-scoped features (facilityRewardsProgram, commercialB2B)
//
// Props:
//   open, onClose   — controlled visibility
//   scope           — 'user' | 'facility'
//   scopeId         — uuid of the target user/facility
//   scopeLabel      — display string (email / facility name)
//   onChange?       — fired after any grant change (parent can refresh)

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Loader2, ToggleRight, Sparkles, FlaskConical, Rocket, Pause, EyeOff,
  CheckCircle2, X, Hourglass, ShieldOff, RotateCcw, AlertCircle, Calendar, Plus, Crown, StopCircle,
} from 'lucide-react'
import { toast } from 'sonner'

const STATUS_META = {
  active:   { label: 'Active',   cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200',  icon: CheckCircle2 },
  trial:    { label: 'On trial', cls: 'bg-amber-100 text-amber-800 ring-amber-200',         icon: Hourglass },
  paused:   { label: 'Paused',   cls: 'bg-orange-100 text-orange-800 ring-orange-200',     icon: Pause },
  expired:  { label: 'Expired',  cls: 'bg-neutral-200 text-neutral-700 ring-neutral-300',  icon: AlertCircle },
  revoked:  { label: 'Revoked',  cls: 'bg-red-100 text-red-800 ring-red-200',              icon: ShieldOff },
}

const GLOBAL_STATUS_META = {
  live:        { label: 'Live',        icon: Rocket,        cls: 'text-emerald-700' },
  beta:        { label: 'Beta',        icon: FlaskConical,  cls: 'text-violet-700' },
  demo:        { label: 'Demo',        icon: Sparkles,      cls: 'text-amber-700' },
  paused:      { label: 'Paused',      icon: Pause,         cls: 'text-orange-700' },
  not_active:  { label: 'Not Active',  icon: EyeOff,        cls: 'text-neutral-500' },
}

// Features that are relevant per-scope (others are hidden in the drawer).
const FACILITY_SCOPE_FEATURES = new Set([
  'facilityRewardsProgram',
  'commercialB2B',
  'rewardsEngine',
])

export default function FeatureGrantsDrawer({ open, onClose, scope, scopeId, scopeLabel, onChange }) {
  const [flags, setFlags] = useState([])
  const [grants, setGrants] = useState([])
  const [loading, setLoading] = useState(false)
  const [busyKey, setBusyKey] = useState(null) // featureKey currently being mutated

  const load = useCallback(async () => {
    if (!scope || !scopeId) return
    setLoading(true)
    try {
      const [f, g] = await Promise.all([
        fetch('/api/admin/feature-flags').then((r) => r.json()).catch(() => null),
        fetch(`/api/admin/feature-grants?scope=${scope}&scopeId=${encodeURIComponent(scopeId)}`).then((r) => r.json()).catch(() => ({ grants: [] })),
      ])
      if (f?.flags) setFlags(f.flags)
      setGrants(g?.grants || [])
    } finally { setLoading(false) }
  }, [scope, scopeId])

  useEffect(() => { if (open) load() }, [open, load])

  const grantByKey = useMemo(() => Object.fromEntries(grants.map((g) => [g.featureKey, g])), [grants])

  const visibleFlags = useMemo(() => {
    if (scope === 'facility') return flags.filter((f) => FACILITY_SCOPE_FEATURES.has(f.key))
    return flags // user scope shows all
  }, [flags, scope])

  const upsertGrant = async (featureKey, payload) => {
    setBusyKey(featureKey)
    try {
      const res = await fetch('/api/admin/feature-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, scopeId, featureKey, ...payload }),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Save failed'); return false }
      toast.success(`${featureKey} → ${payload.status}`)
      await load()
      if (onChange) onChange()
      return true
    } finally { setBusyKey(null) }
  }

  // Phase C — patch existing grant in place (used for extend/convert/end/renew)
  const patchGrant = async (grantId, featureKey, payload, successMsg) => {
    setBusyKey(featureKey)
    try {
      const res = await fetch(`/api/admin/feature-grants/${grantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Update failed'); return false }
      toast.success(successMsg || `${featureKey} updated`)
      await load()
      if (onChange) onChange()
      return true
    } finally { setBusyKey(null) }
  }

  const revokeGrant = async (grantId, featureKey) => {
    if (!confirm('Revoke this feature access?')) return
    setBusyKey(featureKey)
    try {
      const res = await fetch(`/api/admin/feature-grants/${grantId}`, {
        method: 'DELETE',
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Revoke failed'); return }
      toast.success(`${featureKey} access revoked`)
      await load()
      if (onChange) onChange()
    } finally { setBusyKey(null) }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><ToggleRight className="h-5 w-5 text-brand-600" /> Feature access</SheetTitle>
          <SheetDescription className="text-xs">
            Per-account grants for <b>{scope}</b> · <span className="font-mono">{scopeLabel}</span>
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="mt-6 flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        )}

        {!loading && visibleFlags.length === 0 && (
          <div className="mt-6 text-sm text-neutral-500">No features available for this scope.</div>
        )}

        {!loading && visibleFlags.length > 0 && (
          <div className="mt-4 space-y-3">
            {visibleFlags.map((f) => {
              const grant = grantByKey[f.key]
              const gs = GLOBAL_STATUS_META[f.globalStatus] || GLOBAL_STATUS_META.not_active
              const GsIcon = gs.icon
              const grantStatus = grant?.status
              const expired = grant?.trialEndAt && Date.now() > new Date(grant.trialEndAt).getTime() && grantStatus === 'trial'
              const effectiveStatus = expired ? 'expired' : grantStatus
              const sm = effectiveStatus && STATUS_META[effectiveStatus]
              const SIcon = sm?.icon
              const busy = busyKey === f.key
              return (
                <div key={f.key} className="rounded-lg border border-neutral-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-neutral-900">{f.name}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${gs.cls}`}>
                          <GsIcon className="h-3 w-3" /> Global: {gs.label}
                        </span>
                        {sm && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${sm.cls}`}>
                            <SIcon className="h-3 w-3" /> {sm.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-neutral-600">{f.description}</p>
                      {grant && (
                        <div className="mt-1.5 text-[11px] text-neutral-500">
                          {grant.status === 'trial' && grant.trialEndAt && (() => {
                            const daysLeft = Math.max(0, Math.ceil((new Date(grant.trialEndAt) - Date.now()) / 86400000))
                            const tone = expired ? 'text-red-700 font-bold' : daysLeft <= 7 ? 'text-amber-700 font-semibold' : 'text-emerald-700'
                            return (
                              <span className={tone}>
                                Trial {expired ? 'EXPIRED' : `expires in ${daysLeft}d`} · ends {new Date(grant.trialEndAt).toLocaleDateString()}
                              </span>
                            )
                          })()}
                          {grant.status === 'active' && grant.trialEndAt && (
                            <span className="text-blue-700">Converted from trial · originally ended {new Date(grant.trialEndAt).toLocaleDateString()}</span>
                          )}
                          {grant.grantedByEmail && <span> · Granted by {grant.grantedByEmail}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                      ) : grantStatus === 'trial' && !expired ? (
                        // Active trial — extend / convert / end
                        <TrialActions
                          featureKey={f.key}
                          defaultDays={f.defaultTrialDays || 25}
                          onExtend={(days) => patchGrant(grant.id, f.key, { trialDays: days }, `Trial extended by ${days} days`)}
                          onConvert={() => patchGrant(grant.id, f.key, { status: 'active' }, 'Converted to paid')}
                          onEnd={() => revokeGrant(grant.id, f.key)}
                          onPause={() => upsertGrant(f.key, { status: 'paused' })}
                        />
                      ) : (expired || grantStatus === 'expired') && grant ? (
                        // Trial expired — renew / convert
                        <ExpiredActions
                          featureKey={f.key}
                          defaultDays={f.defaultTrialDays || 25}
                          onRenew={(days) => patchGrant(grant.id, f.key, { status: 'trial', trialDays: days }, `Trial renewed for ${days} days`)}
                          onConvert={() => patchGrant(grant.id, f.key, { status: 'active' }, 'Converted to paid')}
                          onRevoke={() => revokeGrant(grant.id, f.key)}
                        />
                      ) : grantStatus && grantStatus !== 'revoked' ? (
                        // Granted (active or paused) — pause/resume + revoke
                        <>
                          <Button size="sm" variant="outline" onClick={() => upsertGrant(f.key, { status: grantStatus === 'paused' ? 'active' : 'paused' })} className="h-7 px-2 text-xs">
                            {grantStatus === 'paused' ? <><RotateCcw className="mr-1 h-3 w-3" /> Resume</> : <><Pause className="mr-1 h-3 w-3" /> Pause</>}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => revokeGrant(grant.id, f.key)} className="h-7 px-2 text-xs text-red-700 hover:bg-red-50">
                            <X className="mr-0.5 h-3 w-3" /> Revoke
                          </Button>
                        </>
                      ) : (
                        // No grant or revoked — fresh grant picker
                        <GrantPicker featureKey={f.key} trialDefault={f.defaultTrialDays || 25} trialEligible={f.trialEligible} onPick={(payload) => upsertGrant(f.key, payload)} />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// GrantPicker — quick "Grant active / Start trial" selector
// ---------------------------------------------------------------------------
function GrantPicker({ featureKey, trialDefault, trialEligible, onPick }) {
  const [showTrial, setShowTrial] = useState(false)
  const [trialDays, setTrialDays] = useState(trialDefault || 25)
  if (showTrial) {
    return (
      <div className="flex items-center gap-1">
        <Select value={String(trialDays)} onValueChange={(v) => setTrialDays(Number(v))}>
          <SelectTrigger className="h-7 w-[88px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15 days</SelectItem>
            <SelectItem value="25">25 days</SelectItem>
            <SelectItem value="45">45 days</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => onPick({ status: 'trial', trialDays })} className="h-7 bg-amber-600 px-2 text-xs hover:bg-amber-700">
          <Hourglass className="mr-1 h-3 w-3" /> Start
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowTrial(false)} className="h-7 px-1 text-xs"><X className="h-3.5 w-3.5" /></Button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" onClick={() => onPick({ status: 'active' })} className="h-7 bg-emerald-600 px-2 text-xs hover:bg-emerald-700">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Grant
      </Button>
      {trialEligible && (
        <Button size="sm" variant="outline" onClick={() => setShowTrial(true)} className="h-7 px-2 text-xs">
          <Hourglass className="mr-1 h-3 w-3" /> Trial
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TrialActions — controls shown while a trial is in-flight (not yet expired)
// ---------------------------------------------------------------------------
function TrialActions({ featureKey, defaultDays, onExtend, onConvert, onEnd, onPause }) {
  const [showExtend, setShowExtend] = useState(false)
  const [extendDays, setExtendDays] = useState(defaultDays || 25)
  if (showExtend) {
    return (
      <div className="flex items-center gap-1">
        <Select value={String(extendDays)} onValueChange={(v) => setExtendDays(Number(v))}>
          <SelectTrigger className="h-7 w-[88px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="15">+15 days</SelectItem>
            <SelectItem value="25">+25 days</SelectItem>
            <SelectItem value="45">+45 days</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { onExtend(extendDays); setShowExtend(false) }} className="h-7 bg-amber-600 px-2 text-xs hover:bg-amber-700">
          <Plus className="mr-1 h-3 w-3" /> Extend
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowExtend(false)} className="h-7 px-1 text-xs"><X className="h-3.5 w-3.5" /></Button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button size="sm" variant="outline" onClick={() => setShowExtend(true)} title="Extend the current trial" className="h-7 border-amber-300 px-2 text-xs text-amber-800 hover:bg-amber-50">
        <Calendar className="mr-1 h-3 w-3" /> Extend
      </Button>
      <Button size="sm" onClick={onConvert} title="Convert to paid (permanent active)" className="h-7 bg-blue-600 px-2 text-xs hover:bg-blue-700">
        <Crown className="mr-1 h-3 w-3" /> Convert
      </Button>
      <Button size="sm" variant="outline" onClick={onPause} title="Pause access (keep grant)" className="h-7 px-2 text-xs">
        <Pause className="mr-1 h-3 w-3" /> Pause
      </Button>
      <Button size="sm" variant="ghost" onClick={onEnd} title="End trial now (revoke)" className="h-7 px-2 text-xs text-red-700 hover:bg-red-50">
        <StopCircle className="mr-0.5 h-3 w-3" /> End
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExpiredActions — controls shown after a trial has lazily expired
// ---------------------------------------------------------------------------
function ExpiredActions({ featureKey, defaultDays, onRenew, onConvert, onRevoke }) {
  const [showRenew, setShowRenew] = useState(false)
  const [renewDays, setRenewDays] = useState(defaultDays || 25)
  if (showRenew) {
    return (
      <div className="flex items-center gap-1">
        <Select value={String(renewDays)} onValueChange={(v) => setRenewDays(Number(v))}>
          <SelectTrigger className="h-7 w-[88px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15 days</SelectItem>
            <SelectItem value="25">25 days</SelectItem>
            <SelectItem value="45">45 days</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { onRenew(renewDays); setShowRenew(false) }} className="h-7 bg-amber-600 px-2 text-xs hover:bg-amber-700">
          <RotateCcw className="mr-1 h-3 w-3" /> Renew
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowRenew(false)} className="h-7 px-1 text-xs"><X className="h-3.5 w-3.5" /></Button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button size="sm" variant="outline" onClick={() => setShowRenew(true)} className="h-7 border-amber-300 px-2 text-xs text-amber-800 hover:bg-amber-50">
        <RotateCcw className="mr-1 h-3 w-3" /> Renew
      </Button>
      <Button size="sm" onClick={onConvert} className="h-7 bg-blue-600 px-2 text-xs hover:bg-blue-700">
        <Crown className="mr-1 h-3 w-3" /> Convert
      </Button>
      <Button size="sm" variant="ghost" onClick={onRevoke} className="h-7 px-2 text-xs text-red-700 hover:bg-red-50">
        <X className="mr-0.5 h-3 w-3" /> Revoke
      </Button>
    </div>
  )
}
