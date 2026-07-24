'use client'

// Secondary content cards rendered inside the Overview tab: live status banner,
// accepted-materials preview, pricing preview, and contractor intel. Extracted
// from app/facilities/[id]/page.js.

import { Clock, CheckCircle2, DollarSign, Activity, AlertTriangle } from 'lucide-react'

export function LiveStatusCard({ facility, statusMeta }) {
  const status = statusMeta || (
    facility.openNow === false
      ? { label: 'Closed', icon: '🔴', color: 'red' }
      : facility.openNow === true
        ? { label: 'Open Now', icon: '🟢', color: 'green' }
        : { label: 'Status unknown', icon: '⚪', color: 'amber' }
  )
  const themeMap = {
    green: { bg: 'from-green-50 to-white', border: 'border-green-300', text: 'text-green-900', pill: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
    red:   { bg: 'from-red-50 to-white',   border: 'border-red-300',   text: 'text-red-900',   pill: 'bg-red-100 text-red-800',     dot: 'bg-red-500' },
    amber: { bg: 'from-amber-50 to-white', border: 'border-amber-300', text: 'text-amber-900', pill: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500' },
    blue:  { bg: 'from-blue-50 to-white',  border: 'border-blue-300',  text: 'text-blue-900',  pill: 'bg-blue-100 text-blue-800',   dot: 'bg-blue-500' },
  }
  const t = themeMap[status.color] || themeMap.amber
  const lastAlert = (facility.activeAlerts || [])[0]
  const lastUpdated = lastAlert?.createdAt || facility.updatedAt

  return (
    <div className={`rounded-2xl border-2 ${t.border} bg-gradient-to-br ${t.bg} p-4 shadow-sm`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${t.dot}`} />
              <span className={`relative inline-flex h-3 w-3 rounded-full ${t.dot}`} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Live status</span>
          </div>
          <div className={`mt-1 flex items-center gap-2 text-2xl font-extrabold ${t.text}`}>
            <span className="text-3xl leading-none">{status.icon}</span>
            <span>{status.label}</span>
          </div>
          {lastUpdated && (
            <div className="mt-1 text-[11px] text-neutral-600">
              Last update: <span className="font-semibold">{new Date(lastUpdated).toLocaleString()}</span>
            </div>
          )}
        </div>
        {facility.hours && (
          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${t.pill}`}>
            <Clock className="-mt-0.5 mr-1 inline h-3 w-3" />
            {facility.hours}
          </div>
        )}
      </div>
    </div>
  )
}

export function AcceptedMaterialsCard({ facility, compact }) {
  const accepted = facility.accepted || []
  const limit = compact ? 8 : accepted.length
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-sm font-bold text-neutral-900">What they take</span>
      </div>
      {accepted.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {accepted.slice(0, limit).map((m) => (
            <span key={m} className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
              <CheckCircle2 className="h-3 w-3" /> {m}
            </span>
          ))}
          {compact && accepted.length > limit && (
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">+{accepted.length - limit} more</span>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs italic text-neutral-500">Not yet verified. Call to confirm.</p>
      )}
    </div>
  )
}

export function PricingPreviewCard({ facility }) {
  const fields = facility.pricingFields || {}
  const pricing = facility.pricing
  const headlinePrice =
    fields.pricePerTon ? `$${fields.pricePerTon}/ton` :
    fields.pricePerPound ? `$${fields.pricePerPound}/lb` :
    fields.pricePerItem ? `$${fields.pricePerItem}/item` :
    (pricing && typeof pricing === 'object' && pricing.pricePerTon) ? `$${pricing.pricePerTon}/ton` :
    null
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-green-600" />
        <span className="text-sm font-bold text-neutral-900">Pricing</span>
      </div>
      {facility.pricingUnknown ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">⚠ Call to confirm pricing.</p>
      ) : headlinePrice ? (
        <div className="mt-2 text-3xl font-extrabold tracking-tight text-green-700">{headlinePrice}</div>
      ) : typeof pricing === 'string' && pricing ? (
        <p className="mt-2 text-sm text-neutral-800">{pricing}</p>
      ) : (
        <p className="mt-2 text-xs italic text-neutral-500">Pricing not yet posted.</p>
      )}
    </div>
  )
}

export function ContractorIntelCard({ facility }) {
  const notes = facility.contractorNotes || []
  const alerts = facility.activeAlerts || []
  const hazardAlerts = alerts.filter((a) => /scale|not_accepting|hazard|closed_unexpected/i.test(a.type || ''))
  const positiveAlerts = alerts.filter((a) => /no_wait|accepting|free|moving_fast/i.test(a.type || ''))
  const hasIntel = notes.length > 0 || hazardAlerts.length > 0 || positiveAlerts.length > 0

  if (!hasIntel) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-neutral-400" />
          <span className="text-sm font-bold text-neutral-700">Contractor Intel</span>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          No tips reported yet. Be the first to share a wait time, hours change, or scale issue.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-600" />
          <span className="text-sm font-bold text-neutral-900">Contractor Intel</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">Community-verified</span>
      </div>
      {hazardAlerts.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">Heads-up</div>
          {hazardAlerts.slice(0, 3).map((a) => (
            <div key={a.id} className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
              <span className="text-red-900"><b>{a.type?.replace(/_/g, ' ')}</b> — {a.text || a.message || 'flagged by community'}</span>
            </div>
          ))}
        </div>
      )}
      {notes.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Things to know</div>
          <div className="flex flex-wrap gap-1.5">
            {notes.map((n) => (
              <span key={n} className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800">⚠ {n}</span>
            ))}
          </div>
        </div>
      )}
      {positiveAlerts.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-green-700">Good signals</div>
          {positiveAlerts.slice(0, 3).map((a) => (
            <div key={a.id} className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-2 text-xs">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
              <span className="text-green-900"><b>{a.type?.replace(/_/g, ' ')}</b> — {a.text || a.message || 'reported by community'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
