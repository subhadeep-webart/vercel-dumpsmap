// Zod validation schema for the "Partner With Us" business inquiry form.
// Used client-side by app/business/page.js for inline field errors, and mirrors
// the server-side requirements enforced in app/api/[[...path]]/route.js
// (/business-inquiry: businessName + valid email required).

import { z } from 'zod'

// Keep in sync with the <SelectItem> values in the Business Type / Interest dropdowns.
export const BUSINESS_TYPES = [
  'transfer_station', 'recycling_center', 'buy_back', 'donation',
  'scrap_yard', 'hhw', 'tire', 'landfill', 'other',
]

export const INTERESTS = [
  'partnership', 'cashback', 'listing', 'analytics', 'demo', 'other',
]

// Accepts "example.com", "http(s)://example.com", with or without www — optional field.
const websiteRegex = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i
// Lenient phone: digits, spaces, +, -, (), and dots. 7–20 chars — optional field.
const phoneRegex = /^[+]?[\d\s().-]{7,20}$/

export const businessInquirySchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, 'Business name must be at least 2 characters')
    .max(120, 'Business name is too long'),

  contactName: z
    .string()
    .trim()
    .max(80, 'Contact name is too long')
    .optional()
    .or(z.literal('')),

  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .max(160, 'Email is too long'),

  phone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),

  businessType: z
    .enum(BUSINESS_TYPES, { errorMap: () => ({ message: 'Select a valid business type' }) })
    .optional()
    .or(z.literal('')),

  city: z
    .string()
    .trim()
    .max(80, 'City name is too long')
    .optional()
    .or(z.literal('')),

  state: z
    .string()
    .trim()
    .max(80, 'State name is too long')
    .optional()
    .or(z.literal('')),

  website: z
    .string()
    .trim()
    .regex(websiteRegex, 'Enter a valid website URL')
    .optional()
    .or(z.literal('')),

  interest: z
    .enum(INTERESTS, { errorMap: () => ({ message: 'Select a valid option' }) }),

  message: z
    .string()
    .trim()
    .max(2000, 'Message is too long (2000 characters max)')
    .optional()
    .or(z.literal('')),
})

/**
 * Validate the whole form.
 * @returns {{ success: boolean, data?: object, errors: Record<string,string> }}
 *          `errors` maps field name → first error message (empty object when valid).
 */
export function validateBusinessInquiry(values) {
  const result = businessInquirySchema.safeParse(values)
  if (result.success) return { success: true, data: result.data, errors: {} }

  const errors = {}
  for (const issue of result.error.issues) {
    const key = issue.path[0]
    if (key && !errors[key]) errors[key] = issue.message
  }
  return { success: false, errors }
}

/**
 * Validate a single field's value against the schema (for onBlur / live clearing).
 * @returns {string} error message, or '' when the field is valid.
 */
export function validateBusinessField(field, value) {
  const fieldSchema = businessInquirySchema.shape[field]
  if (!fieldSchema) return ''
  const result = fieldSchema.safeParse(value)
  return result.success ? '' : (result.error.issues[0]?.message || 'Invalid value')
}
