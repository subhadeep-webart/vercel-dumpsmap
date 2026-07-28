'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare, Calendar, Mail, Building2, ClipboardList, Map as MapIcon,
  Bell, BarChart3, MapPin, Construction, Route,
} from 'lucide-react'

const PHASE_FEATURES = {
  community_board: { phase: 2, title: 'Community Board', desc: 'Categorized DumpMaps-wide posts: Contractor Updates, Recycling Tips, Donation Needs, Closures, Route Help, and more.', icon: MessageSquare },
  events: { phase: 2, title: 'Event Board', desc: 'Upcoming e-waste drives, donation drives, free dump days, recycling events, community cleanups, contractor meetups.', icon: Calendar },
  messaging: { phase: 2, title: 'Direct Messaging', desc: 'Message other haulers, contractors, recyclers, and facility owners.', icon: Mail },
  owner_claim: { phase: 2, title: 'Facility Owner Claims', desc: 'Claim your facility, post official updates, manage hours and accepted materials.', icon: Building2 },
  facility_board: { phase: 2, title: 'Facility Comment Board', desc: 'Persistent discussion threads on each facility for sharing tips and history.', icon: ClipboardList },
  saved_routes: { phase: 3, title: 'Saved Routes', desc: 'Save common dump-route stops and reuse them across jobs.', icon: MapIcon },
  notifications: { phase: 3, title: 'Advanced Notifications', desc: 'Push alerts when watched facilities post new updates or wait times spike.', icon: Bell },
  analytics: { phase: 3, title: 'Facility Analytics', desc: 'Trends, busiest hours, average waits, top materials.', icon: BarChart3 },
  route_planner: { phase: 3, title: 'Contractor Route Planner', desc: 'Multi-stop route optimization across facilities by material and capacity.', icon: MapPin },
}

export function PhaseTeaserDialog({ open, onOpenChange, featureKey = 'community_board' }) {
  const f = PHASE_FEATURES[featureKey] || PHASE_FEATURES.community_board
  const accent = f.phase === 2 ? 'sky' : 'purple'
  const FeatureIcon = f.icon
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {FeatureIcon && <FeatureIcon className="h-6 w-6" />}
            {f.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Badge className={`inline-flex items-center gap-1 bg-${accent}-100 text-${accent}-900 hover:bg-${accent}-100`}>
            {f.phase === 2
              ? <><Construction className="h-3 w-3" /> Coming in Phase 2</>
              : <><Route className="h-3 w-3" /> Coming in Phase 3</>}
          </Badge>
          <p className="text-sm text-neutral-700">{f.desc}</p>
          <div className="rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 p-4 text-center text-xs text-neutral-500">
            We&apos;re shipping Phase 1 first to keep the pilot focused. This feature is in the roadmap — coming soon!
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export const PHASE2_FEATURES = ['community_board', 'events', 'messaging', 'owner_claim', 'facility_board']
export const PHASE3_FEATURES = ['saved_routes', 'notifications', 'analytics', 'route_planner']
