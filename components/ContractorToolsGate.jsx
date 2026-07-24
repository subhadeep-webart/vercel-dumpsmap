'use client'

// <ContractorToolsGate /> — wraps any page/section that should only be
// visible to verified contractor / hauler / recycler / junk-removal /
// dumpster-op / cleanup-crew users (plus staff).
//
// USAGE
//   <ContractorToolsGate>
//     <YourContractorOnlyUI />
//   </ContractorToolsGate>
//
// BEHAVIOR
//   • Not signed in           → redirect to /?login=1&returnTo=<current path>
//   • Signed in, authorized   → renders children (the contractor tools).
//   • Signed in, unauthorized → renders the "Apply for Contractor Tools"
//                              card with a one-shot application form +
//                              direct-contact CTA to jamal@dumpmaps.org.
//
// The form POSTs to /api/contractor-applications which creates a pending
// contractor_verifications doc that an admin can review at
// /admin/contractor-verification.

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2, ShieldCheck, ClipboardList, Mail, ArrowRight, CheckCircle2, AlertTriangle, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { hasContractorAccess } from '@/lib/contractor-access'

const ROLE_OPTIONS = [
  { key: 'contractor',    label: 'General contractor' },
  { key: 'hauler',        label: 'Hauler' },
  { key: 'recycler',      label: 'Recycler' },
  { key: 'junk_removal',  label: 'Junk removal company' },
  { key: 'dumpster_op',   label: 'Dumpster operator' },
  { key: 'cleanup_crew',  label: 'Commercial cleanup crew' },
]

export default function ContractorToolsGate({ children, toolName = 'this tool' }) {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'authorized' | 'unauthorized' | 'redirecting'
  const [application, setApplication] = useState(null) // existing application if any

  useEffect(() => {
    let cancelled = false
    const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
    if (!token) {
      setStatus('redirecting')
      router.replace(`/?login=1&returnTo=${encodeURIComponent(pathname)}`)
      return
    }
    // Safety timeout: never strand the user on a spinner on flaky mobile networks.
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => {
      try { ctrl.abort() } catch {}
      if (!cancelled) {
        // Default to "unauthorized" UI which has both the apply form AND the
        // contact link, so the user has an actionable next step.
        setStatus('unauthorized')
      }
    }, 8000)
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (!j?.user) {
          try { localStorage.removeItem('dm_token') } catch {}
          setStatus('redirecting')
          router.replace(`/?login=1&returnTo=${encodeURIComponent(pathname)}`)
          return
        }
        setUser(j.user)
        if (hasContractorAccess(j.user)) {
          setStatus('authorized')
        } else {
          setStatus('unauthorized')
          fetch('/api/contractor-applications/me', { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.ok ? r.json() : null)
            .then((d) => { if (!cancelled && d?.application) setApplication(d.application) })
            .catch(() => {})
        }
      })
      .catch(() => { if (!cancelled) setStatus('unauthorized') })
      .finally(() => clearTimeout(timeoutId))
    return () => { cancelled = true; clearTimeout(timeoutId); try { ctrl.abort() } catch {} }
  }, [router, pathname])

  if (status === 'loading' || status === 'redirecting') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-50">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
          {status === 'redirecting' ? 'Sending you to sign in…' : 'Checking access…'}
        </div>
      </div>
    )
  }

  if (status === 'authorized') return <>{children}</>

  return <ApplyForContractorTools toolName={toolName} existing={application} onSubmitted={setApplication} user={user} />
}

function ApplyForContractorTools({ toolName, existing, onSubmitted, user }) {
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    businessName: '',
    phone: '',
    serviceArea: '',
    desiredRoles: [],
    licenseNumber: '',
    insuranceProvider: '',
  })

  const toggleRole = (k) => {
    setForm((f) => ({ ...f, desiredRoles: f.desiredRoles.includes(k) ? f.desiredRoles.filter((x) => x !== k) : [...f.desiredRoles, k] }))
  }

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!form.businessName.trim()) { toast.error('Business name is required'); return }
    if (!form.desiredRoles.length) { toast.error('Pick at least one role'); return }
    setBusy(true)
    try {
      const token = localStorage.getItem('dm_token')
      const r = await fetch('/api/contractor-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          phone: form.phone.trim(),
          email: user?.email || '',
          serviceArea: form.serviceArea.split(',').map((s) => s.trim()).filter(Boolean),
          desiredRoles: form.desiredRoles,
          licenseNumber: form.licenseNumber.trim(),
          insuranceProvider: form.insuranceProvider.trim(),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(j.error || 'Could not submit application')
        return
      }
      toast.success('Application submitted — we\'ll review within 1–2 business days.')
      onSubmitted?.(j.application)
    } finally {
      setBusy(false)
    }
  }

  const pending = existing && existing.status === 'pending'
  const rejected = existing && existing.status === 'rejected'

  return (
    <div className="min-h-[100dvh] bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="container mx-auto flex h-14 items-center gap-2 px-4">
          <Lock className="h-4 w-4 text-neutral-500" />
          <div className="text-sm font-extrabold tracking-tight">Contractor tools</div>
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Restricted</span>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 px-5 py-6">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-neutral-900">Apply for Contractor Tools</h1>
                <p className="mt-1 text-sm text-neutral-700">
                  Disposal Intelligence is for verified haulers, contractors, and recycling operators. Apply to add this role to your profile.
                </p>
              </div>
            </div>
          </div>

          <CardContent className="space-y-4 p-5">
            {pending && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <ClipboardList className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-bold">Application received</div>
                  <div className="text-xs text-blue-700">We’re reviewing your application for <b>{existing.businessName}</b>. Most decisions land within 1–2 business days.</div>
                </div>
              </div>
            )}
            {rejected && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-bold">Previous application not approved</div>
                  <div className="text-xs text-red-700">Reach out to jamal@dumpmaps.org to discuss next steps. You can also resubmit with updated info below.</div>
                </div>
              </div>
            )}

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-neutral-600">Business name</label>
                <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Bison Junk Removal" className="mt-1" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-neutral-600">Phone</label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-neutral-600">Service area (comma-separated)</label>
                  <Input value={form.serviceArea} onChange={(e) => setForm({ ...form, serviceArea: e.target.value })} placeholder="San Jose, Santa Clara, Sunnyvale" className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-neutral-600">Which contractor tools do you need?</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ROLE_OPTIONS.map((r) => {
                    const active = form.desiredRoles.includes(r.key)
                    return (
                      <button key={r.key} type="button" onClick={() => toggleRole(r.key)} className={`rounded-md border px-2 py-2 text-xs font-semibold transition ${active ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'}`}>
                        {r.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-neutral-600">License # (optional)</label>
                  <Input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} placeholder="CSLB 123456" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-neutral-600">Insurance provider (optional)</label>
                  <Input value={form.insuranceProvider} onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })} placeholder="Hiscox" className="mt-1" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button type="submit" disabled={busy || pending} className="bg-brand-600 hover:bg-brand-700">
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                  {pending ? 'Application pending…' : 'Apply for contractor tools'}
                </Button>
                <a href="mailto:jamal@dumpmaps.org?subject=DumpMaps%20Contractor%20Tools%20application" className="inline-flex h-9 items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                  <Mail className="h-4 w-4" /> Contact jamal@dumpmaps.org
                </a>
              </div>
              <p className="text-[10px] text-neutral-500">By applying you allow DumpMaps staff to verify your license, insurance, and business presence in your service area. Approved accounts unlock {toolName}, Disposal Intelligence, and the Receipt Center.</p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
