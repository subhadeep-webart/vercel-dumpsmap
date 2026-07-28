'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { HERO_STATS } from '@/constants/home_constants'
import {
  Search, ArrowRight, HeartHandshake, BadgeCheck, Activity, Star,
} from 'lucide-react'

export default function HomeHero({ onSearchFacilities, onJoinBeta, onDonate }) {
  return (
    <section className="relative overflow-hidden border-b border-neutral-100 bg-gradient-to-b from-emerald-50/40 via-white to-white">
      <div className="container mx-auto grid items-center gap-10 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-2 lg:gap-12 lg:py-20 xl:py-24">
        <div className="max-w-2xl md:mx-auto md:text-center lg:mx-0 lg:max-w-none lg:text-left">
          <Badge className="mb-5 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">
            <span className="mr-1 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /> New — Live wait times &amp; cashback
          </Badge>
          <h1 className="text-[2rem] font-extrabold leading-[1.3] tracking-tight text-neutral-900 sm:text-4xl md:tracking-normal lg:text-[2.75rem] lg:leading-[1.25] lg:tracking-normal xl:text-6xl xl:leading-[1.15]">
            Find the right <span className="text-emerald-600">recycling facility</span> before you leave home.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] text-neutral-600 sm:text-base md:mx-auto md:mt-6 lg:mx-0 xl:text-lg">
            Discover nearby recycling centers, transfer stations, donation locations, buy-back facilities, and hazardous
            waste sites. View live wait times, see community updates, and earn cashback at participating partners.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center md:justify-center lg:justify-start">
            <Button size="lg" onClick={onSearchFacilities} className="h-12 w-full bg-emerald-600 px-6 text-[15px] font-semibold hover:bg-emerald-700 sm:w-auto">
              <Search className="mr-2 h-5 w-5" /> Search Facilities
            </Button>
            <Button size="lg" variant="outline" onClick={onJoinBeta} className="h-12 w-full border-emerald-200 px-6 text-[15px] font-semibold text-emerald-700 hover:bg-emerald-50 sm:w-auto">
              Join Beta <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="ghost" onClick={onDonate} className="h-12 w-full px-4 text-[14px] font-medium text-neutral-700 hover:bg-neutral-100 sm:w-auto">
              <HeartHandshake className="mr-2 h-4 w-4 text-emerald-600" /> Support Our Mission
            </Button>
          </div>

          {/* Trust stats row */}
          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 border-t border-neutral-100 pt-6 text-left sm:gap-4 md:mx-auto md:text-center lg:mx-0 lg:text-left">
            {HERO_STATS.map((s) => (
              <div key={s.v}>
                <div className="text-xl font-extrabold text-emerald-700 sm:text-2xl">{s.k}</div>
                <div className="text-[11px] font-medium leading-snug text-neutral-500">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: interactive preview card */}
        <div className="relative mx-auto w-full max-w-xl pb-12 pt-8 sm:pb-12 lg:mx-0 lg:max-w-none xl:pb-0 xl:pt-0">
          <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl shadow-emerald-100">
            <img
              src="https://images.pexels.com/photos/6995378/pexels-photo-6995378.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
              alt="People sorting recycling at a modern facility"
              className="h-[300px] w-full object-cover sm:h-[380px] lg:h-[400px] xl:h-[440px]"
            />
            {/* Facility card overlay */}
            <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-4 sm:left-4 sm:right-4 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="truncate text-sm font-bold text-neutral-900">Bay Buyback Center</div>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-neutral-500">Hayward, CA · 4.2 mi away</div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> No Wait
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-neutral-50 px-2 py-1.5">
                  <div className="text-[10px] font-medium text-neutral-500">Wait</div>
                  <div className="text-sm font-bold text-emerald-700">~5 min</div>
                </div>
                <div className="rounded-lg bg-neutral-50 px-2 py-1.5">
                  <div className="text-[10px] font-medium text-neutral-500">Rating</div>
                  <div className="inline-flex items-center justify-center gap-0.5 text-sm font-bold text-amber-600"><Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> 4.8</div>
                </div>
                <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
                  <div className="text-[10px] font-medium text-emerald-700">Cash Back</div>
                  <div className="text-sm font-bold text-emerald-700">5%</div>
                </div>
              </div>
            </div>

            {/* Live status pill */}
            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-neutral-800 shadow backdrop-blur sm:left-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-[11px]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              LIVE · Updated 3 min ago
            </div>
          </div>

          {/* Floating small cards */}
          <div className="absolute bottom-0 left-0 w-44 rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-lg sm:w-48 sm:p-3 lg:w-44 xl:-bottom-6 xl:-left-6 xl:w-52">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 sm:h-9 sm:w-9">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-bold text-neutral-900">Alum Rock Transfer</div>
                <div className="truncate text-[10px] text-neutral-500">Heavy line · ~45 min</div>
              </div>
            </div>
          </div>
          <div className="absolute right-0 -top-4 w-44 rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-lg sm:w-48 sm:p-3 lg:w-44 xl:-right-4 xl:-top-4 xl:w-52">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 sm:h-9 sm:w-9">
                <HeartHandshake className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-bold text-neutral-900">Donation Center</div>
                <div className="truncate text-[10px] text-neutral-500">Needs furniture today</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
