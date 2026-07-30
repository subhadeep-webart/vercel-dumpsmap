'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Building2 } from 'lucide-react'

// Internal tab bar switching between residential status filters and the B2B
// view. The container supplies the tab definitions plus current selection so
// this stays a controlled, presentational strip.
export default function MarketplaceSubNav({ tabs, marketView, statusChip, listingsCount }) {
  return (
    <Card className="mb-5 border-neutral-200">
      <CardContent className="flex flex-wrap items-center gap-1.5 p-2">
        {tabs.map((t) => {
          const isActive =
            (t.key === 'commercial_b2b' && marketView === 'commercial_b2b') ||
            (marketView === 'residential' && (
              (t.key === 'browse'      && statusChip === 'all') ||
              (t.key === 'free'        && statusChip === 'free') ||
              (t.key === 'for_sale'    && statusChip === 'fixed') ||
              (t.key === 'on_truck'    && statusChip === 'on_truck') ||
              (t.key === 'at_site'     && statusChip === 'at_site') ||
              (t.key === 'last_chance' && statusChip === 'last_chance')
            ))
          const isCommercial = t.key === 'commercial_b2b'
          return (
            <button
              key={t.key}
              onClick={t.filter}
              className={`inline-flex min-h-[20px] md:min-h-[40px] items-center gap-1 rounded-md px-4 py-1 md:py-2 text-sm font-bold transition ${isActive ? (isCommercial ? 'bg-indigo-600 text-white shadow-sm' : 'bg-brand-600 text-white shadow-sm') : 'text-neutral-700 hover:bg-neutral-100'}`}
            >
              {isCommercial && <Building2 className={`h-4 w-4 ${isActive ? '' : 'text-indigo-600'}`} />}
              {t.label}
            </button>
          )
        })}
        <span className="ml-auto hidden text-xs text-neutral-500 md:inline">
          {marketView === 'commercial_b2b' ? 'B2B exchange' : `${listingsCount} item${listingsCount === 1 ? '' : 's'} shown`}
        </span>
      </CardContent>
    </Card>
  )
}
