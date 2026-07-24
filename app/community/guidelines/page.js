'use client'

import Link from 'next/link'
import PageShell from '@/components/PageShell'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Recycle, Shield, AlertTriangle, Heart, Users, Megaphone, FileText } from 'lucide-react'

const RULES = [
  { icon: Recycle, title: 'Stay operational and hyper-local', body: 'DumpMaps is for cleanup, hauling, recycling, reuse, donation, and contractor coordination. Posts that aren\'t operational or neighborhood-focused will be removed.' },
  { icon: AlertTriangle, title: 'No scams or fake listings', body: 'Don\'t post fake pickups, fake free items, fake jobs, or anything misleading. Verify before reposting third-party info.' },
  { icon: Shield, title: 'No harassment or discrimination', body: 'Respect haulers, residents, contractors, and facility staff. Zero tolerance for racism, sexism, or threats.' },
  { icon: Heart, title: 'Coordinate pickups safely', body: 'Public meeting spots when possible. Don\'t share home addresses publicly when you can avoid it. Note daylight pickup times for safety.' },
  { icon: Megaphone, title: 'Tag urgent posts honestly', body: 'Use 🚨 Urgent only for real-time issues (active dumping, hazards, fast-pickup curb alerts). Don\'t flood the feed.' },
  { icon: Users, title: 'Use the right category', body: 'Illegal Dumping, Free Items, Donation Need, Pickup Request, Contractor Tip, Facility Update, Safety Alert, Cleanup Event, Agency Notice, or General. Wrong category = harder to find.' },
  { icon: FileText, title: 'No illegal activity', body: 'Don\'t coordinate illegal dumping, theft, fraud, or unlicensed hauling for paid jobs. Report it instead.' },
]

const REPORTING = [
  '**Spam / fake listing** — wrong category, AI noise, or duplicate spam',
  '**Scam** — fake free items, payment fraud, identity theft attempts',
  '**Harassment / hate** — slurs, threats, doxxing, targeted abuse',
  '**Illegal activity** — illegal dumping coordination, illegal hauling, theft',
  '**Wrong information** — facility hours/pricing fake, location mislabeled',
  '**Personal info exposure** — someone\'s home address, phone, or photos posted without permission',
]

const ACTIONS = [
  '**Warning** — moderators message you with a fix request',
  '**Post removal** — single post removed, account stays active',
  '**Temporary suspension** — 7–30 days, depending on severity',
  '**Permanent ban** — for scams, repeated harassment, or illegal activity',
  '**Verification revoke** — verified contractors / agencies lose badge',
]

export default function CommunityGuidelinesPage() {
  return (
    <PageShell active="community" breadcrumbs={[{ label: 'Community', href: '/community' }, { label: 'Guidelines' }]} maxWidth="max-w-3xl">
        <div className="rounded-xl bg-gradient-to-r from-brand-50 to-brand-100 p-6">
          <h1 className="text-2xl font-extrabold tracking-tight">DumpMaps Community Guidelines</h1>
          <p className="mt-1 text-sm text-neutral-700">DumpMaps Community is a hyper-local, operational platform for cleanup, hauling, recycling, reuse, donation, and contractor coordination. These rules keep the community fast, safe, and genuinely useful.</p>
        </div>

        <section className="mt-6">
          <h2 className="text-lg font-bold">The Rules</h2>
          <div className="mt-3 space-y-2">
            {RULES.map((r, i) => (
              <Card key={i}>
                <CardContent className="flex gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700"><r.icon className="h-5 w-5" /></div>
                  <div>
                    <div className="text-sm font-bold">{r.title}</div>
                    <p className="text-xs text-neutral-700">{r.body}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-bold">When to report a post</h2>
          <ul className="mt-2 ml-5 list-disc space-y-1 text-sm text-neutral-700">
            {REPORTING.map((r, i) => <li key={i} dangerouslySetInnerHTML={{ __html: r.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />)}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">Tap the flag icon on any post or comment to report. Reports go to the admin moderation queue and we review within 24 hours for high-priority items.</p>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-bold">Moderation actions</h2>
          <ul className="mt-2 ml-5 list-disc space-y-1 text-sm text-neutral-700">
            {ACTIONS.map((r, i) => <li key={i} dangerouslySetInnerHTML={{ __html: r.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />)}
          </ul>
        </section>

        <section className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
          <div className="font-bold text-blue-900">🏛 Verified Agencies &amp; Public Works</div>
          <p className="mt-1 text-blue-900/80">Cities, sanitation departments, and environmental groups can apply for verified agency status to post official notices. Contact admin to request verification.</p>
        </section>

        <section className="mt-6 text-center text-xs text-neutral-500">
          <Link href="/community" className="text-brand-700 hover:underline">← Back to community feed</Link>
        </section>
    </PageShell>
  )
}
