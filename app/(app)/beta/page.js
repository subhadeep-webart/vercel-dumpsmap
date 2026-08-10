'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CheckCircle2, ArrowRight, Users, HeartHandshake } from 'lucide-react'
import { BETA_BENEFITS, BETA_ROLES, BETA_INTERESTS, EMPTY_BETA_FORM } from '@/constants/beta_constants'
import { useBetaActions } from '@/hooks/use-beta-actions'

export default function BetaPage() {
  const router = useRouter()
  const { busy: submitting, join } = useBetaActions()
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState(EMPTY_BETA_FORM)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggleInterest = (v) => setForm((f) => ({
    ...f,
    interests: f.interests.includes(v) ? f.interests.filter((x) => x !== v) : [...f.interests, v],
  }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.email.includes('@')) return toast.error('Please enter a valid email')
    const ok = await join(form)
    if (ok) setSuccess(true)
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/60 via-white to-white">
        <div className="container mx-auto grid items-start gap-10 px-4 py-14 md:grid-cols-[1fr_480px] md:py-20">
          <div>
            <Badge className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">Beta program</Badge>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              Join the <span className="text-emerald-600">DumpMaps</span> beta.
            </h1>
            <p className="mt-5 max-w-xl text-base text-neutral-600 md:text-lg">
              Get early access to live wait times, community updates, and cashback rewards at participating recycling,
              donation, and buy-back centers. Help us shape the platform for your neighborhood.
            </p>

            {/* What you get */}
            <div className="mt-8 space-y-3">
              {BETA_BENEFITS.map((b) => {
                const Icon = b.icon
                return (
                  <div key={b.t} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-semibold">{b.t}</div>
                      <div className="text-sm text-neutral-600">{b.d}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mt-8 text-[13px] text-neutral-500">
              Already have an account? <Link href="/?login=1" className="font-semibold text-emerald-700 hover:underline">Log in</Link>
            </p>
          </div>

          {/* Right: form card */}
          <div>
            <Card className="relative overflow-hidden border-neutral-200 bg-white p-6 shadow-xl shadow-emerald-100 md:sticky md:top-24">
              {success ? (
                <div className="py-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold">You&apos;re on the list!</h3>
                  <p className="mt-2 text-sm text-neutral-600">
                    We&apos;ll email <span className="font-semibold text-neutral-900">{form.email}</span> when your slot is ready.
                    In the meantime, explore what we&apos;ve built so far.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Button onClick={() => router.push('/facilities')} className="h-11 bg-emerald-600 hover:bg-emerald-700">
                      Browse Facilities <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                    <Button onClick={() => router.push('/donate')} variant="outline" className="h-11 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                      <HeartHandshake className="mr-1.5 h-4 w-4" /> Support Our Mission
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold">Get on the beta waitlist</h3>
                    <p className="mt-1 text-sm text-neutral-600">Free forever. No credit card. We&apos;ll email you when your spot is ready.</p>
                  </div>

                  <div>
                    <Label className="text-[13px]">Email <span className="text-red-500">*</span></Label>
                    <Input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      placeholder="you@email.com"
                      className="mt-1 h-11"
                    />
                  </div>

                  <div>
                    <Label className="text-[13px]">Full name</Label>
                    <Input
                      value={form.fullName}
                      onChange={(e) => set('fullName', e.target.value)}
                      placeholder="Alex Rivera"
                      className="mt-1 h-11"
                    />
                  </div>

                  <div>
                    <Label className="text-[13px]">I am a…</Label>
                    <Select value={form.role} onValueChange={(v) => set('role', v)}>
                      <SelectTrigger className="mt-1 h-11">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        {BETA_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[13px]">City</Label>
                      <Input
                        value={form.city}
                        onChange={(e) => set('city', e.target.value)}
                        placeholder="Hayward"
                        className="mt-1 h-11"
                      />
                    </div>
                    <div>
                      <Label className="text-[13px]">State</Label>
                      <Input
                        value={form.state}
                        onChange={(e) => set('state', e.target.value)}
                        placeholder="CA"
                        className="mt-1 h-11"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[13px]">What are you most interested in?</Label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {BETA_INTERESTS.map((tag) => {
                        const on = form.interests.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleInterest(tag)}
                            className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                              on
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-neutral-200 bg-white text-neutral-700 hover:border-emerald-300'
                            }`}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-[13px]">Anything else? <span className="text-neutral-400">(optional)</span></Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => set('notes', e.target.value)}
                      placeholder="Tell us what you&apos;d like to see…"
                      className="mt-1 min-h-[70px]"
                    />
                  </div>

                  <Button type="submit" disabled={submitting} className="h-12 w-full bg-emerald-600 text-[15px] font-semibold hover:bg-emerald-700">
                    {submitting ? 'Adding you to the list…' : 'Join Beta Waitlist'}
                    {!submitting && <ArrowRight className="ml-1.5 h-4 w-4" />}
                  </Button>
                  <p className="text-center text-[11px] text-neutral-500">
                    By joining, you agree to receive updates from DumpMaps. Unsubscribe anytime.
                  </p>
                </form>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* Bottom band */}
      <section className="border-t border-neutral-100 bg-emerald-600 py-10 text-white">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6" />
            <div>
              <div className="font-semibold">Join a growing community of recyclers.</div>
              <div className="text-[13px] text-emerald-100">10,000+ people already signed up.</div>
            </div>
          </div>
          <Link href="/donate" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-5 text-[14px] font-semibold text-emerald-700 hover:bg-emerald-50">
            <HeartHandshake className="h-4 w-4" /> Support Our Mission
          </Link>
        </div>
      </section>
    </div>
  )
}
