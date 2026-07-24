'use client'

import { Button } from '@/components/ui/button'
import { CircleDollarSign, ArrowRight } from 'lucide-react'

export default function HomeCashbackStrip({ onCtaClick }) {
  return (
    <section className="border-b border-neutral-100 bg-emerald-700 py-5 text-white sm:py-6">
      <div className="container mx-auto flex flex-col items-start justify-between gap-4 px-4 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex w-full items-start gap-3 sm:items-center lg:w-auto">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:h-11 sm:w-11">
            <CircleDollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold leading-snug sm:text-lg">Earn cash back at participating buy-back &amp; recycling centers.</div>
            <div className="mt-0.5 text-[12px] text-emerald-100 sm:mt-0 sm:text-[13px]">Upload your receipt. Earn rewards. Save more.</div>
          </div>
        </div>
        <Button onClick={onCtaClick} variant="secondary" className="h-11 w-full justify-center rounded-full bg-white text-emerald-700 hover:bg-emerald-50 sm:ml-auto sm:w-auto">
          Learn How It Works <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </section>
  )
}
