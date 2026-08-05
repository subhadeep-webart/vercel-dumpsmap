'use client'

// ComposerPrompt — the "Share an update…" card at the top of the feed that
// opens the composer. Purely presentational; the click handler is passed in.

import { Sparkles, Camera, Video, AlertTriangle, Briefcase, CircleDollarSign } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const QUICK_ICONS = [
  { Icon: Camera,          tone: 'bg-sky-100 text-sky-600' },
  { Icon: Video,           tone: 'bg-purple-100 text-purple-600' },
  { Icon: AlertTriangle,   tone: 'bg-red-100 text-red-600' },
  { Icon: Briefcase,       tone: 'bg-blue-100 text-blue-600' },
  { Icon: CircleDollarSign, tone: 'bg-green-100 text-green-600' },
]

export default function ComposerPrompt({ user, onOpen }) {
  return (
    <Card className="mb-4 cursor-pointer transition hover:border-green-300" onClick={onOpen}>
      <CardContent className="flex items-center gap-3 p-3">
        <div className="flex w-7 h-7 md:h-9 md:w-9 items-center justify-center rounded-full bg-green-600 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 text-sm text-neutral-500">{user ? 'Share an update…' : 'Sign in to share an update…'}</div>
        <div className="flex gap-1.5">
          {QUICK_ICONS.map(({ Icon, tone }, i) => (
            <span key={i} className={`hidden h-7 w-7 items-center justify-center rounded-full sm:inline-flex ${tone}`}><Icon className="h-3.5 w-3.5" /></span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
