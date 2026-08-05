import EmailCTAButton from '@/components/EmailCTAButton'
import RouteFeatureLock from '@/components/RouteFeatureLock'
import { Briefcase, ShieldCheck, ClipboardList, Sparkles, ArrowRight, MailPlus, BadgeCheck, FileCheck2, Building2, Truck, Recycle, HeartHandshake, Camera, CircleDollarSign, Star, CircleCheck } from 'lucide-react'

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
  <div className="group rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md sm:p-5">
    <div className="mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-100 sm:mb-3 sm:h-10 sm:w-10">
      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
    </div>
    <div className="text-sm font-bold text-neutral-900 sm:text-base">{title}</div>
    <div className="mt-1 text-xs leading-relaxed text-neutral-600 sm:text-sm">{children}</div>
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

      {/* Hero */}
      <section className="container mx-auto px-4 pb-12 pt-10 sm:pt-12 md:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700 sm:gap-2 sm:px-3 sm:text-xs">
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Coming Soon
          </span>
          <h1 className="mt-3 text-[1.75rem] font-extrabold leading-[1.1] tracking-tight text-neutral-900 sm:mt-4 sm:text-4xl md:text-5xl">
            Verified Contractor Job Board
            <span className="mt-1 block bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">— Coming Soon.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-neutral-600 sm:mt-5 sm:text-base md:text-lg">
            DumpMaps is building a network of verified haulers, recyclers, junk removal companies,
            labor crews, and contractors.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2.5 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-3">
            <EmailCTAButton
              recipient={CONTRACTOR_RECIPIENT}
              subject={CONTRACTOR_SUBJECT}
              body={CONTRACTOR_BODY}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 hover:shadow-md sm:px-6 sm:py-3"
            >
              <BadgeCheck className="h-4 w-4" /> Apply for Verification
            </EmailCTAButton>
            <EmailCTAButton
              recipient={POSTER_RECIPIENT}
              subject={POSTER_SUBJECT}
              body={POSTER_BODY}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-900 transition hover:border-neutral-400 sm:px-6 sm:py-3"
            >
              <MailPlus className="h-4 w-4" /> Inquire About Posting Jobs
            </EmailCTAButton>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 pb-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6 md:p-10">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <ClipboardList className="h-5 w-5 shrink-0 text-brand-600 sm:h-6 sm:w-6" />
            <h2 className="text-lg font-extrabold tracking-tight text-neutral-900 sm:text-2xl">How it will work</h2>
          </div>
          <ul className="mt-4 grid gap-2.5 text-xs text-neutral-800 sm:mt-5 sm:gap-3 sm:text-sm md:grid-cols-2">
            <li className="flex items-start gap-2"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Anyone can browse available jobs.</li>
            <li className="flex items-start gap-2"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Anyone can post jobs (after approval process).</li>
          </ul>
          <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:mt-7 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-800 sm:text-sm">
              <ShieldCheck className="h-4 w-4 shrink-0" /> Only verified contractors can:
            </div>
            <ul className="mt-3 grid gap-2 text-xs text-brand-900 sm:text-sm md:grid-cols-2">
              <li className="flex items-start gap-2"><Briefcase className="mt-0.5 h-4 w-4 text-brand-700" /> Claim jobs</li>
              <li className="flex items-start gap-2"><FileCheck2 className="mt-0.5 h-4 w-4 text-brand-700" /> Accept work</li>
              <li className="flex items-start gap-2"><Camera className="mt-0.5 h-4 w-4 text-brand-700" /> Submit completion photos</li>
              <li className="flex items-start gap-2"><CircleDollarSign className="mt-0.5 h-4 w-4 text-brand-700" /> Receive payments</li>
              <li className="flex items-start gap-2"><Star className="mt-0.5 h-4 w-4 text-brand-700" /> Build platform ratings</li>
              <li className="flex items-start gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 text-brand-700" /> Access contractor-only opportunities</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Become a Verified Contractor */}
      <section className="container mx-auto px-4 pb-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <BadgeCheck className="h-5 w-5 shrink-0 text-brand-600 sm:h-6 sm:w-6" />
              <h2 className="text-lg font-extrabold tracking-tight text-neutral-900 sm:text-2xl">Become a Verified Contractor</h2>
            </div>
            <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 sm:px-3 sm:text-xs">For haulers, recyclers, labor crews</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-neutral-600 sm:text-sm">
            Verification protects clients, lifts trust across the network, and gives you access to higher-value
            jobs as DumpMaps grows. Requirements may include:
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Card icon={Building2} title="Business Name">Legal business or DBA on file.</Card>
            <Card icon={ClipboardList} title="Contact Information">Primary contact, phone, and email.</Card>
            <Card icon={Truck} title="Service Area">Cities, counties, or radius you serve.</Card>
            <Card icon={ShieldCheck} title="Insurance (when applicable)">General liability carrier & policy number.</Card>
            <Card icon={FileCheck2} title="License Information (when applicable)">Hauler permit, contractor license, or municipal cert.</Card>
            <Card icon={CircleDollarSign} title="W-9 / Tax Information">For payment routing through Stripe.</Card>
            <Card icon={ShieldCheck} title="Background Review">Light background and reference check.</Card>
            <Card icon={FileCheck2} title="Platform Agreement">DumpMaps contractor terms + safety policy.</Card>
          </div>
          <div className="mt-6 flex flex-col items-start gap-2.5 sm:mt-7 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <EmailCTAButton
              recipient={CONTRACTOR_RECIPIENT}
              subject={CONTRACTOR_SUBJECT}
              body={CONTRACTOR_BODY}
              className="group inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 hover:shadow-md sm:w-auto sm:px-6 sm:py-3"
            >
              <BadgeCheck className="h-4 w-4 shrink-0" /> Apply for Verification
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </EmailCTAButton>
            <span className="text-[11px] text-neutral-500 sm:text-xs">Email opens with a pre-filled application template.</span>
          </div>
        </div>
      </section>

      {/* Need a contractor? */}
      <section className="container mx-auto px-4 pb-16">
        <div className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-gradient-to-br from-white to-brand-50/40 p-5 shadow-sm sm:p-6 md:p-10">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Briefcase className="h-5 w-5 shrink-0 text-brand-600 sm:h-6 sm:w-6" />
            <h2 className="text-lg font-extrabold tracking-tight text-neutral-900 sm:text-2xl">Need a contractor?</h2>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-neutral-700 sm:text-sm">
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
          <div className="mt-6 flex flex-col items-start gap-2.5 sm:mt-7 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <EmailCTAButton
              recipient={POSTER_RECIPIENT}
              subject={POSTER_SUBJECT}
              body={POSTER_BODY}
              className="group inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 hover:shadow-md sm:w-auto sm:px-6 sm:py-3"
            >
              <MailPlus className="h-4 w-4 shrink-0" /> Inquire About Posting Jobs
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </EmailCTAButton>
            <span className="text-[11px] text-neutral-500 sm:text-xs">Email opens with a pre-filled posting template.</span>
          </div>
        </div>
      </section>
    </div>
  )
}
