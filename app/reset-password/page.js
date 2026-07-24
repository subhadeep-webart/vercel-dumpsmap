'use client'

// /reset-password?token=<...> — public page. Validates token in client UI by
// hitting POST /api/auth/reset-password on submit. Backend rejects invalid /
// expired / used tokens.

import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, KeyRound, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff, Recycle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api-client'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetSkeleton />}>
      <ResetPasswordInner />
    </Suspense>
  )
}

function ResetSkeleton() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-50">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
    </div>
  )
}

function ResetPasswordInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  // Empty-token state — show a friendly "this link is broken" card.
  const tokenMissing = !token || token.length < 16

  const pwIssue = password.length > 0 && password.length < 8
    ? 'Password must be at least 8 characters.'
    : (confirm && password !== confirm ? 'Passwords don\u2019t match.' : null)

  const submit = async (e) => {
    e.preventDefault()
    if (pwIssue) return
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/auth/reset-password', { token, password })
      setDone(true)
    } catch (err) {
      setError(String(err.data?.error || err.message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-50">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
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
                {done ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> :
                 tokenMissing ? <AlertTriangle className="h-6 w-6 text-amber-600" /> :
                 <KeyRound className="h-6 w-6 text-brand-600" />}
              </div>
              <h1 className="text-xl font-extrabold tracking-tight">
                {done ? 'Password updated' : tokenMissing ? 'Invalid reset link' : 'Set a new password'}
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                {done
                  ? 'You can now sign in with your new password.'
                  : tokenMissing
                    ? 'This reset link is missing or malformed. Request a new one to continue.'
                    : 'Choose a new password for your DumpMaps account. The link expires 1 hour after being issued.'}
              </p>
            </div>

            {!done && !tokenMissing && (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label htmlFor="pw" className="text-xs">New password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="pw"
                      type={show ? 'text' : 'password'}
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
                      aria-label={show ? 'Hide password' : 'Show password'}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirm" className="text-xs">Confirm password</Label>
                  <Input
                    id="confirm"
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-type your new password"
                    required
                    minLength={8}
                    className="mt-1"
                  />
                </div>
                {pwIssue && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{pwIssue}</div>}
                {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}
                <Button type="submit" disabled={loading || !!pwIssue || !password || !confirm} className="w-full bg-brand-600 hover:bg-brand-700">
                  {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  {loading ? 'Updating\u2026' : 'Update password'}
                </Button>
              </form>
            )}

            {done && (
              <Button asChild className="w-full bg-brand-600 hover:bg-brand-700">
                <Link href="/?login=1">Sign in now</Link>
              </Button>
            )}

            {tokenMissing && (
              <Button asChild className="w-full bg-brand-600 hover:bg-brand-700">
                <Link href="/forgot-password">Request a new reset link</Link>
              </Button>
            )}

            <div className="border-t border-neutral-100 pt-3 text-center text-xs text-neutral-500">
              <Link href="/?login=1" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
