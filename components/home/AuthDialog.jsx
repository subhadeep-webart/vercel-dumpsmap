'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import ProfileTypeCard from '@/components/home/ProfileTypeCard'
import { PROFILE_TYPES } from '@/components/home/home-facility-meta'
import { useAuth } from '@/components/AuthContext'
import FieldError from '@/components/FieldError'
import { signupSchema, scorePassword } from '@/validator/signup'

// Password-strength palette, indexed by score (0–4). Bars use a full color;
// the label text uses a matching tone. Kept module-level so it isn't rebuilt.
const STRENGTH_BAR = ['bg-neutral-200', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500']
const STRENGTH_TEXT = ['text-neutral-400', 'text-red-600', 'text-amber-600', 'text-lime-600', 'text-emerald-600']

// ---------- Auth Dialog (signup/login + multi-profile onboarding) ----------
export default function AuthDialog({ open, onOpenChange, onAuth, initialMode = 'login' }) {
  const { login } = useAuth()
  const [mode, setMode] = useState(initialMode) // 'signup' | 'login'
  const [step, setStep] = useState(1) // 1: pick profiles, 2: credentials
  // Login-mode credentials stay as simple local state (no schema/RHF there).
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selected, setSelected] = useState([]) // profile keys
  const [primary, setPrimary] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Signup step 2 is validated with react-hook-form + zod. Keeping this in the
  // component (rather than only the login-mode local state above) gives us
  // inline field errors, a live password-strength meter, and a submit gate.
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  const pwValue = watch('password')
  const strength = scorePassword(pwValue)

  // When the dialog re-opens, sync mode with the (possibly updated) prop so
  // deep links from /login vs /signup land in the right tab.
  useEffect(() => {
    if (open) setMode(initialMode)
  }, [open, initialMode])

  useEffect(() => {
    if (!open) {
      setEmail(''); setPassword(''); setSelected([]); setPrimary(''); setMode(initialMode); setStep(1); setShowPassword(false); setShowConfirmPassword(false)
      reset()
    }
  }, [open, initialMode, reset])

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

  // Shared with both flows: POST credentials, update global auth, close dialog.
  const authenticate = async (endpoint, body, welcome) => {
    if (busy) return
    setBusy(true)
    try {
      const r = await fetch(`/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      // The server set the httpOnly session cookie on this response — nothing to
      // store in JS. Update global auth state immediately so the header (and any
      // other surface reading useAuth) reflects the login without a refresh.
      login(j.user)
      onAuth?.(j.user)
      toast.success(welcome(j.user))
      onOpenChange(false)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Login mode: plain local state, minimal validation.
  const submit = (e) => {
    e?.preventDefault?.()
    if (!email || !password) return toast.error('Email and password required')
    authenticate('login', { email, password }, (u) => `Welcome back, ${u.name}!`)
  }

  // Signup mode: react-hook-form calls this only once zod validation passes,
  // so `values` is guaranteed name/email/password-complete and matched.
  const onSignup = (values) =>
    authenticate(
      'signup',
      {
        email: values.email,
        password: values.password,
        name: values.name,
        profileTypes: selected,
        primaryProfile: primary,
      },
      (u) => `Welcome to DumpMaps, ${u.name}!`,
    )

  // login mode: simple
  if (mode === 'login') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Welcome back</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Email</Label>
              <Input data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="mt-1" />
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
              <div className="relative mt-1">
                <Input
                  data-testid="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 transition hover:text-neutral-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button data-testid="login-submit" type="submit" disabled={busy} className="w-full bg-brand-600 hover:bg-brand-700">
              {busy ? '…' : 'Log in'}
            </Button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setStep(1) }}
              className="w-full text-center text-xs text-neutral-600 hover:text-neutral-900"
            >
              New? Create an account
            </button>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  // signup mode: step 1 = profile selection, step 2 = credentials
  // return (
  //   <Dialog open={open} onOpenChange={onOpenChange}>
  //     <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
  //       <DialogHeader>
  //         <DialogTitle>
  //           {step === 1 ? 'How will you use DumpMaps?' : 'Create your account'}
  //         </DialogTitle>
  //       </DialogHeader>
  //       {step === 1 ? (
  //         <div className="space-y-3 pt-2">
  //           <p className="text-sm text-neutral-600">
  //             Pick all that apply. We&apos;ll tune the app to what you actually do.
  //             You can add more later from your profile.
  //           </p>
  //           <div className="grid gap-2 sm:grid-cols-2">
  //             {PROFILE_TYPES.map((pt) => (
  //               <ProfileTypeCard
  //                 key={pt.key}
  //                 pt={pt}
  //                 selected={selected.includes(pt.key)}
  //                 isPrimary={primary === pt.key}
  //                 onClick={() => toggle(pt.key)}
  //                 onMakePrimary={() => setPrimary(pt.key)}
  //               />
  //             ))}
  //           </div>
  //           {selected.length > 0 && (
  //             <Card className="border-brand-200 bg-brand-50/60">
  //               <CardContent className="space-y-1 pt-4 text-sm">
  //                 <div className="font-semibold text-neutral-900">Your starting toolkit:</div>
  //                 <ul className="ml-4 list-disc text-neutral-700">
  //                   {PROFILE_TYPES.find((p) => p.key === primary)?.tools.slice(0, 5).map((t) => (
  //                     <li key={t}>{t}</li>
  //                   ))}
  //                 </ul>
  //               </CardContent>
  //             </Card>
  //           )}
  //           <Button
  //             onClick={() => setStep(2)}
  //             disabled={!selected.length}
  //             className="w-full bg-brand-600 hover:bg-brand-700"
  //           >
  //             Continue ({selected.length} profile{selected.length !== 1 ? 's' : ''})
  //             <ArrowRight className="ml-1 h-4 w-4" />
  //           </Button>
  //           <button
  //             onClick={() => setMode('login')}
  //             className="w-full text-center text-xs text-neutral-600 hover:text-neutral-900"
  //           >
  //             Have an account? Log in
  //           </button>
  //         </div>
  //       ) : (
  //         <div className="space-y-3 pt-2">
  //           <div className="flex flex-wrap gap-1.5">
  //             {/* {selected.map((k) => {
  //               const pt = PROFILE_TYPES.find((p) => p.key === k)
  //               return (
  //                 <Badge key={k} variant="outline" className="text-xs">
  //                   {pt?.icon} {pt?.title}{primary === k ? ' ·  primary' : ''}
  //                 </Badge>
  //               )
  //             })} */}
  //             {selected.map((k) => {
  //               const pt = PROFILE_TYPES.find((p) => p.key === k)
  //               const Icon = pt?.icon

  //               return (
  //                 <Badge
  //                   key={k}
  //                   variant="outline"
  //                   className="flex items-center gap-1 text-xs"
  //                 >
  //                   {Icon && <Icon className="h-3.5 w-3.5" />}
  //                   <span>{pt?.title}</span>
  //                   {primary === k && <span> · primary</span>}
  //                 </Badge>
  //               )
  //             })}
  //           </div>
  //           <div>
  //             <Label className="text-xs">Display name</Label>
  //             <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mike" className="mt-1" />
  //           </div>
  //           <div>
  //             <Label className="text-xs">Email</Label>
  //             <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="mt-1" />
  //           </div>
  //           <div>
  //             <Label className="text-xs">Password</Label>
  //             <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1" />
  //           </div>
  //           <div className="flex gap-2">
  //             <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
  //             <Button onClick={submit} disabled={busy} className="flex-1 bg-brand-600 hover:bg-brand-700">
  //               {busy ? '…' : 'Create account'}
  //             </Button>
  //           </div>
  //         </div>
  //       )}
  //     </DialogContent>
  //   </Dialog>
  // )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0">

        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {step === 1
              ? 'How will you use DumpMaps?'
              : 'Create your account'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600">
                Pick all that apply. We&apos;ll tune the app to what you actually
                do. You can add more later from your profile.
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
                  <CardContent className="space-y-2 pt-4 text-sm">
                    <div className="font-semibold text-neutral-900">
                      Your starting toolkit:
                    </div>

                    <ul className="ml-5 list-disc text-neutral-700">
                      {PROFILE_TYPES.find((p) => p.key === primary)
                        ?.tools.slice(0, 5)
                        .map((tool) => (
                          <li key={tool}>{tool}</li>
                        ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <form id="signup-form" onSubmit={handleSubmit(onSignup)} noValidate className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {selected.map((k) => {
                  const pt = PROFILE_TYPES.find((p) => p.key === k)
                  const Icon = pt?.icon

                  return (
                    <Badge
                      key={k}
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {pt?.title}
                      {primary === k && (
                        <span className="text-brand-700"> · Primary</span>
                      )}
                    </Badge>
                  )
                })}
              </div>

              <div>
                <Label className="text-xs">Display name</Label>
                <Input
                  className={`mt-1 ${errors.name ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  placeholder="e.g. Mike"
                  aria-invalid={!!errors.name}
                  {...register('name')}
                />
                <FieldError msg={errors.name?.message} />
              </div>

              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  className={`mt-1 ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  placeholder="you@email.com"
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
                <FieldError msg={errors.email?.message} />
              </div>

              <div>
                <Label className="text-xs">Password</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    className={`pr-10 ${errors.password ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                    placeholder="••••••••"
                    aria-invalid={!!errors.password}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 transition hover:text-neutral-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Vibrant live strength meter — segments fill and shift color as the password improves */}
                {pwValue ? (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                            i < strength.score ? STRENGTH_BAR[strength.score] : 'bg-neutral-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`mt-1 text-[11px] font-medium ${STRENGTH_TEXT[strength.score]}`}>
                      {strength.label}
                    </p>
                  </div>
                ) : null}

                <FieldError msg={errors.password?.message} />
              </div>

              <div>
                <Label className="text-xs">Confirm Password</Label>
                <div className="relative mt-1">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className={`pr-10 ${errors.confirmPassword ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                    placeholder="••••••••"
                    aria-invalid={!!errors.confirmPassword}
                    {...register('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 transition hover:text-neutral-700"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FieldError msg={errors.confirmPassword?.message} />
              </div>
              {/* Hidden submit lets Enter submit the form; the visible button lives in the footer below */}
              <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
            </form>
          )}
        </div>

        <div className="border-t bg-white px-6 py-4">
          {step === 1 ? (
            <>
              <Button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selected.length}
                className="w-full bg-brand-600 hover:bg-brand-700"
              >
                Continue ({selected.length} profile
                {selected.length !== 1 ? 's' : ''})
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="mt-3 w-full text-center text-xs text-neutral-600 hover:text-neutral-900"
              >
                Have an account? Log in
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>

              <Button
                type="submit"
                form="signup-form"
                disabled={busy || !isValid}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Creating…</>
                ) : (
                  <><Check className="mr-1.5 h-4 w-4" /> Create account</>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
