'use client'

// Shared primitives for the facility detail page.
//
// Small presentational building blocks reused across the detail tabs, sidebar,
// and secondary cards. Extracted from app/facilities/[id]/page.js so each
// larger component can import just the pieces it needs.

import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'

export function SectionCard({ icon: Icon, title, iconClass = 'text-green-600', action, children }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-4 w-4 ${iconClass}`} /> {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function Field({ icon: Icon, label, value, link, href, placeholder }) {
  const isEmpty = !value
  const display = isEmpty ? (placeholder || '—') : value
  let content
  if (link && !isEmpty) {
    content = <a href={value} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline">{value}</a>
  } else if (href && !isEmpty) {
    content = <a href={href} className="text-green-700 hover:underline">{value}</a>
  } else {
    content = <span className={isEmpty && placeholder ? 'italic text-neutral-500' : ''}>{display}</span>
  }
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
        <div className="truncate text-neutral-800">{content}</div>
      </div>
    </div>
  )
}

export function KV({ label, value }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</span>
      <div className="font-semibold text-neutral-900">{value}</div>
    </div>
  )
}

export function formatNumber(n, decimals = 0) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const num = Number(n)
  if (decimals > 0) return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return Math.round(num).toLocaleString()
}
