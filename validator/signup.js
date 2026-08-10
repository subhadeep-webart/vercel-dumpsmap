// Zod validation schema for the "Create your account" signup form (step 2 of
// the AuthDialog signup flow). Used client-side by components/home/AuthDialog.jsx
// for inline field errors via react-hook-form + zodResolver, and mirrors the
// server-side requirements enforced by /api/auth/signup.

import { z } from 'zod'

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Display name must be at least 2 characters')
      .max(50, 'Display name is too long'),

    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Enter a valid email address')
      .max(160, 'Email is too long'),

    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password is too long')
      .regex(/[a-z]/, 'Include at least one lowercase letter')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/\d/, 'Include at least one number'),

    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/**
 * Lightweight password-strength scorer for the live meter in the signup form.
 * Not a security control — purely a UX hint that mirrors the schema's rules.
 *
 * @param {string} password
 * @returns {{ score: 0|1|2|3|4, label: string }}
 */
export function scorePassword(password = '') {
  if (!password) return { score: 0, label: '' }
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
  return { score, label: labels[score] }
}
