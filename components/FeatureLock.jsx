'use client'

// FeatureLock
// ---------------------------------------------------------------------------
// Phase D — Visual "locked" wrapper for features gated by canAccessFeature().
//
// Renders the gated children if allowed=true. Otherwise renders a friendly
// lock state that explains WHY the user is locked out and offers the
// appropriate CTA:
//
//   • status=demo + non-admin       → "Coming soon"
//   • status=not_active             → "Coming soon"
//   • status=paused                 → "Temporarily paused"
//   • status=beta, no grant         → "Apply for early access" → mailto:
//   • status=live, role/tier issue  → "Upgrade your membership" → /memberships
//   • status=live, grant revoked    → "Access revoked — contact support"
//   • status=live, grant expired    → "Trial expired — upgrade or contact admin"
//
// Always shows feature name + status badge. Used inline on /time-clock,
// marketplace B2B tab, etc.
//
// Usage:
//   <FeatureLock featureKey="timeClock"><TimeClockPage /></FeatureLock>

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFeatureAccess } from '@/lib/useFeatureAccess'
import { startProgress, stopProgress } from '@/lib/top-progress'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Lock, Sparkles, Pause, Hourglass, Crown, ShieldOff, ArrowRight, Mail,
} from 'lucide-react'

const SUPPORT_EMAIL = 'jamal@dumpmaps.org'

function buildMailto(featureName) {
  const subject = `DumpMaps — Request access to ${featureName}`
  const body = `Hi DumpMaps team,\n\nI would like access to ${featureName}.\n\n— My account email:\n— Why I need it:\n\nThanks!`
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export default function FeatureLock({ featureKey, children, fallback }) {
  const { loading, allowed, status, lockedState, requiresUpgrade, requiresApply, isExpired, feature, grant } = useFeatureAccess(featureKey)

  // While the access check is in flight, drive the global top progress bar
  // instead of blanking the page with a "Checking access…" spinner. The bar is
  // a far lighter, more polished cue and keeps the header/chrome in place.
  // Keyed per feature + ref-counted so overlapping checks don't cut each other
  // short, and always released on unmount.
  useEffect(() => {
    const key = `feature-access:${featureKey}`
    if (loading) startProgress(key)
    else stopProgress(key)
    return () => stopProgress(key)
  }, [loading, featureKey])

  // Don't render gated content until we know access. Prefer an explicit
  // fallback if the caller supplied one; otherwise render nothing (the top bar
  // communicates the pending check) to avoid a flash of the wrong UI.
  if (loading) return fallback ?? null

  if (allowed) return children

  return <LockedScreen feature={feature} featureKey={featureKey} status={status} lockedState={lockedState} requiresUpgrade={requiresUpgrade} requiresApply={requiresApply} isExpired={isExpired} grant={grant} />
}

function LockedScreen({ feature, featureKey, status, lockedState, requiresUpgrade, requiresApply, isExpired, grant }) {
  const router = useRouter()
  const name = feature?.name || featureKey

  // Map status/lockedState to display variant
  const variant = (() => {
    if (status === 'demo' || status === 'not_active' || lockedState === 'hidden') {
      return { tone: 'neutral', icon: Sparkles, title: 'Coming soon', detail: `${name} isn't open to users yet. Our team is finalising the rollout.` }
    }
    if (status === 'paused' || lockedState === 'paused') {
      return { tone: 'amber', icon: Pause, title: 'Temporarily paused', detail: `${name} is paused while we make improvements. Existing data is preserved.` }
    }
    if (isExpired) {
      return { tone: 'red', icon: Hourglass, title: 'Trial expired', detail: `Your trial for ${name} has ended. Convert to a paid plan or contact support to renew.` }
    }
    if (lockedState === 'upgrade' || requiresUpgrade) {
      return { tone: 'violet', icon: Crown, title: 'Upgrade required', detail: `${name} is available on a higher membership tier. Upgrade your plan to unlock.` }
    }
    if (lockedState === 'apply' || requiresApply) {
      return { tone: 'brand', icon: Mail, title: 'Apply for access', detail: `${name} is available to approved accounts only. Apply for access and our team will review your request.` }
    }
    if (lockedState === 'revoked' || grant?.status === 'revoked') {
      return { tone: 'red', icon: ShieldOff, title: 'Access revoked', detail: `Your access to ${name} has been revoked by an administrator. Contact support if you believe this is in error.` }
    }
    if (lockedState === 'auth') {
      return { tone: 'brand', icon: Lock, title: 'Sign in required', detail: `Sign in to your DumpMaps account to use ${name}.` }
    }
    return { tone: 'neutral', icon: Lock, title: 'Locked', detail: `${name} isn't available on your account right now.` }
  })()

  const toneCls = {
    neutral: 'from-neutral-50 to-white ring-neutral-200 text-neutral-700',
    amber:   'from-amber-50 to-white ring-amber-200 text-amber-800',
    red:     'from-red-50 to-white ring-red-200 text-red-800',
    violet:  'from-violet-50 to-white ring-violet-200 text-violet-800',
    brand:   'from-brand-50 to-white ring-brand-200 text-brand-800',
  }[variant.tone]

  const Icon = variant.icon

  return (
    <div className="container mx-auto px-4 py-10 sm:py-14">
      <Card className={`mx-auto max-w-2xl bg-gradient-to-br ring-1 ${toneCls}`}>
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <Icon className="h-6 w-6" />
          </div>
          <div className="text-xs font-bold uppercase tracking-wider opacity-70">DumpMaps · {feature?.category || 'feature'}</div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">{variant.title}</h1>
          <p className="mt-2 max-w-md text-sm text-neutral-600 sm:mx-auto">{variant.detail}</p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {variant.tone === 'violet' && (
              <Button onClick={() => router.push('/memberships')} className="gap-1">
                <Crown className="h-4 w-4" /> View memberships <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {(variant.tone === 'brand' || variant.tone === 'red') && lockedState !== 'auth' && (
              <Button onClick={() => { if (typeof window !== 'undefined') window.location.href = buildMailto(name) }} className="gap-1">
                <Mail className="h-4 w-4" /> Contact support
              </Button>
            )}
            {lockedState === 'auth' && (
              <Button onClick={() => router.push('/?login=1')} className="gap-1">
                <Lock className="h-4 w-4" /> Sign in
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push('/dashboard')}>Back to dashboard</Button>
          </div>

          {feature && (
            <div className="mt-6 inline-flex items-center gap-2 text-[11px] font-mono text-neutral-500">
              <Link href="/" className="hover:underline">DumpMaps</Link>
              <span>·</span>
              <span>feature: {feature.key}</span>
              <span>·</span>
              <span>status: {status}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
