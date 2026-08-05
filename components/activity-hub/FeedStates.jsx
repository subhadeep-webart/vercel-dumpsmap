'use client'

// Empty + loading states for the Activity Hub feed.

import { Plus, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function EmptyState({ filter, onPost }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
          <MessageSquare className="h-6 w-6 text-neutral-400" />
        </div>
        <h3 className="text-base font-bold text-neutral-800">
          {filter === 'mine' ? "You haven't posted yet" : 'Nothing here yet'}
        </h3>
        <p className="text-sm text-neutral-600">
          {filter === 'mine'
            ? 'Your posts will show up here once you share something.'
            : <>Be the first to post in the <b>{filter}</b> feed.</>}
        </p>
        <Button onClick={onPost} className="bg-green-700 hover:bg-green-800">
          <Plus className="mr-1.5 h-4 w-4" /> Create a post
        </Button>
      </CardContent>
    </Card>
  )
}

export function FeedSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <Card key={i}><CardContent className="space-y-2 p-3">
          <div className="h-3 w-1/4 animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200" />
          <div className="h-40 animate-pulse rounded bg-neutral-100" />
        </CardContent></Card>
      ))}
    </>
  )
}
