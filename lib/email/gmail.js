// lib/email/gmail.js
// Gmail SMTP transporter singleton (nodemailer).
// Behaviour:
//   • If GMAIL_USER + GMAIL_APP_PASSWORD are set → real Gmail transporter
//   • If either is missing → getTransporter() returns null (email is skipped
//     gracefully). Callers save the message to Mongo + queue an admin
//     notification so nothing is lost until Gmail is configured.
//
// Environment variables:
//   GMAIL_USER            — the Gmail account used for SMTP auth (required)
//   GMAIL_APP_PASSWORD    — 16-char Google App Password (required)
//   GMAIL_FROM_NAME       — display name in From header (optional, default 'DumpMaps')
//   GMAIL_FROM_EMAIL      — sender email; defaults to GMAIL_USER when unset
//
// Docs: https://nodemailer.com/smtp/  &  Google App Passwords doc.

import nodemailer from 'nodemailer'

let cachedTransporter = null
let cachedConfig = null

export function getGmailConfig() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null
  return {
    user,
    pass,
    fromName:  process.env.GMAIL_FROM_NAME  || 'DumpMaps',
    fromEmail: process.env.GMAIL_FROM_EMAIL || user,
  }
}

export function isEmailConfigured() {
  return !!getGmailConfig()
}

// Returns the transporter, or null if Gmail isn't configured. Never throws.
export function getTransporter() {
  const cfg = getGmailConfig()
  if (!cfg) return null
  // If credentials changed mid-run, rebuild.
  const sig = `${cfg.user}:${cfg.pass.slice(-4)}`
  if (cachedTransporter && cachedConfig === sig) return cachedTransporter
  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: cfg.user, pass: cfg.pass },
  })
  cachedConfig = sig
  return cachedTransporter
}

// Helper: escape user-supplied text for safe HTML interpolation.
export function escHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Send an email. Returns { ok: true, messageId } on success or
// { ok: false, skipped: true, reason } when Gmail isn't configured.
// Never throws — catches SMTP errors and returns { ok:false, error }.
export async function sendEmail({ to, subject, html, text, replyTo, from }) {
  const transporter = getTransporter()
  const cfg = getGmailConfig()
  if (!transporter || !cfg) {
    return { ok: false, skipped: true, reason: 'GMAIL_USER / GMAIL_APP_PASSWORD not set' }
  }
  try {
    const info = await transporter.sendMail({
      from:     from    || `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to,
      subject,
      html,
      text,
      replyTo:  replyTo || undefined,
    })
    return { ok: true, messageId: info?.messageId, accepted: info?.accepted, rejected: info?.rejected }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[gmail] sendEmail failed:', err?.message || err)
    return { ok: false, error: err?.message || 'send failed' }
  }
}

// Contact-seller specific renderer. Kept next to the transporter so callers
// don't build HTML by hand.
export function renderContactSellerEmail({ listing, buyer, message, listingUrl }) {
  const priceStr = (() => {
    if (listing.priceType === 'free' || listing.price === 0) return 'FREE'
    if (listing.priceType === 'donation') return 'Donation'
    if (listing.priceType === 'trade') return 'Trade'
    if (listing.priceType === 'obo') return `$${Number(listing.price || 0).toFixed(0)} OBO`
    return `$${Number(listing.price || 0).toFixed(0)}`
  })()
  const photo = (listing.photos || []).find(Boolean) || ''
  const photoAbs = photo && !/^https?:/i.test(photo)
    ? `${(process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/,'')}${photo}`
    : photo

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>New inquiry — ${escHtml(listing.title)}</title></head>
<body style="margin:0;padding:0;background:#f5f7f4;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111">
  <div style="max-width:600px;margin:0 auto;background:#ffffff">
    <div style="background:#059669;padding:20px 24px;color:#fff">
      <div style="font-size:20px;font-weight:800;letter-spacing:-.01em">DumpMaps <span style="font-weight:500;opacity:.85">Marketplace</span></div>
      <div style="margin-top:2px;font-size:13px;opacity:.9">You've got a new buyer inquiry</div>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 8px;font-size:20px">Someone is interested in your listing</h2>
      <p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.5">
        A potential buyer just messaged you about <strong>${escHtml(listing.title)}</strong>. Reply to this email to respond directly to them.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:16px 0">
        <tr>
          ${photoAbs ? `<td style="width:140px;padding:0"><img src="${escHtml(photoAbs)}" alt="" style="display:block;width:140px;height:140px;object-fit:cover"/></td>` : ''}
          <td style="padding:14px 16px;vertical-align:top">
            <div style="font-size:15px;font-weight:700;color:#111">${escHtml(listing.title)}</div>
            <div style="font-size:20px;font-weight:800;color:#059669;margin-top:4px">${escHtml(priceStr)}</div>
            <div style="font-size:12px;color:#666;margin-top:6px">${escHtml(listing.condition || '')}${listing.condition && listing.city ? ' · ' : ''}${escHtml(listing.city || '')}</div>
            ${listingUrl ? `<div style="margin-top:10px"><a href="${escHtml(listingUrl)}" style="display:inline-block;background:#059669;color:#fff;padding:8px 14px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none">View listing</a></div>` : ''}
          </td>
        </tr>
      </table>
      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-top:8px">
        <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px">From the buyer</div>
        <div style="font-size:14px;color:#111"><strong>${escHtml(buyer.name || 'A buyer')}</strong> · <a href="mailto:${escHtml(buyer.email)}" style="color:#059669">${escHtml(buyer.email)}</a>${buyer.phone ? ` · <a href="tel:${escHtml(buyer.phone)}" style="color:#059669">${escHtml(buyer.phone)}</a>` : ''}</div>
        <div style="margin-top:10px;font-size:14px;color:#222;line-height:1.5;white-space:pre-wrap">${escHtml(message)}</div>
      </div>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.5">
        <strong>Tip:</strong> Just hit reply to respond — your message will go directly to ${escHtml(buyer.email)}. DumpMaps never sees the response.
      </div>
    </div>
    <div style="padding:14px 24px;background:#f5f7f4;font-size:11px;color:#6b7280;text-align:center">
      Sent via DumpMaps Marketplace · Never share sensitive info with buyers you don't trust.
    </div>
  </div>
</body></html>`
}
