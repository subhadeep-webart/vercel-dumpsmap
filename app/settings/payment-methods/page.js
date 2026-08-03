'use client'

// P6: Payment Method Profiles
// ---------------------------------------------------------------------------
// Lets any authenticated user save cards on file via Stripe SetupIntents.
// - Lazy customer creation happens on the server in /setup
// - Cards only (no ACH/wallets yet)
// - Test-mode banner shown when publishable key is pk_test_*
// - 3D Secure handled by Stripe's default confirm flow (modal/redirect)
// - DumpMaps never sees the raw PAN — only pm_xxx + last4/brand/exp

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements, useStripe, useElements, CardElement,
} from '@stripe/react-stripe-js'
import PageShell from '@/components/PageShell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, ArrowRight, CreditCard, Loader2, Lock,
  Plus, ShieldCheck, Star, Trash2, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { isLikelyLoggedIn } from '@/lib/api-client'

const CARD_BRAND_LABELS = {
  visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover',
  diners: 'Diners', jcb: 'JCB', unionpay: 'UnionPay', unknown: 'Card', card: 'Card',
}

function brandLabel(b) {
  if (!b) return 'Card'
  return CARD_BRAND_LABELS[String(b).toLowerCase()] || (b[0].toUpperCase() + b.slice(1))
}

// ---------------------------------------------------------------------------
// Card form (Stripe Elements)
// ---------------------------------------------------------------------------
function CardForm({ clientSecret, setupIntentId, onSaved, onCancel }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [name, setName] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setBusy(true); setErr('')
    try {
      const card = elements.getElement(CardElement)
      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card,
          billing_details: name ? { name } : undefined,
        },
      })
      if (error) {
        setErr(error.message || 'Card confirmation failed')
        setBusy(false)
        return
      }
      const pmId = setupIntent?.payment_method
      if (!pmId) {
        setErr('No payment method returned by Stripe')
        setBusy(false)
        return
      }
      // Persist on our backend
      const res = await fetch('/api/users/me/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId: pmId, setupIntentId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(j.error || 'Failed to save card')
        setBusy(false)
        return
      }
      toast.success('Card saved')
      onSaved?.(j.paymentMethod)
    } catch (e) {
      setErr(String(e?.message || e))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">Name on card (optional)</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          placeholder="Jane Doe"
          autoComplete="cc-name"
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">Card details</label>
        <div className="mt-1 rounded-md border border-neutral-300 bg-white px-3 py-3 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
          <CardElement
            options={{
              hidePostalCode: false,
              style: {
                base: {
                  fontSize: '15px',
                  color: '#0f172a',
                  '::placeholder': { color: '#94a3b8' },
                  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                },
                invalid: { color: '#dc2626' },
              },
            }}
          />
        </div>
      </div>
      {err && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{err}</span>
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={!stripe || busy}>
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : <><Lock className="mr-2 h-4 w-4" />Save card</>}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
      <p className="text-[11px] text-neutral-500">
        <ShieldCheck className="mr-1 inline h-3 w-3 text-emerald-600" />
        DumpMaps never sees your full card number. Cards are securely tokenized by Stripe.
      </p>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Saved card row
// ---------------------------------------------------------------------------
function SavedCardRow({ pm, onMakeDefault, onDelete, busy }) {
  const exp = pm.expMonth && pm.expYear
    ? `${String(pm.expMonth).padStart(2, '0')}/${String(pm.expYear).slice(-2)}`
    : '—'
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-14 items-center justify-center rounded-md bg-neutral-900 text-xs font-bold uppercase tracking-wider text-white">
          {brandLabel(pm.brand)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-neutral-900">•••• {pm.last4 || '----'}</div>
            {pm.isDefault && (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                <Star className="mr-1 h-3 w-3 fill-emerald-700" /> Default
              </Badge>
            )}
          </div>
          <div className="text-xs text-neutral-500">Exp {exp}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!pm.isDefault && (
          <Button size="sm" variant="outline" onClick={() => onMakeDefault(pm)} disabled={busy}>
            Set default
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50"
          onClick={() => onDelete(pm)}
          disabled={busy}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PaymentMethodsPage() {
  const router = useRouter()
  const [status, setStatus] = useState('loading') // loading | ready | unauth | locked | stripeMissing | error
  const [errorMsg, setErrorMsg] = useState('')
  const [user, setUser] = useState(null)
  const [stripeMode, setStripeMode] = useState(null) // 'test' | 'live'
  const [stripePromise, setStripePromise] = useState(null)
  const [methods, setMethods] = useState([])
  const [adding, setAdding] = useState(false)
  const [intent, setIntent] = useState(null) // { clientSecret, setupIntentId }
  const [intentBusy, setIntentBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState(false)

  // Bootstrap: auth → stripe config → list
  useEffect(() => {
    let cancelled = false
    if (!isLikelyLoggedIn()) {
      router.replace('/?login=1&returnTo=/settings/payment-methods')
      return
    }
    ;(async () => {
      try {
        const meRes = await fetch('/api/auth/me')
        const meJ = await meRes.json().catch(() => ({}))
        if (!meJ?.user) {
          if (!cancelled) router.replace('/?login=1&returnTo=/settings/payment-methods')
          return
        }
        if (cancelled) return
        setUser(meJ.user)

        const cfgRes = await fetch('/api/stripe/config')
        const cfgJ = await cfgRes.json().catch(() => ({}))
        if (cancelled) return
        if (!cfgJ.configured || !cfgJ.publishableKey) {
          setStatus('stripeMissing')
          return
        }
        setStripeMode(cfgJ.mode || null)
        setStripePromise(loadStripe(cfgJ.publishableKey))

        const listRes = await fetch('/api/users/me/payment-methods')
        const listJ = await listRes.json().catch(() => ({}))
        if (cancelled) return
        if (listRes.status === 403) {
          setStatus('locked')
          setErrorMsg(listJ.error || 'Not allowed')
          return
        }
        if (listRes.status === 503) {
          setStatus('stripeMissing')
          return
        }
        if (!listRes.ok) {
          setStatus('error')
          setErrorMsg(listJ.error || `HTTP ${listRes.status}`)
          return
        }
        setMethods(Array.isArray(listJ.paymentMethods) ? listJ.paymentMethods : [])
        setStatus('ready')
      } catch (e) {
        if (!cancelled) { setStatus('error'); setErrorMsg(String(e?.message || e)) }
      }
    })()
    return () => { cancelled = true }
  }, [router])

  const startAdd = useCallback(async () => {
    setIntentBusy(true)
    try {
      const res = await fetch('/api/users/me/payment-methods/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(j.error || 'Failed to start card setup')
        return
      }
      setIntent({ clientSecret: j.clientSecret, setupIntentId: j.setupIntentId })
      setAdding(true)
    } catch (e) {
      toast.error(String(e?.message || e))
    } finally {
      setIntentBusy(false)
    }
  }, [])

  const onSaved = useCallback(async (saved) => {
    setAdding(false); setIntent(null)
    // Refresh list (server is authoritative on defaults)
    try {
      const listRes = await fetch('/api/users/me/payment-methods')
      const listJ = await listRes.json().catch(() => ({}))
      setMethods(Array.isArray(listJ.paymentMethods) ? listJ.paymentMethods : [])
    } catch (_) {
      // Fallback: append optimistically
      if (saved) setMethods((m) => [saved, ...m])
    }
  }, [])

  const onMakeDefault = useCallback(async (pm) => {
    setRowBusy(true)
    try {
      const res = await fetch(`/api/users/me/payment-methods/${pm.id}/default`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error || 'Failed to set default'); return }
      const listRes = await fetch('/api/users/me/payment-methods')
      const listJ = await listRes.json().catch(() => ({}))
      setMethods(Array.isArray(listJ.paymentMethods) ? listJ.paymentMethods : [])
      toast.success('Default card updated')
    } finally { setRowBusy(false) }
  }, [])

  const onDelete = useCallback(async (pm) => {
    if (!confirm(`Remove ${brandLabel(pm.brand)} ending •••• ${pm.last4}?`)) return
    setRowBusy(true)
    try {
      const res = await fetch(`/api/users/me/payment-methods/${pm.id}`, {
        method: 'DELETE',
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error || 'Failed to remove'); return }
      const listRes = await fetch('/api/users/me/payment-methods')
      const listJ = await listRes.json().catch(() => ({}))
      setMethods(Array.isArray(listJ.paymentMethods) ? listJ.paymentMethods : [])
      toast.success('Card removed')
    } finally { setRowBusy(false) }
  }, [])

  const elementsOptions = useMemo(() => intent ? { clientSecret: intent.clientSecret } : null, [intent])

  return (
    <PageShell
      active="settings"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Payment methods' },
      ]}
      maxWidth="max-w-3xl"
    >
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Payment methods</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Save cards on file for marketplace checkouts, memberships, and contractor charges.
            </p>
          </div>
        </div>

        {/* Test-mode banner */}
        {stripeMode === 'test' && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <div>
              <div className="font-bold">Test mode</div>
              <div>Use card <code className="rounded bg-white px-1 py-0.5 font-mono">4242 4242 4242 4242</code>, any future date, any CVC. No real charge will be made.</div>
            </div>
          </div>
        )}

        {/* States */}
        {status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {status === 'error' && (
          <Card><CardContent className="p-5 text-sm text-red-700">
            <div className="font-bold">Couldn’t load payment methods</div>
            <div className="mt-1 text-xs">{errorMsg}</div>
          </CardContent></Card>
        )}

        {status === 'locked' && (
          <Card><CardContent className="p-5 text-sm">
            <div className="font-bold text-neutral-900">Payment methods are not available for your account</div>
            <div className="mt-1 text-xs text-neutral-500">{errorMsg}</div>
          </CardContent></Card>
        )}

        {status === 'stripeMissing' && (
          <Card><CardContent className="p-5 text-sm">
            <div className="font-bold text-neutral-900">Stripe is not configured yet</div>
            <div className="mt-1 text-xs text-neutral-500">
              An admin needs to add a Stripe publishable key and secret key in <Link href="/settings/integrations" className="underline">Settings → Integrations</Link> (or
              the Admin → Payments page) before cards can be saved.
            </div>
          </CardContent></Card>
        )}

        {status === 'ready' && (
          <>
            {/* List */}
            <div className="space-y-3">
              {methods.length === 0 && !adding && (
                <Card><CardContent className="p-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-neutral-900">No cards on file</div>
                  <div className="mt-1 text-xs text-neutral-500">Add a card so you can pay for memberships, marketplace orders, and contractor charges quickly.</div>
                </CardContent></Card>
              )}

              {methods.map((pm) => (
                <SavedCardRow key={pm.id} pm={pm} onMakeDefault={onMakeDefault} onDelete={onDelete} busy={rowBusy} />
              ))}
            </div>

            {/* Add card */}
            {!adding && (
              <div className="mt-4">
                <Button onClick={startAdd} disabled={intentBusy}>
                  {intentBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing…</> : <><Plus className="mr-2 h-4 w-4" />Add a card</>}
                </Button>
              </div>
            )}

            {adding && intent && stripePromise && (
              <Card className="mt-4">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-bold text-neutral-900">Add a new card</div>
                    <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                      <Lock className="h-3 w-3" /> Secured by Stripe
                    </div>
                  </div>
                  <Elements stripe={stripePromise} options={elementsOptions}>
                    <CardForm
                      clientSecret={intent.clientSecret}
                      setupIntentId={intent.setupIntentId}
                      onSaved={onSaved}
                      onCancel={() => { setAdding(false); setIntent(null) }}
                    />
                  </Elements>
                </CardContent>
              </Card>
            )}

            <p className="mt-8 text-[11px] text-neutral-400">
              You’ll be prompted by your bank for additional authentication (3D&nbsp;Secure) when required.
              We never store your full card number, only a secure token from Stripe.
            </p>
            <div className="mt-2">
              <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700">
                Back to settings <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </>
        )}
    </PageShell>
  )
}
