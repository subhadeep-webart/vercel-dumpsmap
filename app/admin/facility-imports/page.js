'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  Upload, FilePlus, ListChecks, CheckCircle2, XCircle, GitMerge, Search,
  AlertTriangle, Link2, ExternalLink, ShieldCheck, ShieldAlert, ShieldQuestion,
  RefreshCw, Pencil, Database, ChevronDown, ChevronRight, HelpCircle, Eye,
  Sparkles, Zap, Layers,
} from 'lucide-react'
import AdminPageFrame from '@/components/admin/AdminPageFrame'

const SOURCE_TYPES = [
  { v: 'calrecycle', label: 'CalRecycle SWIS (official)' },
  { v: 'gov_official', label: 'City / County official page' },
  { v: 'official_website', label: 'Facility official website' },
  { v: 'csv_curated', label: 'Curated CSV import' },
  { v: 'manual', label: 'Manual entry (admin)' },
  { v: 'other', label: 'Other / unknown' },
]
const TYPE_KEYS = ['transfer_station', 'recycling_center', 'construction_debris', 'landfill', 'donation_dropoff', 'scrap_metal', 'e_waste', 'household_hazardous', 'green_waste', 'composting', 'other']

const NEEDS_DETAILS_REASONS = [
  { v: 'missing_address', label: 'Missing address' },
  { v: 'missing_website', label: 'Missing website' },
  { v: 'missing_phone', label: 'Missing phone' },
  { v: 'missing_hours', label: 'Missing hours' },
  { v: 'missing_materials', label: 'Missing accepted materials' },
  { v: 'duplicate_possible', label: 'Duplicate possible' },
  { v: 'low_confidence', label: 'Low confidence score' },
  { v: 'other', label: 'Other (see notes)' },
]

function confidenceTone(score) {
  if (score >= 90) return { row: 'border-l-4 border-l-brand-500', chip: 'bg-brand-100 text-brand-800 border-brand-200', icon: <ShieldCheck className="h-3.5 w-3.5" />, label: 'Auto-approve ready' }
  if (score >= 80) return { row: 'border-l-4 border-l-blue-300', chip: 'bg-blue-100 text-blue-800 border-blue-200', icon: <ShieldCheck className="h-3.5 w-3.5" />, label: 'Review recommended' }
  if (score >= 60) return { row: 'border-l-4 border-l-amber-400', chip: 'bg-amber-100 text-amber-800 border-amber-200', icon: <ShieldQuestion className="h-3.5 w-3.5" />, label: 'Flag for review' }
  return { row: 'border-l-4 border-l-red-500', chip: 'bg-red-100 text-red-800 border-red-200', icon: <ShieldAlert className="h-3.5 w-3.5" />, label: 'Manual review required' }
}

function statusBadge(status) {
  switch (status) {
    case 'pending':       return <Badge variant="outline" className="border-neutral-300 bg-white text-neutral-700">Pending</Badge>
    case 'needs_details': return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Needs Details</Badge>
    case 'approved':      return <Badge variant="outline" className="border-brand-300 bg-brand-50 text-brand-800">Approved</Badge>
    case 'rejected':      return <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">Rejected</Badge>
    case 'merged':        return <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700">Merged</Badge>
    default:              return <Badge variant="outline">{status}</Badge>
  }
}

const SAMPLE_CSV = `name,address,city,state,zip,type,phone,website,accepted,pricing,source_url,source_type,hours
Mission Trail Waste Systems,1080 Walsh Ave,Santa Clara,CA,95050,transfer_station,(408) 727-5060,https://missiontrail.com,"wood;concrete;dirt;green waste",Paid disposal $65-$110/ton,https://www2.calrecycle.ca.gov/SWFacilities/Directory/,calrecycle,Mon-Fri 6a-5p
Zanker Recycling,675 Los Esteros Rd,San Jose,CA,95134,construction_debris,(408) 263-2384,https://zankerrecycling.com,"construction debris;concrete;wood;metal",Variable pricing,https://www2.calrecycle.ca.gov/SWFacilities/Directory/,calrecycle,Mon-Sat 6a-5p`

export default function AdminFacilityImports() {
  const { authFetch } = useAdmin()
  const [tab, setTab] = useState('queue')
  const [imports, setImports] = useState([])
  const [counts, setCounts] = useState({})
  const [metrics, setMetrics] = useState({})
  const [statusFilter, setStatusFilter] = useState('pending')
  const [confFilter, setConfFilter] = useState('all')
  const [searchQ, setSearchQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState({})  // map of id → bool
  const [selected, setSelected] = useState({})  // map of id → bool
  const [busyId, setBusyId] = useState(null)
  const [needsDetailsModal, setNeedsDetailsModal] = useState(null) // { ids: [], single: bool }
  const [bulkRejectModal, setBulkRejectModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  // CSV / Manual states
  const [csvText, setCsvText] = useState('')
  const [csvUploading, setCsvUploading] = useState(false)
  const [manual, setManual] = useState({
    name: '', address: '', city: '', state: 'CA', zip: '', typeKey: 'transfer_station',
    phone: '', website: '', hours: '', accepted: '', notAccepted: '',
    pricingNotes: '', paymentMethods: '', sourceUrl: '', sourceType: 'gov_official',
    notes: '', lat: '', lng: '', scaleRequired: false, contractorFriendly: false,
  })
  const [manualDupes, setManualDupes] = useState([])
  const [manualSubmitting, setManualSubmitting] = useState(false)

  const loadImports = useCallback(async () => {
    setLoading(true)
    const r = await authFetch(`/api/admin/facility-imports?status=${statusFilter}&limit=500`)
    if (r.ok) {
      const j = await r.json()
      setImports(j.imports || [])
      setCounts(j.counts || {})
      setMetrics(j.metrics || {})
    }
    setLoading(false)
  }, [statusFilter, authFetch])

  useEffect(() => { loadImports() }, [loadImports])
  useEffect(() => { setSelected({}); setExpanded({}) }, [statusFilter, searchQ, confFilter])

  // Filter rows in memory
  const filtered = useMemo(() => {
    let arr = imports
    if (searchQ) {
      const q = searchQ.toLowerCase()
      arr = arr.filter((im) => {
        const n = im.normalizedData || {}
        return n.name?.toLowerCase().includes(q) || n.address?.toLowerCase().includes(q) || n.city?.toLowerCase().includes(q) || n.county?.toLowerCase().includes(q) || im.sourceType?.toLowerCase().includes(q)
      })
    }
    if (confFilter !== 'all') {
      arr = arr.filter((im) => {
        if (confFilter === 'high') return im.confidenceScore >= 90
        if (confFilter === 'med') return im.confidenceScore >= 80 && im.confidenceScore < 90
        if (confFilter === 'low') return im.confidenceScore >= 60 && im.confidenceScore < 80
        if (confFilter === 'manual') return im.confidenceScore < 60
        return true
      })
    }
    return arr
  }, [imports, searchQ, confFilter])

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected])
  const allSelectedOnPage = filtered.length > 0 && filtered.every((im) => selected[im.id])

  // ---- single actions ----
  const approveOne = async (id) => {
    setBusyId(id)
    try {
      const r = await authFetch(`/api/admin/facility-imports/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve' }),
      })
      if (r.ok) {
        // Optimistic update — instantly move/disappear from current filter
        setImports((prev) => prev.map((im) => im.id === id ? { ...im, status: 'approved' } : im))
        toast.success('Approved & published')
        loadImports()
      } else {
        const e = await r.json().catch(() => ({}))
        toast.error(e.error ? `Approve failed: ${e.error}` : `Approve failed (HTTP ${r.status})`)
      }
    } catch (err) {
      toast.error(`Approve failed: ${err?.message || 'Network error'}`)
    } finally {
      setBusyId(null)
    }
  }
  const rejectOne = async (id) => {
    const reason = window.prompt('Reason for rejecting? (optional)') ?? null
    if (reason === null) return // cancelled
    setBusyId(id)
    try {
      const r = await authFetch(`/api/admin/facility-imports/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject', reason }),
      })
      if (r.ok) {
        setImports((prev) => prev.map((im) => im.id === id ? { ...im, status: 'rejected' } : im))
        toast.success('Rejected')
        loadImports()
      } else {
        const e = await r.json().catch(() => ({}))
        toast.error(e.error ? `Reject failed: ${e.error}` : `Reject failed (HTTP ${r.status})`)
      }
    } catch (err) {
      toast.error(`Reject failed: ${err?.message || 'Network error'}`)
    } finally {
      setBusyId(null)
    }
  }
  const submitNeedsDetails = async ({ ids, reasons, notes }) => {
    try {
      if (ids.length === 1) {
        const r = await authFetch(`/api/admin/facility-imports/${ids[0]}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'needs_details', reasons, notes }),
        })
        if (r.ok) {
          setImports((prev) => prev.map((im) => im.id === ids[0] ? { ...im, status: 'needs_details', needsDetailsReasons: reasons, needsDetailsNotes: notes } : im))
          toast.success('Marked Needs Details'); setNeedsDetailsModal(null); loadImports()
        } else {
          const e = await r.json().catch(() => ({})); toast.error(e.error || `Failed (HTTP ${r.status})`)
        }
      } else {
        const r = await authFetch('/api/admin/facility-imports/bulk-needs-details', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, reasons, notes }),
        })
        if (r.ok) {
          const j = await r.json(); toast.success(`Flagged ${j.flagged} as Needs Details`)
          setSelected({}); setNeedsDetailsModal(null); loadImports()
        } else {
          const e = await r.json().catch(() => ({})); toast.error(e.error || 'Bulk needs-details failed')
        }
      }
    } catch (err) {
      toast.error(`Failed: ${err?.message || 'Network error'}`)
    }
  }
  const mergeOne = async (im, targetId) => {
    setBusyId(im.id)
    const r = await authFetch(`/api/admin/facility-imports/${im.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'merge', targetFacilityId: targetId }),
    })
    setBusyId(null)
    if (r.ok) { const j = await r.json(); toast.success(`Merged · filled ${(j.fields || []).length} field(s)`); loadImports() } else { toast.error('Merge failed') }
  }

  // ---- bulk actions ----
  const bulkApprove = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Approve & publish ${selectedIds.length} record${selectedIds.length === 1 ? '' : 's'} to the live facility feed?`)) return
    const r = await authFetch('/api/admin/facility-imports/bulk-approve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selectedIds }),
    })
    if (r.ok) { const j = await r.json(); toast.success(`Approved ${j.approved} · skipped ${j.skipped}`); setSelected({}); loadImports() } else { toast.error('Bulk approve failed') }
  }
  const bulkRejectSubmit = async (reason) => {
    const r = await authFetch('/api/admin/facility-imports/bulk-reject', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selectedIds, reason }),
    })
    if (r.ok) { const j = await r.json(); toast.success(`Rejected ${j.rejected}`); setSelected({}); setBulkRejectModal(false); loadImports() } else { toast.error('Bulk reject failed') }
  }
  const bulkMerge = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Auto-merge ${selectedIds.length} record(s) into their top duplicate match? Records without a detected duplicate will be skipped.`)) return
    const r = await authFetch('/api/admin/facility-imports/bulk-merge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selectedIds }),
    })
    if (r.ok) { const j = await r.json(); toast.success(`Merged ${j.merged} · skipped ${j.skipped}`); setSelected({}); loadImports() } else { toast.error('Bulk merge failed') }
  }

  // ---- CSV upload ----
  const uploadCsv = async () => {
    if (!csvText.trim()) return toast.error('Paste CSV content first')
    setCsvUploading(true)
    const r = await authFetch('/api/admin/facility-imports/csv', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv: csvText }),
    })
    setCsvUploading(false)
    if (!r.ok) { const e = await r.json().catch(() => ({})); return toast.error(e.error || 'Upload failed') }
    const j = await r.json()
    toast.success(`Parsed ${j.totalRows} rows · created ${j.created} drafts · ${j.dupesFound} flagged`)
    setCsvText(''); setTab('queue'); setStatusFilter('pending'); loadImports()
  }
  const onCsvFile = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => setCsvText(e.target?.result || '')
    reader.readAsText(file)
  }

  // ---- Manual ----
  useEffect(() => {
    if (!manual.name || !manual.address) { setManualDupes([]); return }
    const t = setTimeout(async () => {
      const p = new URLSearchParams({ name: manual.name, address: manual.address, city: manual.city })
      const r = await authFetch(`/api/admin/facility-imports/duplicate-check?${p}`)
      if (r.ok) setManualDupes((await r.json()).dupes || [])
    }, 500)
    return () => clearTimeout(t)
  }, [manual.name, manual.address, manual.city, authFetch])
  const submitManual = async () => {
    if (!manual.name || !manual.address) return toast.error('Name and address are required')
    setManualSubmitting(true)
    const body = { ...manual, type: manual.typeKey, lat: manual.lat ? parseFloat(manual.lat) : null, lng: manual.lng ? parseFloat(manual.lng) : null }
    const r = await authFetch('/api/admin/facility-imports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setManualSubmitting(false)
    if (!r.ok) { const e = await r.json().catch(() => ({})); return toast.error(e.error || 'Failed') }
    toast.success('Draft saved')
    setManual({ name: '', address: '', city: '', state: 'CA', zip: '', typeKey: 'transfer_station', phone: '', website: '', hours: '', accepted: '', notAccepted: '', pricingNotes: '', paymentMethods: '', sourceUrl: '', sourceType: 'gov_official', notes: '', lat: '', lng: '', scaleRequired: false, contractorFriendly: false })
    setManualDupes([]); setTab('queue'); setStatusFilter('pending'); loadImports()
  }

  return (
    <AdminPageFrame>
      {/* Header (page title) — fixed */}
      <AdminPageFrame.Header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              <Database className="h-6 w-6 text-blue-600" /> Facility Data Imports
            </h1>
            <p className="text-sm text-neutral-500">
              Modern moderation workflow. Quick actions, bulk operations, and inline previews — built for processing hundreds of records.
            </p>
          </div>
        </div>
      </AdminPageFrame.Header>

      {/* KPI counters — fixed */}
      <AdminPageFrame.Kpis className="!py-2">
        <div className="flex flex-wrap gap-2">
          <MetricCard label="Pending Review" value={counts.pending || 0} tone="neutral" icon={ListChecks} />
          <MetricCard label="Needs Details" value={metrics.needsDetailsCount || counts.needs_details || 0} tone="amber" icon={HelpCircle} />
          <MetricCard label="Approved Today" value={metrics.approvedToday || 0} tone="brand" icon={CheckCircle2} />
          <MetricCard label="Rejected Today" value={metrics.rejectedToday || 0} tone="red" icon={XCircle} />
          <MetricCard label="Duplicates Found" value={metrics.duplicatesFound || 0} tone="blue" icon={GitMerge} />
        </div>
      </AdminPageFrame.Kpis>

      {/* Tabs row — fixed */}
      <AdminPageFrame.Toolbar className="!py-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="queue"><ListChecks className="mr-1 h-4 w-4" /> Review Queue</TabsTrigger>
            <TabsTrigger value="csv"><Upload className="mr-1 h-4 w-4" /> CSV Import</TabsTrigger>
            <TabsTrigger value="manual"><FilePlus className="mr-1 h-4 w-4" /> Manual Entry</TabsTrigger>
          </TabsList>
        </Tabs>
      </AdminPageFrame.Toolbar>

      {/* Filter / search bar — fixed (only on queue tab) */}
      {tab === 'queue' && (
        <AdminPageFrame.Toolbar>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending ({counts.pending || 0})</SelectItem>
                <SelectItem value="needs_details">Needs Details ({metrics.needsDetailsCount || counts.needs_details || 0})</SelectItem>
                <SelectItem value="approved">Approved ({counts.approved || 0})</SelectItem>
                <SelectItem value="merged">Merged ({counts.merged || 0})</SelectItem>
                <SelectItem value="rejected">Rejected ({counts.rejected || 0})</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
              </SelectContent>
            </Select>
            <Select value={confFilter} onValueChange={setConfFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Any confidence" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All confidence</SelectItem>
                <SelectItem value="high">90%+ · Auto-approve ready</SelectItem>
                <SelectItem value="med">80-89% · Review recommended</SelectItem>
                <SelectItem value="low">60-79% · Flag for review</SelectItem>
                <SelectItem value="manual">Below 60% · Manual review</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search name / city / county / source…" className="w-72 pl-8" />
            </div>
            <Button variant="outline" size="sm" onClick={loadImports} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border-2 border-blue-300 bg-blue-50 px-2 py-1">
                <span className="text-xs font-semibold text-blue-900">{selectedIds.length} selected</span>
                <Button size="sm" className="h-7 bg-brand-600 px-2 hover:bg-brand-700" onClick={bulkApprove}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve</Button>
                <Button size="sm" variant="outline" className="h-7 border-amber-400 bg-amber-50 px-2 text-amber-800 hover:bg-amber-100" onClick={() => setNeedsDetailsModal({ ids: selectedIds, single: false })}><HelpCircle className="mr-1 h-3.5 w-3.5" /> Needs</Button>
                <Button size="sm" variant="outline" className="h-7 border-blue-400 bg-blue-50 px-2 text-blue-800 hover:bg-blue-100" onClick={bulkMerge}><GitMerge className="mr-1 h-3.5 w-3.5" /> Merge</Button>
                <Button size="sm" variant="outline" className="h-7 border-red-400 bg-red-50 px-2 text-red-700 hover:bg-red-100" onClick={() => setBulkRejectModal(true)}><XCircle className="mr-1 h-3.5 w-3.5" /> Reject</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setSelected({})}>Clear</Button>
              </div>
            )}
            <div className="ml-auto text-xs text-neutral-500">{filtered.length} record{filtered.length === 1 ? '' : 's'}</div>
          </div>
        </AdminPageFrame.Toolbar>
      )}

      {/* Body — scrolling content */}
      {tab === 'queue' && (
        <AdminPageFrame.BodyTable
          header={
            <div className="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-wide text-neutral-500">
              <Checkbox
                aria-label="Select all"
                checked={allSelectedOnPage}
                onCheckedChange={(v) => {
                  if (v) { const s = {}; filtered.forEach((im) => { s[im.id] = true }); setSelected(s) }
                  else setSelected({})
                }}
              />
              <span className="w-6" />
              <span className="flex-1">Facility</span>
              <span className="hidden w-32 md:block">Confidence</span>
              <span className="hidden w-28 md:block">Source</span>
              <span className="hidden w-24 md:block">Status</span>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-neutral-500">
              {loading ? 'Loading…' : 'No imports match this filter.'}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {filtered.map((im) => {
                const n = im.normalizedData || {}
                const tone = confidenceTone(im.confidenceScore)
                const isExpanded = !!expanded[im.id]
                const dupes = im.duplicateMatches || []
                const isActionable = ['pending', 'needs_details'].includes(im.status)
                const toggle = () => setExpanded((e) => ({ ...e, [im.id]: !e[im.id] }))
                return (
                  <li key={im.id} className={`bg-white ${tone.row}`}>
                    {/* ----- ROW (clickable except on controls) ----- */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={toggle}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
                      className="group relative flex items-start gap-2 px-2 py-2.5 hover:bg-neutral-50 focus:outline-none focus-visible:bg-neutral-100 sm:px-3"
                    >
                      {/* Stop-propagation wrapper so the checkbox click never bubbles to row toggle */}
                      <div onClick={(e) => e.stopPropagation()} className="flex-none pt-0.5">
                        <Checkbox
                          aria-label="Select row"
                          checked={!!selected[im.id]}
                          onCheckedChange={(v) => setSelected((s) => ({ ...s, [im.id]: !!v }))}
                        />
                      </div>
                      {/* Chevron — explicit toggle target */}
                      <button
                        type="button"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        aria-expanded={isExpanded}
                        onClick={(e) => { e.stopPropagation(); toggle() }}
                        className="flex-none rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>

                      {/* Title block + meta. flex-1 + min-w-0 so it shrinks. */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <span className="text-sm font-semibold text-neutral-900 group-hover:underline">
                            {n.name || '(no name)'}
                          </span>
                          {dupes.length > 0 && (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-800">
                              <AlertTriangle className="mr-0.5 h-2.5 w-2.5" /> {dupes.length} dup
                            </Badge>
                          )}
                          {/* Mobile-only inline status badge */}
                          <span className="md:hidden">{statusBadge(im.status)}</span>
                        </div>
                        <div className="mt-0.5 line-clamp-2 break-words text-xs text-neutral-600">
                          {[n.address, n.city, n.county, n.state].filter(Boolean).join(' · ') || '—'}
                        </div>
                        {/* Mobile-only meta row */}
                        <div className="mt-1 flex flex-wrap items-center gap-1 md:hidden">
                          <Badge variant="outline" className={`flex items-center gap-1 border ${tone.chip} text-[10px]`}>
                            {tone.icon} {im.confidenceScore}%
                          </Badge>
                          <Badge variant="outline" className="border-neutral-200 text-[10px] uppercase">{im.sourceType || '—'}</Badge>
                        </div>
                      </div>

                      {/* Desktop columns */}
                      <div className="hidden w-32 shrink-0 md:block">
                        <Badge variant="outline" className={`flex w-fit items-center gap-1 border ${tone.chip}`}>
                          {tone.icon} {im.confidenceScore}%
                        </Badge>
                        <div className="mt-0.5 text-[10px] text-neutral-500">{tone.label}</div>
                      </div>
                      <div className="hidden w-28 shrink-0 truncate md:block">
                        <Badge variant="outline" className="border-neutral-200 text-[10px] uppercase tracking-wide">{im.sourceType || '—'}</Badge>
                      </div>
                      <div className="hidden w-24 shrink-0 md:block">{statusBadge(im.status)}</div>
                    </div>

                    {/* ----- ACTION BAR — separate row, never overlaps; full-width on mobile ----- */}
                    <div className="flex flex-wrap items-center justify-end gap-1 border-t border-neutral-100 bg-neutral-50/60 px-2 py-1.5 sm:px-3">
                      {isActionable ? (
                        <>
                          <Button
                            size="sm"
                            className="h-8 bg-brand-600 px-2.5 text-white hover:bg-brand-700 disabled:opacity-50"
                            disabled={busyId === im.id}
                            onClick={(e) => { e.stopPropagation(); approveOne(im.id) }}
                          >
                            {busyId === im.id ? <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                            <span>Approve</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-amber-400 bg-amber-50 px-2.5 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            disabled={busyId === im.id}
                            onClick={(e) => { e.stopPropagation(); setNeedsDetailsModal({ ids: [im.id], single: true, currentReasons: im.needsDetailsReasons || [], currentNotes: im.needsDetailsNotes || '' }) }}
                          >
                            <HelpCircle className="mr-1 h-3.5 w-3.5" /> <span>Needs Details</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-red-400 bg-red-50 px-2.5 text-red-700 hover:bg-red-100 disabled:opacity-50"
                            disabled={busyId === im.id}
                            onClick={(e) => { e.stopPropagation(); rejectOne(im.id) }}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" /> <span>Reject</span>
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" className="h-8" onClick={(e) => { e.stopPropagation(); setEditTarget(im) }}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> <span>View / Edit</span>
                        </Button>
                      )}
                    </div>

                    {isExpanded && (
                      <div onClick={(e) => e.stopPropagation()} className="border-t border-neutral-100 bg-neutral-50/60 px-2 py-3 sm:px-10">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs md:grid-cols-3 lg:grid-cols-4">
                          <PreviewKV label="Type" value={n.typeKey} />
                          <PreviewKV label="Phone" value={n.phone || '— call to verify'} muted={!n.phone} />
                          <PreviewKV label="Website" value={n.website} link />
                          <PreviewKV label="Hours" value={n.hours || '— call to confirm'} muted={!n.hours} />
                          <PreviewKV label="Accepted" value={Array.isArray(n.accepted) ? n.accepted.join(', ') : n.accepted} />
                          <PreviewKV label="Not accepted" value={Array.isArray(n.notAccepted) ? n.notAccepted.join(', ') : n.notAccepted} />
                          <PreviewKV label="Pricing" value={n.pricingNotes || '— call to confirm'} muted={!n.pricingNotes} />
                          <PreviewKV label="Source URL" value={im.sourceUrl} link />
                          <PreviewKV label="ZIP" value={n.zip} />
                          <PreviewKV label="County" value={n.county} />
                          <PreviewKV label="Lat / Lng" value={n.lat && n.lng ? `${n.lat.toFixed(3)}, ${n.lng.toFixed(3)}` : '—'} muted={!n.lat} />
                          <PreviewKV label="Verified" value={im.lastVerifiedAt ? new Date(im.lastVerifiedAt).toLocaleDateString() : '—'} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-md border border-neutral-200 bg-white p-2 text-[11px] text-neutral-600">
                          <Sparkles className="h-3 w-3 text-blue-500" />
                          <span className="font-semibold">Why {im.confidenceScore}%?</span>
                          <span>Base 30 ·</span>
                          {im.sourceType === 'calrecycle' && <span>+20 CalRecycle ·</span>}
                          {im.sourceType === 'gov_official' && <span>+20 Gov source ·</span>}
                          {im.sourceType === 'official_website' && <span>+12 Official site ·</span>}
                          {im.sourceType === 'csv_curated' && <span>+10 Curated CSV ·</span>}
                          {im.sourceUrl && <span>+15 Source URL ·</span>}
                          {n.phone && <span>+5 Phone ·</span>}
                          {n.website && <span>+5 Website ·</span>}
                          {Array.isArray(n.accepted) && n.accepted.length > 0 && <span>+5 Materials ·</span>}
                          {n.hours && <span>+5 Hours ·</span>}
                          {n.lat && n.lng && <span>+8 Coordinates ·</span>}
                          {im.lastVerifiedAt && <span>+7 Verified date</span>}
                        </div>
                        {dupes.length > 0 && (
                          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                            <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-900">
                              <AlertTriangle className="h-3.5 w-3.5" /> Possible duplicate{dupes.length === 1 ? '' : 's'}
                            </div>
                            <ul className="space-y-1">
                              {dupes.map((d) => (
                                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-white px-2 py-1.5 text-xs">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-neutral-900">{d.name}</div>
                                    <div className="text-[11px] text-neutral-600">{d.address} · {d.city} · {d.similarity}% match</div>
                                  </div>
                                  <div className="flex gap-1">
                                    <a href={`/facilities/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] hover:bg-neutral-100">
                                      <ExternalLink className="h-2.5 w-2.5" /> View Existing
                                    </a>
                                    {['pending', 'needs_details'].includes(im.status) && (
                                      <button onClick={() => mergeOne(im, d.id)} disabled={busyId === im.id} className="inline-flex items-center gap-0.5 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-800 hover:bg-blue-100">
                                        <GitMerge className="h-2.5 w-2.5" /> Merge
                                      </button>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {im.status === 'needs_details' && (im.needsDetailsReasons?.length || im.needsDetailsNotes) && (
                          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                            <div className="font-semibold">Flagged for follow-up</div>
                            {im.needsDetailsReasons?.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {im.needsDetailsReasons.map((r) => <Badge key={r} variant="outline" className="border-amber-300 bg-white text-amber-800 text-[10px]">{NEEDS_DETAILS_REASONS.find((x) => x.v === r)?.label || r}</Badge>)}
                              </div>
                            )}
                            {im.needsDetailsNotes && <div className="mt-1 text-[11px] italic">"{im.needsDetailsNotes}"</div>}
                          </div>
                        )}
                        <div className="mt-2 flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditTarget(im)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Open full editor
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </AdminPageFrame.BodyTable>
      )}

      {tab === 'csv' && (
        <AdminPageFrame.Body>
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="text-base font-bold">CSV / SWIS bulk import</h2>
              <p className="text-xs text-neutral-500">Headers: <code className="rounded bg-neutral-100 px-1">name, address, city, state, zip, type, phone, website, hours, accepted, pricing, source_url, source_type, lat, lng</code></p>
              <div className="flex flex-wrap items-center gap-2">
                <input id="facility-csv-file" type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onCsvFile(e.target.files[0])} />
                <label htmlFor="facility-csv-file" className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">
                  <Upload className="h-3.5 w-3.5" /> Pick .csv file
                </label>
                <Button variant="outline" size="sm" onClick={() => setCsvText(SAMPLE_CSV)}>Load sample</Button>
                <Button variant="outline" size="sm" onClick={() => setCsvText('')}>Clear</Button>
                <div className="ml-auto text-xs text-neutral-500">
                  {csvText ? `${csvText.split('\n').filter(Boolean).length - 1} data rows ready` : 'No file loaded'}
                </div>
              </div>
              <Textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="Paste CSV content here…" className="min-h-[260px] font-mono text-xs" />
              <div className="flex justify-end"><Button onClick={uploadCsv} disabled={csvUploading || !csvText.trim()}>{csvUploading ? 'Parsing…' : 'Parse & queue rows'}</Button></div>
            </CardContent>
          </Card>
        </AdminPageFrame.Body>
      )}

      {tab === 'manual' && (
        <AdminPageFrame.Body>
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="text-base font-bold">Manual single-record entry</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Facility name *" value={manual.name} onChange={(v) => setManual({ ...manual, name: v })} />
                <Field label="Street address *" value={manual.address} onChange={(v) => setManual({ ...manual, address: v })} />
                <Field label="City" value={manual.city} onChange={(v) => setManual({ ...manual, city: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="State" value={manual.state} onChange={(v) => setManual({ ...manual, state: v })} />
                  <Field label="ZIP" value={manual.zip} onChange={(v) => setManual({ ...manual, zip: v })} />
                </div>
                <div>
                  <Label className="text-xs">Facility type</Label>
                  <Select value={manual.typeKey} onValueChange={(v) => setManual({ ...manual, typeKey: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPE_KEYS.map((k) => <SelectItem key={k} value={k}>{k.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Source type</Label>
                  <Select value={manual.sourceType} onValueChange={(v) => setManual({ ...manual, sourceType: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{SOURCE_TYPES.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Field label="Source URL" value={manual.sourceUrl} onChange={(v) => setManual({ ...manual, sourceUrl: v })} className="md:col-span-2" />
                <Field label="Phone" value={manual.phone} onChange={(v) => setManual({ ...manual, phone: v })} />
                <Field label="Website" value={manual.website} onChange={(v) => setManual({ ...manual, website: v })} />
                <Field label="Hours" value={manual.hours} onChange={(v) => setManual({ ...manual, hours: v })} className="md:col-span-2" />
                <Field label="Accepted (; or ,)" value={manual.accepted} onChange={(v) => setManual({ ...manual, accepted: v })} className="md:col-span-2" />
                <Field label="Latitude" value={manual.lat} onChange={(v) => setManual({ ...manual, lat: v })} />
                <Field label="Longitude" value={manual.lng} onChange={(v) => setManual({ ...manual, lng: v })} />
              </div>
              {manualDupes.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
                  <div className="mb-1 flex items-center gap-1 font-semibold text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5" /> {manualDupes.length} possible existing facilit{manualDupes.length === 1 ? 'y' : 'ies'}
                  </div>
                  <ul className="space-y-1 text-amber-900">
                    {manualDupes.map((d) => <li key={d.id}>• <span className="font-semibold">{d.name}</span> — {d.address}, {d.city} <span className="text-amber-700">({d.similarity}%)</span></li>)}
                  </ul>
                </div>
              )}
              <div className="flex justify-end"><Button onClick={submitManual} disabled={manualSubmitting || !manual.name || !manual.address}>{manualSubmitting ? 'Saving…' : 'Queue draft'}</Button></div>
            </CardContent>
          </Card>
        </AdminPageFrame.Body>
      )}

      <NeedsDetailsModal
        open={!!needsDetailsModal}
        onClose={() => setNeedsDetailsModal(null)}
        bulk={!needsDetailsModal?.single}
        idsCount={needsDetailsModal?.ids?.length || 0}
        initialReasons={needsDetailsModal?.currentReasons || []}
        initialNotes={needsDetailsModal?.currentNotes || ''}
        onSubmit={(reasons, notes) => submitNeedsDetails({ ids: needsDetailsModal.ids, reasons, notes })}
      />

      <Dialog open={bulkRejectModal} onOpenChange={(o) => !o && setBulkRejectModal(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {selectedIds.length} records?</DialogTitle>
            <DialogDescription>Provide an optional reason. Records will be marked rejected; admins can review in the Rejected filter.</DialogDescription>
          </DialogHeader>
          <BulkRejectForm onSubmit={bulkRejectSubmit} />
        </DialogContent>
      </Dialog>

      <FullEditDialog target={editTarget} onClose={() => setEditTarget(null)} authFetch={authFetch} onSaved={loadImports} />
    </AdminPageFrame>
  )
}


function MetricCard({ label, value, tone, icon: Icon }) {
  const tones = {
    neutral: 'border-neutral-200 bg-white text-neutral-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    brand: 'border-brand-200 bg-brand-50 text-brand-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
  }
  return (
    <div className={`flex-1 min-w-[130px] rounded-lg border p-2.5 ${tones[tone] || tones.neutral}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-75">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 text-xl font-bold">{value}</div>
    </div>
  )
}

function PreviewKV({ label, value, muted, link }) {
  const display = value || '—'
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</div>
      <div className={`truncate ${muted ? 'italic text-neutral-500' : 'text-neutral-800'}`}>
        {link && value ? <a href={value} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{display}</a> : display}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, className = '' }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <Input value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-1" />
    </div>
  )
}

function NeedsDetailsModal({ open, onClose, bulk, idsCount, initialReasons, initialNotes, onSubmit }) {
  const [reasons, setReasons] = useState(initialReasons || [])
  const [notes, setNotes] = useState(initialNotes || '')
  useEffect(() => { if (open) { setReasons(initialReasons || []); setNotes(initialNotes || '') } }, [open, initialReasons, initialNotes])
  const toggle = (v) => setReasons((rs) => rs.includes(v) ? rs.filter((x) => x !== v) : [...rs, v])
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-600" />
            {bulk ? `Mark ${idsCount} records as Needs Details` : 'Mark as Needs Details'}
          </DialogTitle>
          <DialogDescription>Pick reasons so this record reappears in the "Needs Details" queue for follow-up.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {NEEDS_DETAILS_REASONS.map((r) => (
            <label key={r.v} className="flex items-center gap-2 rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm hover:bg-neutral-50">
              <Checkbox checked={reasons.includes(r.v)} onCheckedChange={() => toggle(r.v)} />
              {r.label}
            </label>
          ))}
        </div>
        <div>
          <Label className="text-xs">Admin notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 text-sm" rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!reasons.length} onClick={() => onSubmit(reasons, notes)} className="bg-amber-600 hover:bg-amber-700">Flag</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BulkRejectForm({ onSubmit }) {
  const [reason, setReason] = useState('')
  return (
    <>
      <div>
        <Label className="text-xs">Reason (optional)</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 text-sm" rows={3} placeholder="e.g., Out of business / out of scope" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onSubmit('')}>Skip reason</Button>
        <Button className="bg-red-600 hover:bg-red-700" onClick={() => onSubmit(reason)}>Reject</Button>
      </DialogFooter>
    </>
  )
}

function FullEditDialog({ target, onClose, authFetch, onSaved }) {
  const [draft, setDraft] = useState(null)
  useEffect(() => { setDraft(target ? { ...target.normalizedData } : null) }, [target])
  if (!target || !draft) return null
  const save = async () => {
    const payload = {
      action: 'edit',
      normalizedData: {
        ...draft,
        accepted: typeof draft.accepted === 'string' ? draft.accepted.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : draft.accepted,
        notAccepted: typeof draft.notAccepted === 'string' ? draft.notAccepted.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : draft.notAccepted,
        paymentMethods: typeof draft.paymentMethods === 'string' ? draft.paymentMethods.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : draft.paymentMethods,
      },
    }
    const r = await authFetch(`/api/admin/facility-imports/${target.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (r.ok) { toast.success('Saved'); onSaved?.(); onClose() } else { toast.error('Save failed') }
  }
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> Full editor — {target.normalizedData?.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
          <Field label="Address" value={draft.address} onChange={(v) => setDraft({ ...draft, address: v })} />
          <Field label="City" value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} />
          <Field label="County" value={draft.county} onChange={(v) => setDraft({ ...draft, county: v })} />
          <Field label="State" value={draft.state} onChange={(v) => setDraft({ ...draft, state: v })} />
          <Field label="ZIP" value={draft.zip} onChange={(v) => setDraft({ ...draft, zip: v })} />
          <Field label="Phone" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
          <Field label="Website" value={draft.website} onChange={(v) => setDraft({ ...draft, website: v })} />
          <Field label="Hours" value={draft.hours} onChange={(v) => setDraft({ ...draft, hours: v })} className="md:col-span-2" />
          <Field label="Accepted" value={Array.isArray(draft.accepted) ? draft.accepted.join('; ') : draft.accepted} onChange={(v) => setDraft({ ...draft, accepted: v })} className="md:col-span-2" />
          <Field label="Source URL" value={draft.sourceUrl} onChange={(v) => setDraft({ ...draft, sourceUrl: v })} className="md:col-span-2" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
