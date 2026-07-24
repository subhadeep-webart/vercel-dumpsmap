'use client'

// SafeImage
// ---------------------------------------------------------------------------
// Universal <img> wrapper that NEVER shows the browser's broken-image glyph.
// On image load error (404, CORS, blocked, etc.) it swaps to a branded
// placeholder. Variants tune the placeholder to fit the surface.
//
// Usage:
//   <SafeImage src={user.profileImage} alt="" kind="avatar" className="h-8 w-8 rounded-full" />
//   <SafeImage src={listing.photos?.[0]} alt={listing.title} kind="listing" className="aspect-[4/3] w-full object-cover" />
//   <SafeImage src={facility.photoUrl} alt="" kind="facility" className="h-32 w-full object-cover" />
//
// Reasons we don't use next/image:
//   • next.config.js has `images.unoptimized: true` (we serve from MongoDB + /api/files)
//   • Need full control over fallback rendering and DOM swap behavior
//
// To intentionally render nothing when there's no src (instead of a placeholder),
// pass `fallbackWhenEmpty="none"`.

import React, { useState, useEffect } from 'react'
import { Boxes, MapPin, User, ImageOff, Newspaper, Truck, Briefcase } from 'lucide-react'

const KIND_DEFAULTS = {
  avatar:   { Icon: User,       bg: 'bg-gradient-to-br from-brand-100 to-brand-50',   fg: 'text-brand-600' },
  facility: { Icon: MapPin,     bg: 'bg-gradient-to-br from-emerald-100 to-emerald-50', fg: 'text-emerald-600' },
  listing:  { Icon: Boxes,      bg: 'bg-gradient-to-br from-neutral-100 to-neutral-50', fg: 'text-neutral-400' },
  post:     { Icon: Newspaper,  bg: 'bg-gradient-to-br from-blue-100 to-blue-50',     fg: 'text-blue-500' },
  vehicle:  { Icon: Truck,      bg: 'bg-gradient-to-br from-amber-100 to-amber-50',   fg: 'text-amber-600' },
  job:      { Icon: Briefcase,  bg: 'bg-gradient-to-br from-indigo-100 to-indigo-50', fg: 'text-indigo-600' },
  banner:   { Icon: ImageOff,   bg: 'bg-gradient-to-br from-neutral-100 to-white',    fg: 'text-neutral-300' },
}

function normalizeSrc(src) {
  if (!src) return ''
  if (typeof src !== 'string') return ''
  // Normalize legacy /uploads/* to /api/files/*
  if (src.startsWith('/uploads/')) return `/api/files/${src.slice('/uploads/'.length)}`
  return src
}

function Placeholder({ kind = 'listing', className = '', label }) {
  const cfg = KIND_DEFAULTS[kind] || KIND_DEFAULTS.listing
  const Icon = cfg.Icon
  return (
    <div
      className={`flex items-center justify-center ${cfg.bg} ${className}`}
      role="img"
      aria-label={label || 'Image unavailable'}
    >
      <div className="flex flex-col items-center gap-1 opacity-70">
        <Icon className={`h-8 w-8 ${cfg.fg}`} strokeWidth={1.5} />
        <div className="hidden text-[10px] font-bold uppercase tracking-wider opacity-70 group-hover/safeimg:block">
          {label || ''}
        </div>
      </div>
    </div>
  )
}

export default function SafeImage({
  src,
  alt = '',
  kind = 'listing',
  className = '',
  fallbackWhenEmpty = 'placeholder',  // 'placeholder' | 'none'
  fallbackLabel,
  loading = 'lazy',
  decoding = 'async',
  draggable,
  onLoad,
  ...rest
}) {
  const normalized = normalizeSrc(src)
  const [errored, setErrored] = useState(false)

  // If src changes, reset the error state so we re-try the new src
  useEffect(() => { setErrored(false) }, [normalized])

  // No src at all
  if (!normalized) {
    if (fallbackWhenEmpty === 'none') return null
    return <Placeholder kind={kind} className={className} label={fallbackLabel} />
  }
  if (errored) {
    return <Placeholder kind={kind} className={className} label={fallbackLabel || 'Image unavailable'} />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={normalized}
      alt={alt}
      loading={loading}
      decoding={decoding}
      draggable={draggable}
      onError={() => setErrored(true)}
      onLoad={onLoad}
      className={className}
      {...rest}
    />
  )
}
