'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Smartphone, Layers, Sparkles } from 'lucide-react'
import { useViewMode } from '@/lib/view-mode'

// Routes where Field/Standard onboarding does NOT apply because the page is a
// standalone, mode-agnostic experience (own header, own layout).
const STANDALONE_PREFIXES = ['/marketplace', '/jobs', '/donate', '/admin', '/inbox', '/settings']
const isStandaloneRoute = (path) => {
  if (!path) return false
  return STANDALONE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
}

/**
 * One-time onboarding modal on first mobile visit asking the user to choose between
 * Field Mode and Standard Mode. After the choice, fieldModeOnboarded is set both in
 * localStorage and (if logged in) the user record.
 *
 * Suppressed on standalone routes (Marketplace, Jobs, Donate, Admin) — those pages
 * have their own shell and don't switch between Field/Standard.
 */
export default function FieldOnboardingDialog() {
  const { showOnboarding, setViewMode, dismissOnboarding } = useViewMode()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const suppressed = isStandaloneRoute(pathname)

  useEffect(() => { setOpen(showOnboarding && !suppressed) }, [showOnboarding, suppressed])

  const pick = (mode) => {
    setViewMode(mode, { markOnboarded: true })
    setOpen(false)
  }
  const dismiss = () => {
    dismissOnboarding()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-sm rounded-t-2xl p-0 sm:rounded-2xl">
        <div className="rounded-t-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">New · Mobile-first</span>
          </div>
          <DialogTitle className="mt-1 text-xl font-extrabold tracking-tight text-white">Try Field Mode?</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-brand-50">
            A cleaner mobile experience for posting, jobs, alerts, and nearby activity.
            Big buttons, fast posts, bottom navigation.
          </DialogDescription>
        </div>
        <div className="space-y-2 p-4">
          <button
            onClick={() => pick('field')}
            className="flex w-full items-start gap-3 rounded-xl border border-brand-300 bg-brand-50 p-3 text-left transition active:scale-[0.99]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-brand-900">Field Mode (recommended)</div>
              <p className="mt-0.5 text-[11px] text-brand-800">Big touch targets · Quick post · Bottom nav · Focused for haulers, contractors & residents on the go.</p>
            </div>
          </button>
          <button
            onClick={() => pick('standard')}
            className="flex w-full items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left transition active:scale-[0.99]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-neutral-900">Standard Mode</div>
              <p className="mt-0.5 text-[11px] text-neutral-500">Full desktop-style experience with every filter, list and admin tool. Best on tablets.</p>
            </div>
          </button>
        </div>
        <DialogFooter className="px-4 pb-4">
          <Button variant="ghost" onClick={dismiss} className="text-neutral-500">Decide later</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
