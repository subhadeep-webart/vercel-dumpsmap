'use client'

import { Button } from '@/components/ui/button'
import { Leaf } from 'lucide-react'

export default function BusinessCtaBand({ onCtaClick }) {
  return (
    <section className="bg-emerald-600 py-14 text-white">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-4">
          <Leaf className="h-10 w-10" />
          <div>
            <div className="text-2xl font-bold">Let&apos;s grow your impact — together.</div>
            <div className="text-[14px] text-emerald-100">Join DumpMaps today and start driving more traffic, rewarding customers, and building a cleaner future.</div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={onCtaClick} className="h-12 rounded-full bg-white px-6 font-semibold text-emerald-700 hover:bg-emerald-50">
            Partner With Us
          </Button>
          <Button onClick={onCtaClick} variant="outline" className="h-12 rounded-full border-white bg-transparent px-6 font-semibold text-white hover:bg-white/10">
            Request a Demo
          </Button>
        </div>
      </div>
    </section>
  )
}
