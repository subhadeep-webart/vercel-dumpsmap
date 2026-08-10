'use client'

// Action button row under the hero — Facebook-mobile style. For a visitor:
// Message (real DM flow via StartDmButton) + Share. For the owner viewing their
// own page: Edit profile (→ /profile) + Share. Buttons are full-width on mobile
// and inline on desktop, matching FB's prominent primary-action bar.

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useShare } from '@/hooks/use-share'
import StartDmButton from '@/components/messaging/StartDmButton'
import { Pencil, Share2 } from 'lucide-react'

export default function PublicProfileActions({ user, isOwner }) {
  const share = useShare()

  const onShare = () =>
    share({ title: user.name, text: `Check out ${user.name} on DumpMaps` })

  return (
    <div className="pf-fade-up container mx-auto px-4 pb-4 pt-1" style={{ '--pf-i': 5 }}>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        {isOwner ? (
          <Button asChild className="w-full bg-green-600 shadow-sm shadow-green-600/25 hover:bg-green-700 sm:w-auto">
            <Link href="/profile"><Pencil className="mr-1.5 h-4 w-4" /> Edit profile</Link>
          </Button>
        ) : (
          <StartDmButton
            targetUserId={user.id}
            targetUserName={user.name}
            label="Message"
            className="w-full bg-green-600 shadow-sm shadow-green-600/25 hover:bg-green-700 sm:w-auto"
          />
        )}

        <Button
          onClick={onShare}
          variant="outline"
          className="w-full border-neutral-300 sm:w-auto"
        >
          <Share2 className="mr-1.5 h-4 w-4" /> Share
        </Button>
      </div>
    </div>
  )
}
