'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import BusinessHeroVideo from '@/components/business/BusinessHeroVideo'
import { useBusinessVideo } from '@/lib/useBusinessVideo'
import { HERO_BENEFITS } from '@/constants/business_constants'
import { ArrowRight, TrendingUp, Star, ShieldCheck, Building2, CheckCircle2 } from 'lucide-react'

export default function BusinessHero({ onCtaClick }) {
  const { video, showVideo } = useBusinessVideo()

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/60 via-white to-white">
      <div className="container mx-auto grid items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <Badge className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">For Businesses</Badge>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            More traffic. <span className="text-emerald-600">More impact.</span><br />More rewards.
          </h1>
          <p className="mt-5 max-w-xl text-base text-neutral-600 md:text-lg">
            Partner with DumpMaps to attract more customers, reduce uncertainty, improve customer satisfaction,
            and reward responsible recycling — together.
          </p>
          <ul className="mt-6 space-y-2.5 text-[15px] text-neutral-800">
            {HERO_BENEFITS.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={onCtaClick} size="lg" className="h-12 bg-emerald-600 px-6 font-semibold hover:bg-emerald-700">
              Partner With Us <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button onClick={onCtaClick} size="lg" variant="outline" className="h-12 border-emerald-200 px-6 font-semibold text-emerald-700 hover:bg-emerald-50">
              Request a Demo
            </Button>
          </div>
        </div>

        {/* Right: CMS "Request a Demo" video, or the default partner card mock */}
        <div className="relative">
          {showVideo ? (
            <BusinessHeroVideo video={video} />
          ) : (
          <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl shadow-emerald-100">
            <img
              src="https://images.unsplash.com/photo-1715541275956-4845a5cf74c1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwxfHx3YXN0ZSUyMGZhY2lsaXR5fGVufDB8fHxncmVlbnwxNzgyOTE4MzE2fDA&ixlib=rb-4.1.0&q=85"
              alt="Modern recycling facility"
              className="h-[420px] w-full object-cover"
            />
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/95 p-4 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Bay Buyback Center</div>
                    <div className="text-[11px] text-neutral-500">Hayward, CA</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <ShieldCheck className="h-3 w-3" /> Verified Partner
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-emerald-50 p-2">
                  <div className="flex items-center justify-center gap-0.5 text-emerald-700">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <div className="text-base font-extrabold">+28%</div>
                  </div>
                  <div className="text-[10px] font-medium text-emerald-700">More Visits</div>
                </div>
                <div className="rounded-lg bg-amber-50 p-2">
                  <div className="flex items-center justify-center gap-0.5 text-amber-700">
                    <Star className="h-3.5 w-3.5 fill-amber-400" />
                    <div className="text-base font-extrabold">4.8</div>
                  </div>
                  <div className="text-[10px] font-medium text-amber-700">Rating</div>
                </div>
                <div className="rounded-lg bg-neutral-100 p-2">
                  <div className="text-base font-extrabold text-neutral-800">$12,450</div>
                  <div className="text-[10px] font-medium text-neutral-600">Cash Back Earned</div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </section>
  )
}
