'use client'

// Reviews tab — rating summary header, write-a-review CTA, and the review list
// (or an empty state). Extracted from app/facilities/[id]/page.js.

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Star } from 'lucide-react'

export default function ReviewsTab({ facility, reviews }) {
  const list = Array.isArray(reviews) ? reviews : []
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl font-extrabold text-neutral-900">
              {facility.rating > 0 ? Number(facility.rating).toFixed(1) : '—'}
            </div>
            <div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-4 w-4 ${n <= Math.round(facility.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}`} />
                ))}
              </div>
              <div className="text-xs text-neutral-500">{facility.reviewCount || list.length || 0} reviews</div>
            </div>
          </div>
          <Button variant="outline">
            <Star className="mr-1.5 h-4 w-4" /> Write a review
          </Button>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <Star className="h-6 w-6 text-neutral-400" />
            </div>
            <h3 className="text-base font-bold text-neutral-800">No reviews yet</h3>
            <p className="text-sm text-neutral-600">Be the first to share your experience.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <Card key={r.id || r._id}>
              <CardContent className="space-y-1.5 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800">
                    {(r.authorName || r.userName || 'A').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="text-sm font-semibold text-neutral-900">{r.authorName || r.userName || 'Anonymous'}</div>
                  <div className="ml-auto flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-3.5 w-3.5 ${n <= (r.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}`} />
                    ))}
                  </div>
                </div>
                {r.text && <p className="text-sm text-neutral-700">{r.text}</p>}
                <div className="text-[10px] text-neutral-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
