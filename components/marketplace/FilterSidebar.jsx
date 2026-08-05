'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, ChevronDown, ChevronUp, Crosshair, Heart, LayoutGrid, MapPin } from 'lucide-react'
import MarketDropdown from '@/components/marketplace/MarketDropdown'
import {
  CATEGORIES, CONDITIONS, DISTANCE_PRESETS, PRICE_BUCKETS,
} from '@/constants/marketplace_constants'

// How many categories to reveal before the "See more" toggle. Keeps the filter
// list short and scannable instead of a long wall of 16 categories.
const CATEGORY_PREVIEW_COUNT = 5

// Distance presets mapped to the shared dropdown's { value, label } shape.
// `null` (Statewide) is encoded as the sentinel string 'state' for the dropdown.
const DISTANCE_OPTIONS = DISTANCE_PRESETS.map((p) => ({
  value: p.value == null ? 'state' : String(p.value),
  label: p.label,
}))

// Labeled group wrapper for a block of filter controls.
function Section({ title, children }) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

// Single-select radio-style filter row (used for categories).
function FilterRadio({ value, label, current, onChange, icon: Icon, disabled }) {
  if (disabled) return null
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-neutral-700 hover:bg-neutral-50'}`}
    >
      {Icon && <Icon className="h-4 w-4 text-neutral-400" />}
      <span className="flex-1">{label}</span>
      {active && <span className="text-xs">●</span>}
    </button>
  )
}

// Left column: location, category, condition, and price filters plus the
// alerts CTA. Purely controlled — all state lives in the container.
export default function FilterSidebar({
  coordsLabel, onUseMyLocation,
  distancePreset, onDistanceChange,
  cat, onCatChange,
  condition, onConditionChange,
  priceBucket, onPriceBucketChange,
}) {
  const [showAllCats, setShowAllCats] = useState(false)

  // Collapse the category list to a short preview. If the currently selected
  // category sits past the cutoff, keep it visible so the active filter never
  // hides behind "See more".
  const selectedIdx = CATEGORIES.indexOf(cat)
  const cutoff = showAllCats
    ? CATEGORIES.length
    : Math.max(CATEGORY_PREVIEW_COUNT, selectedIdx + 1)
  const visibleCats = CATEGORIES.slice(0, cutoff)
  const hiddenCount = CATEGORIES.length - visibleCats.length

  return (
    <aside className="space-y-4">
      <Card className="border-neutral-200">
        <CardContent className="space-y-4 p-5">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Near me</div>
            <Button variant="outline" onClick={onUseMyLocation} className="w-full justify-start">
              <Crosshair className="mr-2 h-4 w-4 text-brand-600" /> {coordsLabel}
            </Button>
            <div className="mt-2">
              <MarketDropdown
                options={DISTANCE_OPTIONS}
                value={distancePreset == null ? 'state' : String(distancePreset)}
                onChange={(v) => onDistanceChange(v === 'state' ? null : Number(v))}
                icon={MapPin}
                menuWidth="w-[calc(100%)]"
              />
            </div>
          </div>
          <Section title="Categories">
            <FilterRadio value="" label="All Categories" current={cat} onChange={onCatChange} icon={LayoutGrid} />
            <FilterRadio value="free-cat" label="Free" current={cat} onChange={onCatChange} icon={Heart} disabled />
            {visibleCats.map((c) => (
              <FilterRadio key={c} value={c} label={c} current={cat} onChange={onCatChange} />
            ))}
            {(hiddenCount > 0 || showAllCats) && (
              <button
                type="button"
                onClick={() => setShowAllCats((v) => !v)}
                className="mt-1 inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
              >
                {showAllCats ? (
                  <>Show less <ChevronUp className="h-3.5 w-3.5" /></>
                ) : (
                  <>See more <span className="text-neutral-400">({hiddenCount})</span> <ChevronDown className="h-3.5 w-3.5" /></>
                )}
              </button>
            )}
          </Section>
          <Section title="Condition">
            {CONDITIONS.map((c) => (
              <label key={c.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={condition === c.value} onChange={(e) => onConditionChange(e.target.checked ? c.value : '')} className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500" />
                {c.label}
              </label>
            ))}
          </Section>
          <Section title="Price">
            {PRICE_BUCKETS.map((b) => (
              <label key={b.v} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="price" checked={priceBucket === b.v} onChange={() => onPriceBucketChange(b.v)} className="h-4 w-4 border-neutral-300 text-brand-600 focus:ring-brand-500" />
                {b.l}
              </label>
            ))}
          </Section>
        </CardContent>
      </Card>
      <Card className="border-neutral-200 bg-gradient-to-br from-brand-50 to-white">
        <CardContent className="space-y-2 p-5">
          <div className="flex items-center gap-2 text-brand-800"><Bell className="h-4 w-4" /><span className="text-sm font-bold">Get Notified</span></div>
          <p className="text-xs text-neutral-600">Never miss great items near you!</p>
          <Button variant="outline" className="w-full border-brand-300 text-brand-700">Enable Alerts</Button>
        </CardContent>
      </Card>
    </aside>
  )
}
