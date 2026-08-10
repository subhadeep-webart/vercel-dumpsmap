'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import HomeBrandLink from '@/components/HomeBrandLink'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Recycle, HeartHandshake, Building2, Users, Activity,
  Sparkles, ShieldCheck, ArrowRight, Mail, BadgeCheck, Repeat, Zap,
  Quote,
} from 'lucide-react'
import {
  PRESET_AMOUNTS, TIERS, IMPACT_ITEMS, METRICS, TRANSPARENCY, TESTIMONIALS,
  MISSION_POINTS, PARTNER_TYPES,
} from '@/constants/donate_constants'
import { resolveAmount } from '@/lib/donate-helpers'
import { useDonate } from '@/hooks/use-donate'
import { useDonateActions } from '@/hooks/use-donate-actions'

export default function DonatePage() {
  const router = useRouter()
  const [amount, setAmount] = useState(25)
  const [custom, setCustom] = useState('')
  const [tier, setTier] = useState('community')
  const [recurring, setRecurring] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  // Best-effort peek at public integration settings on mount (see useDonate).
  useDonate()

  const { submitting, stripeReady, createIntent } = useDonateActions({
    // Non-Stripe fallback: log interest and route to the queued success page.
    onQueued: (amt) => router.push(`/donate/success?queued=1&amount=${amt}&email=${encodeURIComponent(email)}`),
  })

  const submit = (e) => {
    e?.preventDefault?.()
    if (!email) return toast.error('Please enter your email')
    const amt = resolveAmount(custom, amount)
    if (!amt || amt <= 0) return toast.error('Pick or enter a donation amount')
    createIntent({ email, name, amount: amt, tier, message, recurring })
  }

  return (
    <div className="min-h-screen bg-white">

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-neutral-200 bg-gradient-to-br from-neutral-50 via-white to-brand-50">
        <div className="container mx-auto grid items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <Badge className="mb-4 bg-brand-100 text-brand-800 hover:bg-brand-100">Support the mission</Badge>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-neutral-900 md:text-6xl">
              Support the Future of <span className="text-brand-600">Smarter Recycling &amp; Reuse</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-neutral-600 md:text-lg">
              Your support helps DumpMaps build real-time tools for haulers, contractors, recyclers,
              donation centers, and communities working toward cleaner cities and less waste.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#donate-form" className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700">
                <HeartHandshake className="h-4 w-4" /> Donate Now
              </a>
              <a href="#partners" className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:border-neutral-400">
                <Building2 className="h-4 w-4" /> Become a Partner
              </a>
              <a href="#mission" className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:border-neutral-400">
                <Sparkles className="h-4 w-4" /> Support the Mission
              </a>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-500">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> Secure checkout via Stripe</span>
              <span className="inline-flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5 text-brand-600" /> One-time or monthly</span>
              <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-brand-600" /> 100% mission-driven</span>
            </div>
          </div>

          {/* Mission collage — height scales with the breakpoint so the 6×6
              tiles stay proportional instead of cramming into a fixed 480px on
              small screens. */}
          <div className="relative grid h-[300px] grid-cols-6 grid-rows-6 gap-2 sm:h-[400px] sm:gap-3 md:h-[480px]">
            <div className="relative col-span-4 row-span-4 overflow-hidden rounded-2xl border border-neutral-200 shadow-xl">
              <img src="https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?auto=format&fit=crop&w=900&q=80" alt="Hauler at a transfer station" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 sm:p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-300 sm:text-xs">Field intelligence</div>
                <div className="text-xs font-bold text-white sm:text-sm">Real haulers · Real time</div>
              </div>
            </div>
            <div className="col-span-2 row-span-3 overflow-hidden rounded-2xl border border-neutral-200 shadow">
              <img src="https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=600&q=80" alt="Recycling materials" className="h-full w-full object-cover" />
            </div>
            <div className="col-span-2 row-span-3 overflow-hidden rounded-2xl border border-neutral-200 shadow">
              <img src="https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=600&q=80" alt="Community donation" className="h-full w-full object-cover" />
            </div>
            <div className="col-span-3 row-span-2 overflow-hidden rounded-2xl border border-brand-200 bg-brand-50 p-2.5 shadow sm:p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-800 sm:gap-2 sm:text-xs">
                <Activity className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" /> Live alert
              </div>
              <div className="mt-1 line-clamp-1 text-xs font-bold text-neutral-900 sm:text-sm">Newby Island — gate closed early</div>
              <div className="line-clamp-2 text-[10px] text-neutral-600 sm:text-[11px]">Routed 7 haulers to GreenWaste in 22 min</div>
            </div>
            <div className="col-span-3 row-span-2 overflow-hidden rounded-2xl border border-purple-200 bg-purple-50 p-2.5 shadow sm:p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-purple-800 sm:gap-2 sm:text-xs">
                <HeartHandshake className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" /> Reuse saved
              </div>
              <div className="mt-1 line-clamp-1 text-xs font-bold text-neutral-900 sm:text-sm">12 office chairs → community center</div>
              <div className="line-clamp-2 text-[10px] text-neutral-600 sm:text-[11px]">Same day, before the landfill</div>
            </div>
          </div>
        </div>
      </section>

      {/* MISSION */}
      <section id="mission" className="border-b border-neutral-200 bg-white">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-3 bg-neutral-100 text-neutral-700 hover:bg-neutral-100">Why DumpMaps exists</Badge>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Recycling shouldn’t be a guessing game.</h2>
            <p className="mt-4 text-neutral-600 md:text-lg">
              Too much reusable material ends up in landfills. Haulers waste hours driving to facilities that turned them away.
              Donation centers need items — but no one knows. DumpMaps is the connective tissue between all of it.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {MISSION_POINTS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm ring-1 ring-neutral-200"><b.icon className="h-5 w-5" /></div>
                <h3 className="mt-3 text-lg font-bold">{b.title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IMPACT */}
      <section id="impact" className="border-b border-neutral-200 bg-neutral-50">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-3 bg-brand-100 text-brand-800 hover:bg-brand-100">What your support helps build</Badge>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Eight systems. One platform.</h2>
            <p className="mt-4 text-neutral-600 md:text-lg">
              DumpMaps isn’t just a map. It’s a coordination layer for haulers, donation centers,
              recyclers, contractors, property managers, and the communities they serve.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {IMPACT_ITEMS.map((i) => (
              <div key={i.title} className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100"><i.icon className="h-4 w-4" /></div>
                <h3 className="mt-3 text-base font-bold">{i.title}</h3>
                <p className="mt-1 text-xs text-neutral-600">{i.desc}</p>
              </div>
            ))}
          </div>
          {/* Metrics */}
          <div className="mt-10 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-5 sm:grid-cols-2 md:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-3xl font-extrabold text-brand-700">{m.value}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{m.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-center text-[11px] italic text-neutral-400">Pilot-phase metrics. Updated as the network grows.</div>
        </div>
      </section>

      {/* DONATE FORM */}
      <section id="donate-form" className="border-b border-neutral-200 bg-white">
        <div className="container mx-auto grid items-start gap-10 px-4 py-16 md:grid-cols-5 md:py-20">
          <div className="md:col-span-2">
            <Badge className="mb-3 bg-brand-100 text-brand-800 hover:bg-brand-100">Donate</Badge>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Help build the network.</h2>
            <p className="mt-3 text-neutral-600">
              Every contribution helps us extend live facility data, donation routing,
              and contractor tools to more cities. Pick an amount that feels right.
            </p>
            <div className="mt-5 space-y-2 text-sm text-neutral-600">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-600" /> Powered securely by Stripe</div>
              <div className="flex items-center gap-2"><Repeat className="h-4 w-4 text-brand-600" /> One-time or monthly</div>
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-brand-600" /> Receipt sent to your email</div>
            </div>
          </div>

          <form onSubmit={submit} className="md:col-span-3 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            {/* Amount */}
            <div>
              <div className="mb-1 text-sm font-bold">Choose an amount</div>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => { setAmount(a); setCustom('') }}
                    className={`rounded-xl border-2 py-3 text-base font-bold transition ${
                      amount === a && !custom
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
                    }`}
                  >${a}</button>
                ))}
              </div>
              <div className="mt-2">
                <Input type="number" min="1" placeholder="Custom amount ($)" value={custom} onChange={(e) => setCustom(e.target.value)} />
              </div>
            </div>

            {/* Frequency */}
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={() => setRecurring(false)} className={`flex-1 rounded-full border-2 py-2 text-sm font-semibold ${!recurring ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white'}`}>One-time</button>
              <button type="button" onClick={() => setRecurring(true)}  className={`flex-1 rounded-full border-2 py-2 text-sm font-semibold ${recurring ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white'}`}>Monthly</button>
            </div>

            {/* Tier */}
            <div className="mt-4">
              <div className="mb-1 text-sm font-bold">Tier (optional)</div>
              <div className="flex flex-wrap gap-1.5">
                {TIERS.map((t) => (
                  <button key={t.key} type="button" onClick={() => setTier(t.key)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${tier === t.key ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-neutral-700'}`}>{t.name.split(' ')[0]}</button>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Input placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
              <Input type="email" placeholder="Email *" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="mt-3">
              <Textarea rows={2} placeholder="Add a message (optional) — what should we build next?" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>

            <Button type="submit" disabled={submitting} className="mt-4 w-full bg-brand-600 py-6 text-base font-bold hover:bg-brand-700">
              {submitting ? 'Processing…' : `Donate $${resolveAmount(custom, amount)}${recurring ? ' / month' : ''}`}
              <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
            <div className="mt-3 text-center text-[11px] text-neutral-500">
              <ShieldCheck className="mr-1 inline h-3 w-3 text-brand-600" /> Powered securely by Stripe. {stripeReady ? 'Test mode active.' : 'Stripe checkout finalizing — we’ll email you the moment it goes live.'}
            </div>
          </form>
        </div>
      </section>

      {/* TIERS */}
      <section id="tiers" className="border-b border-neutral-200 bg-neutral-50">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-3 bg-neutral-100 text-neutral-700 hover:bg-neutral-100">Supporter tiers</Badge>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Pick the tier that fits your role.</h2>
            <p className="mt-3 text-neutral-600">Every tier directly funds a specific part of the platform.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {TIERS.map((t) => {
              const Icon = t.icon
              return (
                <div key={t.key} className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${t.accent}-50 text-${t.accent}-700 ring-1 ring-${t.accent}-100`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-3 text-base font-bold">{t.name}</h3>
                  <p className="mt-1 flex-1 text-xs text-neutral-600">{t.desc}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xl font-extrabold">${t.amount}<span className="text-xs font-normal text-neutral-500">/mo</span></div>
                    <a href="#donate-form" onClick={() => { setTier(t.key); setAmount(t.amount); setRecurring(true); setCustom('') }} className="text-xs font-bold text-brand-700 hover:underline">Choose →</a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* PARTNERS */}
      <section id="partners" className="border-b border-neutral-200 bg-white">
        <div className="container mx-auto grid items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-20">
          <div>
            <Badge className="mb-3 bg-blue-100 text-blue-800 hover:bg-blue-100">Partner with us</Badge>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Businesses, facilities, sponsors.</h2>
            <p className="mt-3 text-neutral-600">
              Running a transfer station, scrap yard, donation center, or recycling company?
              Partner with DumpMaps to publish live status, accept verified contractor traffic,
              and reach the haulers who keep your gates moving.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="mailto:partners@dumpmaps.org" className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800"><Building2 className="h-4 w-4" /> Become a Partner</a>
              <a href="mailto:sponsors@dumpmaps.org" className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:border-neutral-400"><Sparkles className="h-4 w-4" /> Sponsor DumpMaps</a>
              <a href="mailto:hello@dumpmaps.org" className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:border-neutral-400"><Mail className="h-4 w-4" /> Contact us</a>
            </div>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-gradient-to-br from-neutral-900 via-neutral-800 to-brand-900 p-7 text-white shadow-xl">
            <div className="text-xs font-bold uppercase tracking-wide text-brand-300">Who partners with us</div>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {PARTNER_TYPES.map((p) => (
                <li key={p} className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-brand-400" /> {p}</li>
              ))}
            </ul>
            <div className="mt-5 rounded-xl bg-white/5 p-3 text-xs text-neutral-300">
              “We needed a faster way to tell haulers when our gate was closed. DumpMaps gave us that channel.”
              <div className="mt-1 text-[11px] uppercase tracking-wide text-brand-300">— Partner pilot facility</div>
            </div>
          </div>
        </div>
      </section>

      {/* TRANSPARENCY */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-3 bg-neutral-100 text-neutral-700 hover:bg-neutral-100">Where support goes</Badge>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Built in the open, funded with intention.</h2>
            <p className="mt-3 text-neutral-600">
              Every dollar is reinvested into the platform and the communities it serves.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="space-y-3">
              {TRANSPARENCY.map((t) => (
                <div key={t.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-neutral-700">{t.label}</span>
                    <span className="font-bold text-neutral-900">{t.pct}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${t.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-3 bg-brand-100 text-brand-800 hover:bg-brand-100">Voices from the field</Badge>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">The people we built this for.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                <Quote className="h-5 w-5 text-brand-600" />
                <p className="mt-2 text-sm text-neutral-700">“{t.quote}”</p>
                <div className="mt-3">
                  <div className="text-sm font-bold">{t.name}</div>
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-800 to-brand-900 text-white">
        <div className="container mx-auto px-4 py-20 text-center md:py-24">
          <Zap className="mx-auto h-8 w-8 text-brand-400" />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">Help build a smarter recycling network.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-neutral-300 md:text-lg">
            Whether you donate, partner, or just join the platform — you’re part of the network.
            Every contribution makes haulers, facilities, donation centers, and communities work a little better together.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href="#donate-form" className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white hover:bg-brand-700"><HeartHandshake className="h-4 w-4" /> Donate Now</a>
            <HomeBrandLink className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"><Users className="h-4 w-4" /> Join DumpMaps</HomeBrandLink>
            <a href="#partners" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"><Building2 className="h-4 w-4" /> Become a Partner</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-brand-600 text-white"><Recycle className="h-3 w-3" /></div>
            <span>© {new Date().getFullYear()} DumpMaps · Smarter recycling, reuse, and contractor coordination.</span>
          </div>
          <div className="flex items-center gap-4">
            <HomeBrandLink className="hover:text-neutral-900"><span>Home</span></HomeBrandLink>
            <Link href="/donate" className="hover:text-neutral-900">Donate</Link>
            <a href="mailto:hello@dumpmaps.org" className="hover:text-neutral-900">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
