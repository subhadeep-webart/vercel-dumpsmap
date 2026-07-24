import AppHeader from '@/components/AppHeader'
import EmailCTAButton from '@/components/EmailCTAButton'
import RouteFeatureLock from '@/components/RouteFeatureLock'
import { Briefcase, ShieldCheck, ClipboardList, Sparkles, ArrowRight, MailPlus, BadgeCheck, FileCheck2, Building2, Truck, Recycle, HeartHandshake, Camera, DollarSign, Star } from 'lucide-react'

export const metadata = {
  title: 'Verified Contractor Job Board – Coming Soon | DumpMaps',
  description:
    'DumpMaps is building a network of verified haulers, recyclers, junk removal companies, labor crews, and contractors. Browse and post hauling, cleanup, recycling, donation, demolition, labor, and transportation jobs.',
  alternates: { canonical: 'https://dumpmaps.org/jobs' },
  openGraph: {
    title: 'Verified Contractor Job Board – Coming Soon',
    description:
      'Verified haulers, recyclers, and contractors — bid on jobs, build a reputation, get paid through DumpMaps.',
    type: 'website',
    url: 'https://dumpmaps.org/jobs',
  },
}

// Email body templates. We pass these to <EmailCTAButton> which constructs
// the mailto: URL at click time on the client. This bypasses Cloudflare's
// /cdn-cgi/l/email-protection rewrite that breaks plain <a href="mailto:">
// links on the production deploy.
const CONTRACTOR_RECIPIENT = 'jamal@dumpmaps.org'
const CONTRACTOR_SUBJECT = 'DumpMaps Contractor Verification Request'
const CONTRACTOR_BODY = 'Hi DumpMaps team,\n\nI would like to apply for verification as a DumpMaps contractor.\n\n— Business Name:\n— Contact name:\n— Phone:\n— Email:\n— Service area (cities / counties):\n— Services offered (hauling / cleanup / recycling / donation / demolition / labor / transport / other):\n— Years in business:\n— Insurance (carrier + policy # if applicable):\n— License (type + #, if applicable):\n— Website or social handles:\n\nThanks!'

const POSTER_RECIPIENT = 'jamal@dumpmaps.org'
const POSTER_SUBJECT = 'DumpMaps Job Posting Inquiry'
const POSTER_BODY = 'Hi DumpMaps team,\n\nI would like to post a job on DumpMaps.\n\n— Posting on behalf of (business / property mgr / facility / nonprofit / resident):\n— Type of job (hauling / cleanup / recycling / donation pickup / demolition / labor / transport):\n— Location (city + zip):\n— Approximate scope:\n— Timeline:\n— Budget range:\n— Contact name + phone:\n\nThanks!'

const Card = ({ icon: Icon, title, children }) => (
  <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md">
    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
      <Icon className="h-5 w-5" />
    </div>
    <div className="text-base font-bold text-neutral-900">{title}</div>
    <div className="mt-1 text-sm leading-relaxed text-neutral-600">{children}</div>
  </div>
)

export default function JobsLandingPage() {
  return (
    <RouteFeatureLock featureKey="jobs">
      <JobsLandingContent />
    </RouteFeatureLock>
  )
}

function JobsLandingContent() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-brand-50/30">
      <AppHeader active="jobs" />

      {/* Hero */}
      <section className="container mx-auto px-4 pb-12 pt-12 md:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
            <Sparkles className="h-3.5 w-3.5" /> Coming Soon
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-neutral-900 md:text-5xl">
            Verified Contractor Job Board
            <span className="block text-brand-600">— Coming Soon.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-600">
            DumpMaps is building a network of verified haulers, recyclers, junk removal companies,
            labor crews, and contractors.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <EmailCTAButton
              recipient={CONTRACTOR_RECIPIENT}
              subject={CONTRACTOR_SUBJECT}
              body={CONTRACTOR_BODY}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700"
            >
              <BadgeCheck className="h-4 w-4" /> Apply for Verification
            </EmailCTAButton>
            <EmailCTAButton
              recipient={POSTER_RECIPIENT}
              subject={POSTER_SUBJECT}
              body={POSTER_BODY}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-bold text-neutral-900 hover:border-neutral-400"
            >
              <MailPlus className="h-4 w-4" /> Inquire About Posting Jobs
            </EmailCTAButton>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 pb-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm md:p-10">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-brand-600" />
            <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900">How it will work</h2>
          </div>
          <ul className="mt-5 grid gap-3 text-sm text-neutral-800 md:grid-cols-2">
            <li className="flex items-start gap-2"><span className="text-brand-600">✅</span> Anyone can browse available jobs.</li>
            <li className="flex items-start gap-2"><span className="text-brand-600">✅</span> Anyone can post jobs (after approval process).</li>
          </ul>
          <div className="mt-7 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-800">
              <ShieldCheck className="h-4 w-4" /> Only verified contractors can:
            </div>
            <ul className="mt-3 grid gap-2 text-sm text-brand-900 md:grid-cols-2">
              <li className="flex items-start gap-2"><Briefcase className="mt-0.5 h-4 w-4 text-brand-700" /> Claim jobs</li>
              <li className="flex items-start gap-2"><FileCheck2 className="mt-0.5 h-4 w-4 text-brand-700" /> Accept work</li>
              <li className="flex items-start gap-2"><Camera className="mt-0.5 h-4 w-4 text-brand-700" /> Submit completion photos</li>
              <li className="flex items-start gap-2"><DollarSign className="mt-0.5 h-4 w-4 text-brand-700" /> Receive payments</li>
              <li className="flex items-start gap-2"><Star className="mt-0.5 h-4 w-4 text-brand-700" /> Build platform ratings</li>
              <li className="flex items-start gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 text-brand-700" /> Access contractor-only opportunities</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Become a Verified Contractor */}
      <section className="container mx-auto px-4 pb-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BadgeCheck className="h-6 w-6 text-brand-600" />
              <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900">Become a Verified Contractor</h2>
            </div>
            <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">For haulers, recyclers, labor crews</span>
          </div>
          <p className="mt-3 text-sm text-neutral-600">
            Verification protects clients, lifts trust across the network, and gives you access to higher-value
            jobs as DumpMaps grows. Requirements may include:
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Card icon={Building2} title="Business Name">Legal business or DBA on file.</Card>
            <Card icon={ClipboardList} title="Contact Information">Primary contact, phone, and email.</Card>
            <Card icon={Truck} title="Service Area">Cities, counties, or radius you serve.</Card>
            <Card icon={ShieldCheck} title="Insurance (when applicable)">General liability carrier & policy number.</Card>
            <Card icon={FileCheck2} title="License Information (when applicable)">Hauler permit, contractor license, or municipal cert.</Card>
            <Card icon={DollarSign} title="W-9 / Tax Information">For payment routing through Stripe.</Card>
            <Card icon={ShieldCheck} title="Background Review">Light background and reference check.</Card>
            <Card icon={FileCheck2} title="Platform Agreement">DumpMaps contractor terms + safety policy.</Card>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <EmailCTAButton
              recipient={CONTRACTOR_RECIPIENT}
              subject={CONTRACTOR_SUBJECT}
              body={CONTRACTOR_BODY}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700"
            >
              <BadgeCheck className="h-4 w-4" /> Apply for Verification
              <ArrowRight className="h-4 w-4" />
            </EmailCTAButton>
            <span className="text-xs text-neutral-500">Email opens with a pre-filled application template.</span>
          </div>
        </div>
      </section>

      {/* Need a contractor? */}
      <section className="container mx-auto px-4 pb-16">
        <div className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-gradient-to-br from-white to-brand-50/40 p-6 shadow-sm md:p-10">
          <div className="flex items-center gap-3">
            <Briefcase className="h-6 w-6 text-brand-600" />
            <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900">Need a contractor?</h2>
          </div>
          <p className="mt-3 text-sm text-neutral-700">
            Businesses, property managers, facilities, nonprofits, and residents will soon be able to post hauling,
            cleanup, recycling, donation, demolition, labor, and transportation opportunities.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Card icon={Truck} title="Hauling & Junk Removal">Single pickup or recurring routes.</Card>
            <Card icon={Recycle} title="Recycling & E-waste">Scrap, metals, CRV, construction debris.</Card>
            <Card icon={HeartHandshake} title="Donation Pickups">Furniture, household goods, reuse.</Card>
            <Card icon={Building2} title="Demolition & Cleanup">Apartment turnovers, site clean-outs.</Card>
            <Card icon={Briefcase} title="Labor & Crews">Day labor, moving, sorting, prep.</Card>
            <Card icon={Sparkles} title="Transport">Short-haul, route runs, equipment moves.</Card>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <EmailCTAButton
              recipient={POSTER_RECIPIENT}
              subject={POSTER_SUBJECT}
              body={POSTER_BODY}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700"
            >
              <MailPlus className="h-4 w-4" /> Inquire About Posting Jobs
              <ArrowRight className="h-4 w-4" />
            </EmailCTAButton>
            <span className="text-xs text-neutral-500">Email opens with a pre-filled posting template.</span>
          </div>
        </div>
      </section>
    </div>
  )
}
