'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FOOTER_EXPLORE_LINKS, FOOTER_COMPANY_LINKS } from '@/constants/home_constants'

export default function HomeFooter({ onJoinBeta, onDonate }) {
  return (
    <footer id="support" className="bg-neutral-900 py-10 text-neutral-400">
      <div className="container mx-auto grid gap-8 px-4 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <img src="/dumpmaps-logo.png" alt="DumpMaps" className="h-9 w-9 rounded-md bg-white p-0.5 object-contain" />
            <div className="flex flex-col">
              <span className="text-lg font-extrabold text-white">Dump<span className="text-emerald-500">Maps</span></span>
              <span className="text-[10px] italic text-neutral-500">find · dump · recycle · reuse</span>
            </div>
          </div>
          <p className="mt-4 text-sm">
            Find the right recycling facility before you leave home.
          </p>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Explore</div>
          <ul className="mt-3 space-y-2 text-sm">
            {FOOTER_EXPLORE_LINKS.map((l) => (
              <li key={l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Company</div>
          <ul className="mt-3 space-y-2 text-sm">
            {FOOTER_COMPANY_LINKS.map((l) => (
              <li key={l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Get Started</div>
          <div className="mt-3 space-y-2">
            <Button onClick={onJoinBeta} className="h-10 w-full bg-emerald-600 hover:bg-emerald-700">Join Beta</Button>
            <Button onClick={onDonate} variant="outline" className="h-10 w-full border-neutral-700 bg-transparent text-white hover:text-white hover:bg-white/10">Donate</Button>
          </div>
        </div>
      </div>
      <div className="container mx-auto mt-10 border-t border-neutral-800 px-4 pt-6 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} DumpMaps · Built for a cleaner community.
      </div>
    </footer>
  )
}
