// Zod validation schemas for the profile editor's Personal and Business tabs
// (components/profile/PersonalTab.jsx, BusinessTab.jsx).
//
// These mirror the server-side rules enforced by PATCH /api/users/me/profile
// (app/api/[[...path]]/handlers/authProfile.js) so the user gets an inline error
// before the request goes out, rather than a toast afterwards:
//   - name/phone/address*/city/state/zip → normaliseString(…, 500)
//   - email    → isValidEmail + a uniqueness check (409 if taken)
//   - website  → isValidUrl, auto-prefixed with https:// when the scheme is absent
//   - bio      → normaliseString(…, 1000); every other string field caps at 500
//   - isRepresentative → one of BUSINESS_REPRESENTATION
//
// Uniqueness (email) can only be checked server-side, so a 409 still surfaces as
// a toast — everything else is caught here first.

import { z } from 'zod'

// The server trims and length-caps; an empty optional field is stored as ''.
// `.trim()` before the length check keeps "   " from passing a min(1).
const optionalText = (max, label) =>
  z.string().trim().max(max, `${label} is too long`).optional().or(z.literal(''))

export const personalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long'),

  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .max(200, 'Email is too long'),

  // Digits, spaces, and the usual punctuation. Deliberately permissive — the
  // server stores phone as free text and users paste all sorts of formats.
  phone: z
    .string()
    .trim()
    .max(40, 'Phone number is too long')
    .refine((v) => !v || /^[\d\s()+.-]{7,}$/.test(v), 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),

  addressLine1: optionalText(200, 'Address'),
  addressLine2: optionalText(200, 'Address line 2'),
  city: optionalText(100, 'City'),

  // The input is maxLength=2; validate the shape so "Cal" or "C1" is rejected.
  state: z
    .string()
    .trim()
    .max(2, 'Use the 2-letter state code')
    .refine((v) => !v || /^[A-Za-z]{2}$/.test(v), 'Use the 2-letter state code (e.g. CA)')
    .optional()
    .or(z.literal('')),

  // US ZIP or ZIP+4.
  zip: z
    .string()
    .trim()
    .max(10, 'ZIP is too long')
    .refine((v) => !v || /^\d{5}(-\d{4})?$/.test(v), 'Enter a valid ZIP (12345 or 12345-6789)')
    .optional()
    .or(z.literal('')),
})

export const businessSchema = z.object({
  // The server allows 1000 here, unlike the 500 cap on other text fields.
  bio: optionalText(1000, 'Bio'),
  companyName: optionalText(200, 'Company name'),

  // The server accepts a bare host and prefixes https:// itself, so accept both
  // forms here and let it normalise. We only reject input that could never be a
  // URL — a bare word with no dot, or anything with whitespace.
  website: z
    .string()
    .trim()
    .max(500, 'Website URL is too long')
    .refine(
      (v) => !v || /^(https?:\/\/)?[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(v),
      'Enter a valid website (e.g. example.com)',
    )
    .optional()
    .or(z.literal('')),

  businessType: optionalText(100, 'Business type'),

  // Optional, but must look like an EIN when present.
  ein: z
    .string()
    .trim()
    .max(20, 'EIN is too long')
    .refine((v) => !v || /^\d{2}-?\d{7}$/.test(v), 'Enter a valid EIN (XX-XXXXXXX)')
    .optional()
    .or(z.literal('')),

  // Must match BUSINESS_REPRESENTATION on the server, which 400s on anything else.
  isRepresentative: z.enum(['independent', 'company_representative'], {
    errorMap: () => ({ message: 'Choose how you operate' }),
  }),
})

// The subset of form keys each tab owns. Used to seed react-hook-form's
// defaultValues from the profile draft, and to diff on submit so only changed
// fields are PATCHed.
export const PERSONAL_KEYS = Object.keys(personalSchema.shape)
export const BUSINESS_KEYS = Object.keys(businessSchema.shape)

/**
 * Pick a tab's fields out of the full profile form draft, coercing every value
 * to a string default so react-hook-form's inputs stay controlled from the
 * first render.
 *
 * @param {object} form  the useProfile form draft
 * @param {string[]} keys  PERSONAL_KEYS or BUSINESS_KEYS
 */
export function pickDefaults(form, keys) {
  const out = {}
  for (const k of keys) out[k] = form?.[k] ?? ''
  return out
}

/**
 * Return only the fields whose value actually changed, so a submit with one
 * edited field doesn't re-send the whole tab. Comparison is on trimmed strings,
 * matching how the server normalises input.
 *
 * @returns {object} the changed subset (empty when nothing changed)
 */
export function changedFields(values, original) {
  const patch = {}
  for (const [k, v] of Object.entries(values)) {
    const next = typeof v === 'string' ? v.trim() : v
    const prev = typeof original?.[k] === 'string' ? original[k].trim() : (original?.[k] ?? '')
    if (next !== prev) patch[k] = next
  }
  return patch
}
