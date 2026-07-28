'use client'

import { Check } from 'lucide-react'
import { PROFILE_TYPE_BY_KEY, resolveProfileType } from '@/lib/community-categories'
import { ProfileTypeIcon } from '@/lib/community-icons'

const COLOR_CLASS = {
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  orange:  'bg-orange-100 text-orange-800 border-orange-200',
  blue:    'bg-blue-100 text-blue-800 border-blue-200',
  green:   'bg-brand-100 text-brand-800 border-brand-200',
  purple:  'bg-purple-100 text-purple-800 border-purple-200',
  cyan:    'bg-cyan-100 text-cyan-800 border-cyan-200',
  slate:   'bg-slate-100 text-slate-800 border-slate-200',
  lime:    'bg-lime-100 text-lime-800 border-lime-200',
  amber:   'bg-amber-100 text-amber-800 border-amber-200',
  red:     'bg-red-100 text-red-800 border-red-200',
}

/**
 * <RoleBadge user={...} /> — small role pill shown across posts/comments/listings.
 *   - Accepts either a full user object OR a `profileType` string directly.
 *   - Falls back to legacy primaryProfile / profileTypes[0] / 'resident' via resolver.
 *   - Two sizes: 'xs' (default, inline) and 'sm'.
 *
 * Props:
 *   user           — user-shape object
 *   profileType    — explicit string override
 *   size           — 'xs' | 'sm' (default 'xs')
 *   showLabel      — show label text (default true)
 *   verified       — show small ✓ when user.verificationLevel != 'normal_user'
 *   className      — extra classes
 */
export default function RoleBadge({ user, profileType, size = 'xs', showLabel = true, verified, className = '' }) {
  const key = profileType || (user ? resolveProfileType(user) : 'resident')
  const meta = PROFILE_TYPE_BY_KEY[key] || PROFILE_TYPE_BY_KEY.resident
  const isVerified = verified ?? (user && user.verificationLevel && user.verificationLevel !== 'normal_user')
  const cls = COLOR_CLASS[meta.color] || COLOR_CLASS.neutral
  const sizeCls = size === 'sm'
    ? 'px-2 py-0.5 text-[11px] gap-1'
    : 'px-1.5 py-[1px] text-[10px] gap-0.5'
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-wide ${cls} ${sizeCls} ${className}`} title={meta.label}>
      <ProfileTypeIcon profileKey={key} className="h-3 w-3" />
      {showLabel && <span>{meta.label}</span>}
      {isVerified && <span className="ml-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-white" title="Verified"><Check className="h-2 w-2" strokeWidth={3} /></span>}
    </span>
  )
}
