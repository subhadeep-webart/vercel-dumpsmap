// Zod validation schema for the "Create a new group" form.
// Used client-side by app/community/groups/page.js for inline field errors, and
// mirrors the server-side requirements enforced in
// app/api/[[...path]]/route.js (/community/groups POST: name + valid category).

import { z } from 'zod'

// Keep in sync with GROUP_CATEGORIES in app/community/groups/page.js and the
// server's GROUP_CATEGORIES allowlist in app/api/[[...path]]/route.js.
export const GROUP_CATEGORY_KEYS = [
  'haulers', 'cleanup', 'reuse', 'contractors', 'recycling',
  'property', 'scrap', 'donation', 'agency', 'general',
]

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Group name must be at least 3 characters')
    .max(80, 'Group name is too long (80 characters max)'),

  category: z
    .string()
    .min(1, 'Please pick a category')
    .refine((v) => GROUP_CATEGORY_KEYS.includes(v), 'Select a valid category'),

  description: z
    .string()
    .trim()
    .max(1000, 'Description is too long (1000 characters max)')
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
    .max(2, 'Use the 2-letter state code')
    .optional()
    .or(z.literal('')),

  tags: z
    .string()
    .trim()
    .max(200, 'Tags are too long (200 characters max)')
    .optional()
    .or(z.literal('')),

  photoUrl: z
    .string()
    .trim()
    .url('Enter a valid image URL')
    .optional()
    .or(z.literal('')),

  rules: z
    .string()
    .trim()
    .max(2000, 'Rules are too long (2000 characters max)')
    .optional()
    .or(z.literal('')),
})
