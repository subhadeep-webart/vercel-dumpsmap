'use client'

// /forgot-password — public page. Submits email to /api/auth/forgot-password,
// always shows the same safe message regardless of whether the email exists.

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Loader2, CheckCircle2, Recycle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api-client'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(String(err?.data?.error || err.message || err || 'Something went wrong. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-50">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white"><Recycle className="h-3.5 w-3.5" /></div>
            <div className="text-sm font-extrabold tracking-tight">Dump<span className="text-brand-600">Maps</span></div>
          </Link>
          <div className="w-12" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <Card className="mx-auto max-w-md">
          <CardContent className="space-y-4 p-6">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
                {sent ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <Mail className="h-6 w-6 text-brand-600" />}
              </div>
              <h1 className="text-xl font-extrabold tracking-tight">{sent ? 'Check your email' : 'Reset your password'}</h1>
              <p className="mt-1 text-sm text-neutral-600">
                {sent
                  ? 'If an account exists for that email, we just sent a reset link. The link expires in 1 hour.'
                  : 'Enter the email on your DumpMaps account and we\u2019ll send a link to reset your password.'}
              </p>
            </div>

            {!sent && (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label htmlFor="email" className="text-xs">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="mt-1"
                  />
                </div>
                {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}
                <Button type="submit" disabled={loading || !email} className="w-full bg-brand-600 hover:bg-brand-700">
                  {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  {loading ? 'Sending\u2026' : 'Send reset link'}
                </Button>
              </form>
            )}

            {sent && (
              <div className="space-y-2 text-center">
                <p className="text-xs text-neutral-500">
                  Didn\u2019t get an email? Check your spam folder or{' '}
                  <button onClick={() => { setSent(false); setEmail('') }} className="text-brand-700 underline">try a different email</button>.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/?login=1">Back to sign in</Link>
                </Button>
              </div>
            )}

            <div className="border-t border-neutral-100 pt-3 text-center text-xs text-neutral-500">
              Remembered your password?{' '}
              <Link href="/?login=1" className="font-semibold text-brand-700 hover:underline">Sign in</Link>
            </div>
          </CardContent>
        </Card>

        <p className="mx-auto mt-6 max-w-md text-center text-[11px] text-neutral-400">
          For security, we never tell you whether an email is registered. If you need help, contact support@dumpmaps.org.
        </p>
      </main>
    </div>
  )
}
