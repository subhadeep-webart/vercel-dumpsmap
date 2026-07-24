import Link from 'next/link'
import { Briefcase, Recycle, Star } from 'lucide-react'
import PageShell from '@/components/PageShell'

export const metadata = { title: 'Recommendations — DumpMaps' }

export default function RecommendationsHub() {
  const cards = [
    {
      href: '/recommendations/contractors',
      icon: Briefcase,
      title: 'Trusted contractors',
      blurb: 'Vetted, community-reviewed haulers, junk removers, and demo crews in your area.',
      cta: 'Find a contractor',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      href: '/recommendations/facilities',
      icon: Recycle,
      title: 'Top-rated facilities',
      blurb: 'Highest-rated drop-off sites for recycling, donation, scrap, and disposal near you.',
      cta: 'Browse top facilities',
      color: 'from-brand-500 to-brand-700',
    },
  ]
  return (
    <PageShell active="feed" breadcrumbs={[ { label: 'Recommendations' } ]} maxWidth="max-w-3xl">
        <div className="mb-6 text-center">
          <p className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> Community-vetted
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">Find someone you can trust</h1>
          <p className="mx-auto mt-1 max-w-xl text-sm text-neutral-600">
            Real reviews from real DumpMaps users — not paid placements. Choose a category to get started.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((c) => {
            const Icon = c.icon
            return (
              <Link key={c.href} href={c.href} className="group rounded-2xl border border-neutral-200 bg-white p-6 transition hover:border-neutral-300 hover:shadow-md">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-white shadow`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-3 text-lg font-bold">{c.title}</h2>
                <p className="mt-1 text-sm text-neutral-600">{c.blurb}</p>
                <p className="mt-3 text-sm font-semibold text-brand-700 group-hover:underline">{c.cta} →</p>
              </Link>
            )
          })}
        </div>
      </PageShell>
  )
}
