'use client'

// /time-clock — Time Clock 2.0
// ----------------------------------------------------------------------------
// Full rewrite. Adds:
//   • Tabs: Today · Week · Calendar · Entries · Approvals (managers) · Settings
//   • Manual entry create/edit/delete/duplicate
//   • Work association (job, work order, vehicle, facility)
//   • Calendar (month grid) + weekly view (Mon-Sun)
//   • Manager approval queue with approve/reject actions
//   • CSV export + Email (mailto) export
//   • Rounding rules + auto-break + hourly rate settings
// ----------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AppHeader from '@/components/AppHeader'
import ContractorToolsGate from '@/components/ContractorToolsGate'
import FeatureLock from '@/components/FeatureLock'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Clock, Play, Square, Coffee, CheckCircle2, Loader2, Briefcase, MapPin, Calendar,
  TimerReset, FileText, Trash2, BarChart3, Send, Plus, Edit3, Copy, Download, Mail,
  ChevronLeft, ChevronRight, Settings, ShieldCheck, AlertCircle, Truck, ClipboardList, X,
} from 'lucide-react'
import { toast } from 'sonner'

// ============================================================================
// Helpers
// ============================================================================
const authHeaders = () => {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('dm_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}
const fmtMinutes = (m = 0) => {
  const total = Math.max(0, Math.round(m))
  const h = Math.floor(total / 60)
  const mm = total % 60
  return `${h}h ${String(mm).padStart(2, '0')}m`
}
const fmtClockHM = (sec) => {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
const fmtTime = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) } catch { return '—' } }
const fmtDate = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) } catch { return '—' } }
const ymd = (d = new Date()) => new Date(d).toISOString().slice(0, 10)
// Datetime-local input wants 'YYYY-MM-DDTHH:mm' in local time (no Z)
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null)

const STATUS_COLOR = {
  active:    'bg-emerald-100 text-emerald-800',
  completed: 'bg-neutral-200 text-neutral-700',
  submitted: 'bg-amber-100 text-amber-800',
  approved:  'bg-blue-100 text-blue-800',
  rejected:  'bg-red-100 text-red-800',
}

const MANAGER_ROLES = ['super_admin', 'admin', 'moderator', 'manager']

// ============================================================================
// Page shell
// ============================================================================
export default function TimeClockPage() {
  return (
    <ContractorToolsGate toolName="Time Clock">
      <FeatureLock featureKey="timeClock">
        <TimeClock20 />
      </FeatureLock>
    </ContractorToolsGate>
  )
}

// ============================================================================
// Main component
// ============================================================================
function TimeClock20() {
  const [tab, setTab] = useState('today')
  const [user, setUser] = useState(null)
  const [active, setActive] = useState(null)
  const [entries, setEntries] = useState([])
  const [summary, setSummary] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())

  // Dialog state
  const [editing, setEditing] = useState(null)   // null | 'new' | entry object
  const [showClockIn, setShowClockIn] = useState(false)

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, l, s, st, meR] = await Promise.all([
        fetch('/api/time-clock/current', { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ entry: null })),
        fetch('/api/time-clock/entries?limit=200', { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ entries: [] })),
        fetch('/api/time-clock/summary', { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
        fetch('/api/time-clock/settings', { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
        fetch('/api/auth/me', { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
      ])
      setActive(c?.entry || null)
      setEntries(l?.entries || [])
      setSummary(s || null)
      setSettings(st?.settings || null)
      setUser(meR?.user || null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const isManager = useMemo(() => {
    if (!user) return false
    return MANAGER_ROLES.includes(user.role) || MANAGER_ROLES.includes(user.profileType) || user.isManager === true
  }, [user])

  const openBreak = useMemo(() => {
    if (!active || !Array.isArray(active.breaks)) return null
    return active.breaks.find((b) => b && !b.endAt) || null
  }, [active])

  const elapsedSeconds = useMemo(() => {
    if (!active) return 0
    const startMs = new Date(active.clockInAt).getTime()
    let breakMs = 0
    for (const b of active.breaks || []) {
      if (!b?.startAt) continue
      const bs = new Date(b.startAt).getTime()
      const be = b.endAt ? new Date(b.endAt).getTime() : now
      if (be > bs) breakMs += be - bs
    }
    return Math.max(0, (now - startMs - breakMs) / 1000)
  }, [active, now])

  // Actions
  const onClockIn = async (payload) => {
    setBusy(true)
    try {
      const res = await fetch('/api/time-clock/clock-in', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload || {}),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Failed to clock in'); return }
      toast.success('Clocked in'); setShowClockIn(false); await load()
    } finally { setBusy(false) }
  }
  const onClockOut = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/time-clock/clock-out', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({}) })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Failed to clock out'); return }
      toast.success(`Clocked out · ${fmtMinutes(j.entry?.netMinutes || 0)} worked`); await load()
    } finally { setBusy(false) }
  }
  const onBreakStart = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/time-clock/break/start', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() } })
      if (!r.ok) toast.error((await r.json()).error || 'Could not start break'); else toast.success('Break started')
      await load()
    } finally { setBusy(false) }
  }
  const onBreakEnd = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/time-clock/break/end', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() } })
      if (!r.ok) toast.error((await r.json()).error || 'Could not end break'); else toast.success('Back to work')
      await load()
    } finally { setBusy(false) }
  }
  const onSubmit = async (id) => {
    const r = await fetch(`/api/time-clock/entries/${id}/submit`, { method: 'POST', headers: authHeaders() })
    if (!r.ok) toast.error((await r.json()).error || 'Submit failed'); else toast.success('Submitted for approval')
    await load()
  }
  const onDelete = async (id) => {
    if (!confirm('Delete this entry? This cannot be undone.')) return
    const r = await fetch(`/api/time-clock/entries/${id}`, { method: 'DELETE', headers: authHeaders() })
    if (!r.ok) toast.error('Delete failed'); else toast.success('Deleted')
    await load()
  }
  const onDuplicate = async (id) => {
    const targetDate = prompt('Duplicate to date (YYYY-MM-DD)?', ymd())
    if (!targetDate) return
    const r = await fetch(`/api/time-clock/entries/${id}/duplicate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ targetDate }),
    })
    if (!r.ok) toast.error((await r.json()).error || 'Duplicate failed'); else toast.success('Shift duplicated')
    await load()
  }
  const onExportCsv = async () => {
    const t = localStorage.getItem('dm_token')
    const url = `/api/time-clock/export.csv?from=&to=`
    const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
    if (!r.ok) { toast.error('Export failed'); return }
    const blob = await r.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `timeclock_${ymd()}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    toast.success('CSV downloaded')
  }
  const onEmailExport = async () => {
    const r = await fetch('/api/time-clock/email-payload', { headers: authHeaders() })
    const j = await r.json()
    if (!r.ok) { toast.error(j.error || 'Email payload failed'); return }
    const params = new URLSearchParams({ subject: j.subject || 'Timesheet', body: j.body || '' })
    const href = `mailto:${encodeURIComponent(j.to || '')}?${params.toString()}`
    window.location.href = href
  }

  const TABS = [
    { key: 'today',     label: 'Today',     icon: Clock },
    { key: 'week',      label: 'Week',      icon: Calendar },
    { key: 'calendar',  label: 'Calendar',  icon: Calendar },
    { key: 'entries',   label: 'All Entries', icon: ClipboardList },
    ...(isManager ? [{ key: 'approvals', label: 'Approvals', icon: ShieldCheck }] : []),
    { key: 'settings',  label: 'Settings',  icon: Settings },
  ]

  return (
    <div className="min-h-[100dvh] bg-neutral-50">
      <AppHeader active="contractor" />

      {/* Hero */}
      <section className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">Contractor Ops · Time Clock 2.0</div>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight sm:text-3xl">Time Clock</h1>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600">Track hours, breaks, jobs, work orders, and vehicles. Edit manually, duplicate shifts, export to CSV/email, and route to managers for approval.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing('new')} className="gap-1.5"><Plus className="h-4 w-4" /> Manual Entry</Button>
            <Button variant="outline" onClick={onExportCsv} className="gap-1.5"><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" onClick={onEmailExport} className="gap-1.5"><Mail className="h-4 w-4" /> Email</Button>
          </div>
        </div>
      </section>

      {/* Active timer (always shown when clocked-in) */}
      {(loading || active) && (
        <section className="container mx-auto px-4 pb-4">
          <ActiveTimerCard
            active={active} loading={loading} busy={busy} openBreak={openBreak}
            elapsedSeconds={elapsedSeconds}
            onClickClockIn={() => setShowClockIn(true)}
            onClockOut={onClockOut} onBreakStart={onBreakStart} onBreakEnd={onBreakEnd}
          />
        </section>
      )}

      {/* Tabs */}
      <nav className="sticky top-14 z-10 border-b border-neutral-200 bg-white shadow-sm">
        <div className="container mx-auto flex gap-0 overflow-x-auto px-2 sm:px-4">
          {TABS.map((t) => {
            const Icon = t.icon; const isActive = t.key === tab
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-semibold transition sm:px-4 ${isActive ? 'text-brand-700' : 'text-neutral-500 hover:text-neutral-900'}`}>
                <Icon className="h-4 w-4" /> {t.label}
                {isActive && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-600" />}
              </button>
            )
          })}
        </div>
      </nav>

      <main className="container mx-auto px-4 py-6 pb-28">
        {tab === 'today' && (
          <TodayView
            active={active} summary={summary} loading={loading} settings={settings}
            entries={entries} onClickClockIn={() => setShowClockIn(true)}
            onSubmit={onSubmit} onEdit={setEditing} onDelete={onDelete} onDuplicate={onDuplicate}
          />
        )}
        {tab === 'week' && (
          <WeekView entries={entries} settings={settings} onEdit={setEditing} />
        )}
        {tab === 'calendar' && (
          <CalendarView entries={entries} settings={settings} onEdit={setEditing} onNewOnDate={(d) => setEditing({ __newOn: d })} />
        )}
        {tab === 'entries' && (
          <EntriesView
            entries={entries} loading={loading} onSubmit={onSubmit} onEdit={setEditing}
            onDelete={onDelete} onDuplicate={onDuplicate}
          />
        )}
        {tab === 'approvals' && isManager && <ApprovalsView />}
        {tab === 'settings' && (
          <SettingsView settings={settings} onSaved={(s) => setSettings(s)} />
        )}
      </main>

      <ClockInDialog open={showClockIn} onClose={() => setShowClockIn(false)} onSubmit={onClockIn} busy={busy} />
      <EntryDialog
        open={!!editing}
        entry={editing && typeof editing === 'object' && !editing.__newOn ? editing : null}
        initialDate={editing && editing.__newOn ? editing.__newOn : null}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
      />
    </div>
  )
}

// ============================================================================
// Today view
// ============================================================================
function TodayView({ active, summary, loading, entries, onClickClockIn, onSubmit, onEdit, onDelete, onDuplicate, settings }) {
  const today = ymd()
  const todayEntries = entries.filter((e) => e.date === today)
  return (
    <div className="space-y-4">
      {!active && !loading && (
        <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-white">
          <CardContent className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-brand-700">Not clocked in</div>
              <div className="mt-1 text-lg font-extrabold tracking-tight text-neutral-900">Ready to start your shift?</div>
              <div className="mt-1 text-sm text-neutral-600">Tag a job, work order, vehicle, or facility when you clock in.</div>
            </div>
            <Button onClick={onClickClockIn} size="lg" className="h-14 min-w-[160px] gap-2 bg-emerald-600 text-base font-bold text-white shadow hover:bg-emerald-700"><Play className="h-5 w-5" /> Clock In</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile icon={Clock} label="Today" value={fmtMinutes(summary?.today?.net || 0)} sub={`${summary?.today?.entries || 0} entries`} loading={loading} tone="brand" />
        <KpiTile icon={Calendar} label="This week (net)" value={fmtMinutes(summary?.week?.net || 0)} sub={`${summary?.week?.daysWorked || 0} days worked`} loading={loading} tone="emerald" />
        <KpiTile icon={Coffee} label="Breaks (week)" value={fmtMinutes(summary?.week?.breaks || 0)} sub={`${summary?.week?.entries || 0} shifts`} loading={loading} tone="amber" />
        <KpiTile icon={BarChart3} label="Top job (week)" value={summary?.byJob?.[0]?.job?.slice(0, 16) || '—'} sub={summary?.byJob?.[0] ? fmtMinutes(summary.byJob[0].netMinutes) : 'No jobs yet'} loading={loading} tone="violet" />
      </div>

      {settings?.defaultRate > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="flex items-center justify-between p-4 text-sm">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Estimated earnings · this week</div>
              <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-neutral-900">
                ${(((summary?.week?.net || 0) / 60) * settings.defaultRate).toFixed(2)}
              </div>
            </div>
            <span className="text-xs text-neutral-500">@ ${settings.defaultRate}/hr</span>
          </CardContent>
        </Card>
      )}

      {summary?.byJob?.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">This week by job</div>
            <ul className="divide-y divide-neutral-100">
              {summary.byJob.slice(0, 6).map((j) => (
                <li key={j.job} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-neutral-400" /><span className="font-medium text-neutral-800">{j.job}</span></div>
                  <span className="font-mono text-neutral-700">{fmtMinutes(j.netMinutes)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">Today&apos;s entries</div>
        {todayEntries.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-neutral-500">No shifts today yet.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {todayEntries.map((e) => <EntryRow key={e.id} entry={e} onSubmit={onSubmit} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Week view (Mon-Sun grid)
// ============================================================================
function WeekView({ entries, settings, onEdit }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const days = useMemo(() => {
    const out = []
    const s = new Date(weekStart)
    for (let i = 0; i < 7; i++) {
      const d = new Date(s); d.setDate(s.getDate() + i)
      out.push(d)
    }
    return out
  }, [weekStart])
  const grouped = useMemo(() => {
    const m = {}
    for (const d of days) m[ymd(d)] = []
    for (const e of entries) {
      const k = e.date
      if (m[k]) m[k].push(e)
    }
    return m
  }, [days, entries])

  const weekTotal = useMemo(() => {
    let total = 0
    Object.values(grouped).forEach((arr) => arr.forEach((e) => { total += e.netMinutes || 0 }))
    return total
  }, [grouped])

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setWeekStart(mondayOf(new Date()))}>This week</Button>
            <Button size="sm" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="text-sm">
            <span className="text-neutral-500">{fmtDate(days[0])} – {fmtDate(days[6])}</span>
            <span className="ml-3 font-bold text-neutral-900">Total: {fmtMinutes(weekTotal)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {days.map((d) => {
          const k = ymd(d); const arr = grouped[k]; const dayTotal = arr.reduce((a, e) => a + (e.netMinutes || 0), 0)
          const isToday = ymd(new Date()) === k
          return (
            <Card key={k} className={isToday ? 'border-2 border-brand-300' : ''}>
              <CardContent className="space-y-1.5 p-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{d.toLocaleDateString([], { weekday: 'short' })}</div>
                    <div className="text-sm font-bold text-neutral-900">{d.getDate()}</div>
                  </div>
                  {dayTotal > 0 && <Badge variant="outline" className="text-[10px]">{fmtMinutes(dayTotal)}</Badge>}
                </div>
                {arr.length === 0 ? (
                  <div className="text-[11px] italic text-neutral-400">no shifts</div>
                ) : (
                  arr.map((e) => (
                    <button key={e.id} onClick={() => onEdit(e)} className="w-full rounded-md bg-neutral-50 px-2 py-1 text-left text-[11px] hover:bg-brand-50">
                      <div className="font-semibold text-neutral-800">{fmtTime(e.clockInAt)} – {e.clockOutAt ? fmtTime(e.clockOutAt) : '…'}</div>
                      <div className="text-neutral-600 truncate">{e.jobLabel || e.workOrderLabel || e.facilityName || 'No tag'}</div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// Calendar view (month grid)
// ============================================================================
function CalendarView({ entries, onEdit, onNewOnDate }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const grid = useMemo(() => {
    const first = new Date(cursor); first.setDate(1)
    const startDow = first.getDay() // 0=Sun
    const offset = (startDow + 6) % 7 // shift so Monday is column 0
    const gridStart = addDays(first, -offset)
    const cells = []
    for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i))
    return cells
  }, [cursor])
  const grouped = useMemo(() => {
    const m = {}
    for (const e of entries) {
      (m[e.date] ||= []).push(e)
    }
    return m
  }, [entries])
  const monthLabel = cursor.toLocaleDateString([], { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex items-center justify-between p-3">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d) }}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d) }}>This month</Button>
            <Button size="sm" variant="outline" onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d) }}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <h3 className="text-lg font-extrabold tracking-tight">{monthLabel}</h3>
          <div className="hidden text-xs text-neutral-500 sm:block">Click a day to add manual entry</div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-neutral-200 bg-white">
        <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50 text-center">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((d) => {
            const k = ymd(d); const arr = grouped[k] || []
            const total = arr.reduce((a, e) => a + (e.netMinutes || 0), 0)
            const inMonth = d.getMonth() === cursor.getMonth()
            const isToday = ymd(new Date()) === k
            return (
              <div key={k} className={`min-h-[88px] border-r border-b border-neutral-100 p-1.5 last:border-r-0 ${inMonth ? '' : 'bg-neutral-50/50 text-neutral-400'}`}>
                <div className="flex items-center justify-between">
                  <button onClick={() => onNewOnDate(k)} className={`text-[11px] font-bold ${isToday ? 'rounded-full bg-brand-600 px-1.5 text-white' : 'hover:underline'}`}>{d.getDate()}</button>
                  {total > 0 && <span className="text-[10px] font-mono text-neutral-500">{(total / 60).toFixed(1)}h</span>}
                </div>
                <div className="mt-1 space-y-0.5">
                  {arr.slice(0, 2).map((e) => (
                    <button key={e.id} onClick={() => onEdit(e)} className="block w-full truncate rounded bg-emerald-50 px-1.5 py-0.5 text-left text-[10px] text-emerald-800 hover:bg-emerald-100">
                      {fmtTime(e.clockInAt)} {e.jobLabel || e.workOrderLabel || ''}
                    </button>
                  ))}
                  {arr.length > 2 && <div className="px-1.5 text-[10px] text-neutral-500">+{arr.length - 2} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// All Entries view
// ============================================================================
function EntriesView({ entries, loading, onSubmit, onEdit, onDelete, onDuplicate }) {
  const [filter, setFilter] = useState('all')
  const filtered = useMemo(() => {
    if (filter === 'all') return entries
    return entries.filter((e) => e.status === filter)
  }, [entries, filter])
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-3">
          {['all', 'completed', 'submitted', 'approved', 'rejected'].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${filter === s ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>{s}</button>
          ))}
        </CardContent>
      </Card>
      {loading ? (
        <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-neutral-500">No entries match this filter.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => <EntryRow key={e.id} entry={e} onSubmit={onSubmit} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} />)}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Approvals view (managers)
// ============================================================================
function ApprovalsView() {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/time-clock/manager/queue?status=submitted', { headers: authHeaders() })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Could not load'); setQueue([]); return }
      setQueue(j.entries || [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  const approve = async (id) => {
    setBusyId(id)
    try {
      const r = await fetch(`/api/time-clock/manager/${id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({}),
      })
      if (!r.ok) toast.error((await r.json()).error || 'Approve failed'); else toast.success('Approved')
      await load()
    } finally { setBusyId(null) }
  }
  const reject = async (id) => {
    const reason = prompt('Rejection reason?')
    if (!reason) return
    setBusyId(id)
    try {
      const r = await fetch(`/api/time-clock/manager/${id}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ reason }),
      })
      if (!r.ok) toast.error((await r.json()).error || 'Reject failed'); else toast.success('Rejected')
      await load()
    } finally { setBusyId(null) }
  }
  return (
    <div className="space-y-3">
      <Card><CardContent className="flex items-center justify-between p-3">
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Pending approvals · {queue.length}</div>
        <Button size="sm" variant="outline" onClick={load} className="gap-1.5"><TimerReset className="h-3.5 w-3.5" /> Refresh</Button>
      </CardContent></Card>
      {loading ? (
        <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</CardContent></Card>
      ) : queue.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-neutral-500">No entries waiting for approval. 🎉</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {queue.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{e.author?.name || 'Unknown'}</span>
                    <Badge className="text-[10px]">{e.author?.email}</Badge>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" disabled={busyId === e.id} onClick={() => approve(e.id)} className="gap-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>
                    <Button size="sm" disabled={busyId === e.id} onClick={() => reject(e.id)} variant="outline" className="gap-1 text-red-600"><X className="h-3.5 w-3.5" /> Reject</Button>
                  </div>
                </div>
                <div className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
                  <div><span className="text-neutral-500">Date:</span> <b>{e.date}</b></div>
                  <div><span className="text-neutral-500">Time:</span> {fmtTime(e.clockInAt)} → {fmtTime(e.clockOutAt)}</div>
                  <div><span className="text-neutral-500">Net:</span> <b>{fmtMinutes(e.netMinutes)}</b></div>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-600">
                  {e.jobLabel && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" /> {e.jobLabel}</span>}
                  {e.workOrderLabel && <span className="inline-flex items-center gap-1"><ClipboardList className="h-3 w-3" /> {e.workOrderLabel}</span>}
                  {e.vehicleLabel && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" /> {e.vehicleLabel}</span>}
                  {e.facilityName && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.facilityName}</span>}
                  {e.notes && <span className="inline-flex items-start gap-1"><FileText className="h-3 w-3 mt-0.5" /> {e.notes}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Settings view (rounding rules etc.)
// ============================================================================
function SettingsView({ settings, onSaved }) {
  const [form, setForm] = useState({
    roundToMinutes: settings?.roundToMinutes ?? 1,
    roundDirection: settings?.roundDirection ?? 'nearest',
    autoBreakMinutes: settings?.autoBreakMinutes ?? 0,
    managerEmail: settings?.managerEmail ?? '',
    defaultRate: settings?.defaultRate ?? 0,
  })
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/time-clock/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          roundToMinutes: Number(form.roundToMinutes),
          roundDirection: form.roundDirection,
          autoBreakMinutes: Number(form.autoBreakMinutes),
          managerEmail: form.managerEmail,
          defaultRate: Number(form.defaultRate),
        }),
      })
      const j = await r.json()
      if (!r.ok) toast.error(j.error || 'Save failed'); else { toast.success('Settings saved'); onSaved?.(j.settings) }
    } finally { setBusy(false) }
  }
  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div>
          <h3 className="text-base font-extrabold tracking-tight">Time Clock Settings</h3>
          <p className="text-xs text-neutral-500">Applied to every shift summary, weekly view, calendar, and export.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Round shift duration to nearest…</Label>
            <select className="mt-1 h-9 w-full rounded-md border border-neutral-300 px-2 text-sm" value={form.roundToMinutes} onChange={(e) => setForm({ ...form, roundToMinutes: e.target.value })}>
              <option value={1}>No rounding</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes (quarter hour)</option>
              <option value={30}>30 minutes (half hour)</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Rounding direction</Label>
            <select className="mt-1 h-9 w-full rounded-md border border-neutral-300 px-2 text-sm" value={form.roundDirection} onChange={(e) => setForm({ ...form, roundDirection: e.target.value })}>
              <option value="nearest">Nearest (default)</option>
              <option value="up">Always up</option>
              <option value="down">Always down</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Auto-deduct break (minutes)</Label>
            <Input type="number" min={0} max={120} value={form.autoBreakMinutes} onChange={(e) => setForm({ ...form, autoBreakMinutes: e.target.value })} />
            <p className="mt-1 text-[11px] text-neutral-500">Only applied when no breaks are logged and shift ≥ break+30m.</p>
          </div>
          <div>
            <Label className="text-xs">Default hourly rate ($)</Label>
            <Input type="number" min={0} step="0.5" value={form.defaultRate} onChange={(e) => setForm({ ...form, defaultRate: e.target.value })} />
            <p className="mt-1 text-[11px] text-neutral-500">Used for estimated earnings.</p>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Manager email (for emailed timesheets)</Label>
            <Input type="email" placeholder="manager@company.com" value={form.managerEmail} onChange={(e) => setForm({ ...form, managerEmail: e.target.value })} />
          </div>
        </div>

        <Button onClick={save} disabled={busy} className="bg-brand-600 hover:bg-brand-700">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save settings'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Active timer card
// ============================================================================
function ActiveTimerCard({ active, loading, busy, openBreak, elapsedSeconds, onClickClockIn, onClockOut, onBreakStart, onBreakEnd }) {
  if (loading && !active) {
    return <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</CardContent></Card>
  }
  if (!active) return null
  const onBreak = !!openBreak
  return (
    <Card className={`overflow-hidden border-2 ${onBreak ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-white' : 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white'}`}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-2 w-2 animate-pulse rounded-full ${onBreak ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${onBreak ? 'text-amber-700' : 'text-emerald-700'}`}>{onBreak ? 'On break' : 'On the clock'}</span>
            </div>
            <div className="mt-1 font-mono text-4xl font-extrabold tracking-tight tabular-nums text-neutral-900 sm:text-5xl">{fmtClockHM(elapsedSeconds)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
              <span className="inline-flex items-center gap-1"><Play className="h-3 w-3" /> Started {fmtTime(active.clockInAt)}</span>
              {(active.jobLabel || active.jobId) && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" /> {active.jobLabel || active.jobId}</span>}
              {active.workOrderLabel && <span className="inline-flex items-center gap-1"><ClipboardList className="h-3 w-3" /> {active.workOrderLabel}</span>}
              {active.vehicleLabel && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" /> {active.vehicleLabel}</span>}
              {active.facilityName && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {active.facilityName}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {onBreak ? (
              <Button onClick={onBreakEnd} disabled={busy} size="lg" className="h-12 gap-2 bg-amber-600 text-white hover:bg-amber-700"><TimerReset className="h-4 w-4" /> End Break</Button>
            ) : (
              <Button onClick={onBreakStart} disabled={busy} size="lg" variant="outline" className="h-12 gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"><Coffee className="h-4 w-4" /> Start Break</Button>
            )}
            <Button onClick={onClockOut} disabled={busy} size="lg" className="h-12 gap-2 bg-red-600 text-white hover:bg-red-700"><Square className="h-4 w-4" /> Clock Out</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// KPI tile
// ============================================================================
function KpiTile({ icon: Icon, label, value, sub, loading, tone = 'brand' }) {
  const toneCls = ({
    brand: 'text-brand-700 bg-brand-50',
    emerald: 'text-emerald-700 bg-emerald-50',
    amber: 'text-amber-700 bg-amber-50',
    red: 'text-red-700 bg-red-50',
    violet: 'text-violet-700 bg-violet-50',
  })[tone] || 'text-brand-700 bg-brand-50'
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${toneCls}`}><Icon className="h-3.5 w-3.5" /></span><span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</span></div>
        <div className="mt-2 text-lg font-extrabold tracking-tight text-neutral-900">{loading ? <Loader2 className="h-4 w-4 animate-spin text-neutral-400" /> : value}</div>
        {sub && <div className="mt-0.5 truncate text-[11px] text-neutral-500">{sub}</div>}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Entry row
// ============================================================================
function EntryRow({ entry, onSubmit, onEdit, onDelete, onDuplicate }) {
  const statusColor = STATUS_COLOR[entry.status] || 'bg-neutral-100 text-neutral-700'
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge className={`text-[10px] uppercase ${statusColor}`}>{entry.status}</Badge>
            {entry.isManualEntry && <Badge variant="outline" className="text-[10px]">Manual</Badge>}
            <span className="font-semibold text-neutral-800">{fmtDate(entry.clockInAt)}</span>
            <span className="text-neutral-500">·</span>
            <span className="text-neutral-700">{fmtTime(entry.clockInAt)} → {entry.clockOutAt ? fmtTime(entry.clockOutAt) : '…'}</span>
            <span className="text-neutral-500">·</span>
            <span className="font-mono font-bold text-neutral-900">{fmtMinutes(entry.netMinutes)}</span>
            {entry.breakMinutes > 0 && <span className="text-[11px] text-neutral-500">({fmtMinutes(entry.breakMinutes)} break)</span>}
          </div>
          <div className="flex items-center gap-1">
            {entry.status !== 'approved' && (
              <Button size="sm" variant="ghost" onClick={() => onEdit(entry)} className="h-7 gap-1 px-2 text-xs"><Edit3 className="h-3 w-3" /> Edit</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onDuplicate(entry.id)} className="h-7 gap-1 px-2 text-xs"><Copy className="h-3 w-3" /> Dup</Button>
            {entry.status === 'completed' && (
              <Button size="sm" variant="outline" onClick={() => onSubmit(entry.id)} className="h-7 gap-1 px-2 text-xs"><Send className="h-3 w-3" /> Submit</Button>
            )}
            {(entry.status === 'completed' || entry.status === 'rejected') && (
              <Button size="sm" variant="ghost" onClick={() => onDelete(entry.id)} className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3 w-3" /></Button>
            )}
          </div>
        </div>
        {(entry.jobLabel || entry.workOrderLabel || entry.vehicleLabel || entry.facilityName || entry.notes || entry.rejectionReason) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
            {entry.jobLabel && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" /> {entry.jobLabel}</span>}
            {entry.workOrderLabel && <span className="inline-flex items-center gap-1"><ClipboardList className="h-3 w-3" /> {entry.workOrderLabel}</span>}
            {entry.vehicleLabel && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" /> {entry.vehicleLabel}</span>}
            {entry.facilityName && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {entry.facilityName}</span>}
            {entry.notes && <span className="inline-flex items-start gap-1"><FileText className="h-3 w-3 mt-0.5" /> {entry.notes.slice(0, 80)}{entry.notes.length > 80 ? '…' : ''}</span>}
            {entry.rejectionReason && <span className="inline-flex items-start gap-1 text-red-600"><AlertCircle className="h-3 w-3 mt-0.5" /> Rejected: {entry.rejectionReason}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Clock-In dialog
// ============================================================================
function ClockInDialog({ open, onClose, onSubmit, busy }) {
  const [form, setForm] = useState({ jobLabel: '', workOrderLabel: '', vehicleLabel: '', facilityName: '', notes: '' })
  useEffect(() => { if (!open) setForm({ jobLabel: '', workOrderLabel: '', vehicleLabel: '', facilityName: '', notes: '' }) }, [open])
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Play className="h-4 w-4 text-emerald-600" /> Clock In</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Job / project (optional)</Label><Input value={form.jobLabel} onChange={(e) => setForm({ ...form, jobLabel: e.target.value })} placeholder="e.g. Demo cleanout — 3rd & Main" /></div>
          <div><Label className="text-xs">Work order (optional)</Label><Input value={form.workOrderLabel} onChange={(e) => setForm({ ...form, workOrderLabel: e.target.value })} placeholder="WO# or short name" /></div>
          <div><Label className="text-xs">Vehicle (optional)</Label><Input value={form.vehicleLabel} onChange={(e) => setForm({ ...form, vehicleLabel: e.target.value })} placeholder="e.g. Truck-12" /></div>
          <div><Label className="text-xs">Facility / site (optional)</Label><Input value={form.facilityName} onChange={(e) => setForm({ ...form, facilityName: e.target.value })} placeholder="e.g. North Bay Transfer Station" /></div>
          <div><Label className="text-xs">Notes (optional)</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => onSubmit(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, (v || '').trim() || undefined])))} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="mr-1 h-4 w-4" /> Clock In</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Entry create/edit dialog
// ============================================================================
function EntryDialog({ open, entry, initialDate, onClose, onSaved }) {
  const isEdit = !!entry?.id
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    if (entry?.id) {
      setForm({
        clockInAt: toLocalInput(entry.clockInAt),
        clockOutAt: entry.clockOutAt ? toLocalInput(entry.clockOutAt) : '',
        jobLabel: entry.jobLabel || '', workOrderLabel: entry.workOrderLabel || '',
        vehicleLabel: entry.vehicleLabel || '', facilityName: entry.facilityName || '',
        notes: entry.notes || '',
      })
    } else {
      const base = initialDate ? new Date(initialDate + 'T09:00') : new Date()
      const end = new Date(base); end.setHours(end.getHours() + 1)
      setForm({
        clockInAt: toLocalInput(base), clockOutAt: toLocalInput(end),
        jobLabel: '', workOrderLabel: '', vehicleLabel: '', facilityName: '', notes: '',
      })
    }
  }, [open, entry, initialDate])

  const save = async () => {
    if (!form.clockInAt || !form.clockOutAt) { toast.error('Clock in/out times are required'); return }
    setBusy(true)
    try {
      const payload = {
        clockInAt: fromLocalInput(form.clockInAt),
        clockOutAt: fromLocalInput(form.clockOutAt),
        jobLabel: form.jobLabel || null, workOrderLabel: form.workOrderLabel || null,
        vehicleLabel: form.vehicleLabel || null, facilityName: form.facilityName || null,
        notes: form.notes || '',
      }
      const url = isEdit ? `/api/time-clock/entries/${entry.id}` : '/api/time-clock/entries'
      const method = isEdit ? 'PATCH' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload) })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Save failed'); return }
      toast.success(isEdit ? 'Entry updated' : 'Manual entry created')
      onSaved()
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit3 className="h-4 w-4 text-brand-600" /> {isEdit ? 'Edit shift' : 'New manual entry'}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">Clock in</Label><Input type="datetime-local" value={form.clockInAt || ''} onChange={(e) => setForm({ ...form, clockInAt: e.target.value })} /></div>
          <div><Label className="text-xs">Clock out</Label><Input type="datetime-local" value={form.clockOutAt || ''} onChange={(e) => setForm({ ...form, clockOutAt: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Job / project</Label><Input value={form.jobLabel || ''} onChange={(e) => setForm({ ...form, jobLabel: e.target.value })} placeholder="e.g. Bayside Cleanup" /></div>
          <div><Label className="text-xs">Work order</Label><Input value={form.workOrderLabel || ''} onChange={(e) => setForm({ ...form, workOrderLabel: e.target.value })} /></div>
          <div><Label className="text-xs">Vehicle</Label><Input value={form.vehicleLabel || ''} onChange={(e) => setForm({ ...form, vehicleLabel: e.target.value })} placeholder="e.g. Truck-12" /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Facility / site</Label><Input value={form.facilityName || ''} onChange={(e) => setForm({ ...form, facilityName: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Notes</Label><Textarea rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="bg-brand-600 hover:bg-brand-700">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Date helpers
// ============================================================================
function mondayOf(d) {
  const day = d.getDay() // 0=Sun
  const offset = (day + 6) % 7
  const m = new Date(d); m.setDate(d.getDate() - offset); m.setHours(0, 0, 0, 0)
  return m
}
function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}
