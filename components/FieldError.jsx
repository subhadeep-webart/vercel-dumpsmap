'use client'

import { AlertCircle } from 'lucide-react'

/**
 * FieldError — inline validation error shown beneath a form field.
 * Renders nothing when `msg` is empty, so it can be dropped under any input.
 *
 * @param {{ msg?: string, className?: string }} props
 */
export default function FieldError({ msg, className = '' }) {
  if (!msg) return null
  return (
    <p className={`mt-1 flex items-center gap-1 text-[12px] font-medium text-red-600 ${className}`} role="alert">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {msg}
    </p>
  )
}
