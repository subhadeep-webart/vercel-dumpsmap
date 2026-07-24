'use client'

// Jobs tab — mode switcher (All / Hot Spots / Mine / Accepted / Saved) over
// the shared JobFeed. Extracted from HomeShell.jsx.

import { useState } from 'react'
import {
  Briefcase,
  Flame,
  User as UserIcon,
  Truck,
  Heart,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { JobFeed } from '@/components/Jobs'

const JOB_MODES = [
  { v: 'feed', label: 'All jobs', icon: Briefcase },
  { v: 'hotspots', label: 'Hot Spots', icon: Flame },
  { v: 'mine', label: 'My posts', icon: UserIcon },
  { v: 'accepted', label: 'Accepted', icon: Truck },
  { v: 'saved', label: 'Saved', icon: Heart },
]

export default function JobsTab({ user, onLogin, onPostJob, onJobsDialog }) {
  const [mode, setMode] = useState('feed')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <Briefcase className="h-4 w-4 text-brand-600" /> Jobs &amp; Hot Spots
          </div>
          <div className="text-xs text-neutral-500">Verified posters · contractor matching · pilot mode active</div>
        </div>
        <Button onClick={onPostJob} className="bg-brand-600 hover:bg-brand-700" size="sm">
          <Plus className="mr-1 h-4 w-4" /> Post job
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {JOB_MODES.map((t) => (
          <button
            key={t.v}
            onClick={() => setMode(t.v)}
            className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              mode === t.v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-neutral-600'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>
      {(mode === 'mine' || mode === 'accepted' || mode === 'saved') && !user ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Log in to see your jobs.
          <div className="mt-3"><Button onClick={onLogin} className="bg-brand-600 hover:bg-brand-700">Log in</Button></div>
        </div>
      ) : (
        <JobFeed user={user} mode={mode} onOpen={(id) => onJobsDialog?.('feed', id)} />
      )}
    </div>
  )
}
