'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ArrowRight } from 'lucide-react'
import ProfileTypeCard from '@/components/home/ProfileTypeCard'
import { PROFILE_TYPES } from '@/components/home/home-facility-meta'

// ---------- Auth Dialog (signup/login + multi-profile onboarding) ----------
export default function AuthDialog({ open, onOpenChange, onAuth, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode) // 'signup' | 'login'
  const [step, setStep] = useState(1) // 1: pick profiles, 2: credentials
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [selected, setSelected] = useState([]) // profile keys
  const [primary, setPrimary] = useState('')
  const [busy, setBusy] = useState(false)

  // When the dialog re-opens, sync mode with the (possibly updated) prop so
  // deep links from /login vs /signup land in the right tab.
  useEffect(() => {
    if (open) setMode(initialMode)
  }, [open, initialMode])

  useEffect(() => {
    if (!open) {
      setEmail(''); setPassword(''); setName(''); setSelected([]); setPrimary(''); setMode(initialMode); setStep(1)
    }
  }, [open, initialMode])

  const toggle = (k) => {
    if (selected.includes(k)) {
      const next = selected.filter((x) => x !== k)
      setSelected(next)
      if (primary === k) setPrimary(next[0] || '')
    } else {
      const next = [...selected, k]
      setSelected(next)
      if (!primary) setPrimary(k)
    }
  }

  const submit = async () => {
    if (!email || !password) return toast.error('Email and password required')
    setBusy(true)
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'signup'
            ? { email, password, name, profileTypes: selected, primaryProfile: primary }
            : { email, password }
        ),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      localStorage.setItem('dm_token', j.token)
      onAuth?.(j.user)
      toast.success(mode === 'signup' ? `Welcome to DumpMaps, ${j.user.name}!` : `Welcome back, ${j.user.name}!`)
      onOpenChange(false)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  // login mode: simple
  if (mode === 'login') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Welcome back</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Email</Label>
              <Input data-testid="login-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="mt-1" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Password</Label>
                <Link
                  href="/forgot-password"
                  onClick={() => onOpenChange(false)}
                  className="text-[11px] font-semibold text-brand-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1" />
            </div>
            <Button data-testid="login-submit" onClick={submit} disabled={busy} className="w-full bg-brand-600 hover:bg-brand-700">
              {busy ? '…' : 'Log in'}
            </Button>
            <button
              onClick={() => { setMode('signup'); setStep(1) }}
              className="w-full text-center text-xs text-neutral-600 hover:text-neutral-900"
            >
              New? Create an account
            </button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // signup mode: step 1 = profile selection, step 2 = credentials
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'How will you use DumpMaps?' : 'Create your account'}
          </DialogTitle>
        </DialogHeader>
        {step === 1 ? (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-neutral-600">
              Pick all that apply. We&apos;ll tune the app to what you actually do.
              You can add more later from your profile.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROFILE_TYPES.map((pt) => (
                <ProfileTypeCard
                  key={pt.key}
                  pt={pt}
                  selected={selected.includes(pt.key)}
                  isPrimary={primary === pt.key}
                  onClick={() => toggle(pt.key)}
                  onMakePrimary={() => setPrimary(pt.key)}
                />
              ))}
            </div>
            {selected.length > 0 && (
              <Card className="border-brand-200 bg-brand-50/60">
                <CardContent className="space-y-1 pt-4 text-sm">
                  <div className="font-semibold text-neutral-900">Your starting toolkit:</div>
                  <ul className="ml-4 list-disc text-neutral-700">
                    {PROFILE_TYPES.find((p) => p.key === primary)?.tools.slice(0, 5).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            <Button
              onClick={() => setStep(2)}
              disabled={!selected.length}
              className="w-full bg-brand-600 hover:bg-brand-700"
            >
              Continue ({selected.length} profile{selected.length !== 1 ? 's' : ''})
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <button
              onClick={() => setMode('login')}
              className="w-full text-center text-xs text-neutral-600 hover:text-neutral-900"
            >
              Have an account? Log in
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap gap-1.5">
              {selected.map((k) => {
                const pt = PROFILE_TYPES.find((p) => p.key === k)
                return (
                  <Badge key={k} variant="outline" className="text-xs">
                    {pt?.icon} {pt?.title}{primary === k ? ' ·  primary' : ''}
                  </Badge>
                )
              })}
            </div>
            <div>
              <Label className="text-xs">Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mike" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={submit} disabled={busy} className="flex-1 bg-brand-600 hover:bg-brand-700">
                {busy ? '…' : 'Create account'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
