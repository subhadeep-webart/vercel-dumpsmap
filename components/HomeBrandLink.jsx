'use client'

// A drop-in replacement for <Link href="/"> wrapped around the DumpMaps logo.
//
// SSR-safe: first render uses "/" so HTML hydration matches. Right after mount
// we peek at localStorage.dm_token; if a token is present, the link is
// upgraded to "/dashboard". This means logged-in users never get bounced
// through the marketing landing page on a logo click.
//
// Use this component in any header logo. For headers that already have access
// to a `user` prop, you can also just pass it as href directly via the regular
// Link, but this saves plumbing on pages that don't already track auth state.

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function HomeBrandLink({ children, className = '', ariaLabel = null, fallbackHref = '/' }) {
  const [authed, setAuthed] = useState(false)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('dm_token')) setAuthed(true)
    } catch {}
  }, [])
  const href = authed ? '/dashboard' : fallbackHref
  const label = ariaLabel || (authed ? 'DumpMaps dashboard' : 'DumpMaps home')
  return (
    <Link href={href} className={className} aria-label={label}>
      {children}
    </Link>
  )
}
