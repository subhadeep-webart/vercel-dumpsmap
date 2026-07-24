'use client'

import React from 'react'
import {
  Sofa, Refrigerator, Cpu, Hammer, Wrench, Briefcase, UtensilsCrossed,
  Lightbulb, Package, Boxes, Gem, Gamepad2, Dumbbell, Layers, Image as ImageIcon,
} from 'lucide-react'

// Map category → { icon, tint, label } for visually-distinct placeholders.
// Tint is a tailwind gradient pair. Icon comes from lucide-react.
const CATEGORY_META = {
  'Furniture':              { icon: Sofa,            tint: 'from-amber-50 to-orange-100',  fg: 'text-amber-700',  label: 'Furniture' },
  'Appliances':             { icon: Refrigerator,    tint: 'from-sky-50 to-blue-100',      fg: 'text-sky-700',    label: 'Appliances' },
  'Electronics':            { icon: Cpu,             tint: 'from-indigo-50 to-violet-100', fg: 'text-indigo-700', label: 'Electronics' },
  'Construction Materials': { icon: Hammer,          tint: 'from-stone-100 to-stone-200',  fg: 'text-stone-700',  label: 'Building Materials' },
  'Materials':              { icon: Layers,          tint: 'from-stone-100 to-stone-200',  fg: 'text-stone-700',  label: 'Materials' },
  'Scrap Metal':            { icon: Wrench,          tint: 'from-zinc-100 to-zinc-200',    fg: 'text-zinc-700',   label: 'Scrap Metal' },
  'Tools':                  { icon: Wrench,          tint: 'from-yellow-50 to-amber-100',  fg: 'text-amber-800',  label: 'Tools' },
  'Office Furniture':       { icon: Briefcase,       tint: 'from-slate-50 to-slate-200',   fg: 'text-slate-700',  label: 'Office Furniture' },
  'Restaurant Equipment':   { icon: UtensilsCrossed, tint: 'from-rose-50 to-pink-100',     fg: 'text-rose-700',   label: 'Restaurant Equipment' },
  'Fixtures':               { icon: Lightbulb,       tint: 'from-yellow-50 to-amber-100',  fg: 'text-amber-700',  label: 'Fixtures' },
  'Pallets':                { icon: Boxes,           tint: 'from-orange-50 to-amber-100',  fg: 'text-orange-700', label: 'Pallets' },
  'Household Goods':        { icon: Package,         tint: 'from-teal-50 to-emerald-100',  fg: 'text-teal-700',   label: 'Household Goods' },
  'Collectibles':           { icon: Gem,             tint: 'from-violet-50 to-purple-100', fg: 'text-violet-700', label: 'Collectibles' },
  'Toys & Games':           { icon: Gamepad2,        tint: 'from-pink-50 to-rose-100',     fg: 'text-pink-700',   label: 'Toys & Games' },
  'Sporting Goods':         { icon: Dumbbell,        tint: 'from-emerald-50 to-green-100', fg: 'text-emerald-700', label: 'Sporting Goods' },
  'Other':                  { icon: ImageIcon,       tint: 'from-neutral-50 to-neutral-200', fg: 'text-neutral-500', label: 'No image yet' },
}
const FALLBACK = { icon: ImageIcon, tint: 'from-neutral-50 to-neutral-200', fg: 'text-neutral-400', label: 'No image yet' }

export default function CategoryPlaceholder({ category, className = '', size = 'md', showLabel = true }) {
  const meta = (category && CATEGORY_META[category]) || FALLBACK
  const Icon = meta.icon
  const iconSize = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs'
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${meta.tint} ${className}`}>
      <Icon className={`${iconSize} ${meta.fg}`} aria-hidden="true" />
      {showLabel && (
        <div className={`mt-1.5 font-semibold ${meta.fg} ${textSize} px-2 text-center leading-tight`}>
          {meta.label}
        </div>
      )}
    </div>
  )
}

export { CATEGORY_META }
