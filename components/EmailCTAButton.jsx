'use client'

// EmailCTAButton
// ---------------------------------------------------------------------------
// Cloudflare's free "Email Address Obfuscation" feature rewrites any static
// `<a href="mailto:...">` it finds in server-rendered HTML, turning the href
// into `/cdn-cgi/l/email-protection#<hex>`. If the visitor's browser does not
// successfully run Cloudflare's email-decode client script (blocked, slow,
// strict CSP, ad-blocker, etc.) the link 404s instead of opening their mail
// client.
//
// This component avoids the static href entirely: it renders a <button> and
// constructs the `mailto:` URL only at click time, so Cloudflare's HTML-level
// rewrite never sees an address to obfuscate.
//
// Usage:
//   <EmailCTAButton recipient="jamal@dumpmaps.org" subject="..." body="...">
//     <BadgeCheck /> Apply for Verification <ArrowRight />
//   </EmailCTAButton>

import React from 'react'

export default function EmailCTAButton({
  recipient,
  subject = '',
  body = '',
  className = '',
  children,
  onAfterClick,
}) {
  const handleClick = (e) => {
    e.preventDefault()
    if (!recipient) return
    const qs = []
    if (subject) qs.push(`subject=${encodeURIComponent(subject)}`)
    if (body)    qs.push(`body=${encodeURIComponent(body)}`)
    const url = `mailto:${recipient}${qs.length ? '?' + qs.join('&') : ''}`
    if (typeof window !== 'undefined') window.location.href = url
    if (typeof onAfterClick === 'function') onAfterClick()
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  )
}
