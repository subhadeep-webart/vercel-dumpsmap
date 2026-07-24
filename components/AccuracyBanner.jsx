'use client'

import React from 'react'
import { Phone, AlertCircle } from 'lucide-react'

/**
 * Reusable mini-banner shown on detail surfaces (facility, marketplace, jobs) to set
 * accurate expectations while the platform is still in MVP/pilot. Keeps user trust
 * high and reduces support questions.
 */
export function AccuracyBanner({ kind = 'facility', className = '' }) {
  const COPY = {
    facility:  { icon: Phone,       text: 'Facility details may change. Call ahead before arrival.' },
    pricing:   { icon: AlertCircle, text: 'Pricing should be confirmed directly with the facility.' },
    payments:  { icon: AlertCircle, text: 'Payments are not active yet — connect your account in Settings when you’re ready.' },
    map:       { icon: AlertCircle, text: 'Map view is optional and may require future integration.' },
  }
  const c = COPY[kind] || COPY.facility
  const Icon = c.icon
  return (
    <div className={`flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 ${className}`}>
      <Icon className="mt-0.5 h-3 w-3 shrink-0" />
      <span>{c.text}</span>
    </div>
  )
}

export default AccuracyBanner
