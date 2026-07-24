'use client'

import { Button } from '@/components/ui/button'
import { HeartHandshake } from 'lucide-react'

export default function HomeSupportMission({ onDonate, onBusiness }) {
  return (
    <section id="about" className="bg-emerald-600 py-16 text-white">
      <div className="container mx-auto grid items-center gap-8 px-4 lg:grid-cols-[1fr_auto]">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:h-14 sm:w-14">
            <HeartHandshake className="h-5 w-5 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold sm:text-2xl md:text-3xl">Support our mission. Make a difference.</h2>
            <p className="mt-2 max-w-2xl text-sm text-emerald-50 sm:text-base">
              Your donation helps us expand DumpMaps, support local clean-ups, and bring more resources to our community.
              Every contribution counts.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end lg:justify-start">
          <Button size="lg" onClick={onDonate} className="h-10 rounded-full bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 sm:h-12 sm:px-6 sm:text-base">
            Donate Now
          </Button>
          <Button size="lg" onClick={onBusiness} variant="outline" className="h-10 rounded-full border-white bg-transparent px-4 text-sm font-semibold text-white hover:bg-white/10 sm:h-12 sm:px-6 sm:text-base">
            For Business
          </Button>
        </div>
      </div>
    </section>
  )
}
