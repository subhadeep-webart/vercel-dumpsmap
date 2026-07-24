'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Heart, MessageCircle, Share2, MapPin, BadgeCheck, ChevronRight, Briefcase, AlertTriangle, ShoppingBag, Recycle, Megaphone, Gift, Users } from 'lucide-react'
import { timeAgo } from '@/lib/community-categories'

const CATEGORY_VISUAL = {
  hotspot: { icon: AlertTriangle, color: 'bg-red-100 text-red-700', label: 'Hot spot' },
  job: { icon: Briefcase, color: 'bg-amber-100 text-amber-800', label: 'Job / Pickup' },
  marketplace: { icon: ShoppingBag, color: 'bg-purple-100 text-purple-700', label: 'Marketplace' },
  free: { icon: Gift, color: 'bg-brand-100 text-brand-700', label: 'Free item' },
  facility: { icon: Recycle, color: 'bg-blue-100 text-blue-700', label: 'Facility alert' },
  community: { icon: Megaphone, color: 'bg-neutral-100 text-neutral-700', label: 'Community' },
  group: { icon: Users, color: 'bg-teal-100 text-teal-700', label: 'Group post' },
}

export default function FieldFeedCard({ post, onLike, onComment, onShare, onMessage, onClaim, onOpen }) {
  const vis = CATEGORY_VISUAL[post.category] || CATEGORY_VISUAL.community
  const Icon = vis.icon
  const photo = post.photo || post.photos?.[0]
  return (
    <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
          {post.author?.avatarUrl ? <img src={post.author.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" /> : (post.author?.name || '?')[0].toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm font-bold leading-tight">
            <span className="truncate">{post.author?.name || 'Someone'}</span>
            {post.author?.verificationLevel?.startsWith('verified') && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-neutral-500">
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${vis.color}`}>
              <Icon className="h-2.5 w-2.5" /> {vis.label}
            </span>
            {post.location && (<span className="inline-flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {post.location}</span>)}
            <span>· {timeAgo(post.createdAt)}</span>
          </div>
        </div>
        {onOpen && (
          <button onClick={() => onOpen(post)} className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-100" aria-label="Open">
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </header>
      <button onClick={() => onOpen?.(post)} className="block w-full text-left">
        <div className="px-3 pb-2">
          {post.title && <h3 className="text-sm font-semibold leading-snug text-neutral-900">{post.title}</h3>}
          {post.body && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-sm text-neutral-700">{post.body}</p>}
        </div>
        {photo && (
          <div className="aspect-[5/4] max-h-[420px] w-full bg-neutral-100">
            <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        )}
      </button>
      {/* Quick meta row */}
      {(post.payAmount || post.priceLabel || post.urgency) && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2 text-[11px]">
          {post.payAmount && <Badge className="bg-brand-100 text-brand-800">${post.payAmount}</Badge>}
          {post.priceLabel && <Badge className="bg-purple-100 text-purple-800">{post.priceLabel}</Badge>}
          {post.urgency && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">{post.urgency}</Badge>}
        </div>
      )}
      <footer className="flex items-center justify-between gap-1 border-t border-neutral-100 px-1 py-1">
        <div className="flex flex-1 items-center">
          <button onClick={() => onLike?.(post)} className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-xs text-neutral-600 hover:bg-neutral-50">
            <Heart className={`h-4 w-4 ${post.liked ? 'fill-red-500 text-red-500' : ''}`} />
            {post.likes > 0 && <span>{post.likes}</span>}
          </button>
          <button onClick={() => onComment?.(post)} className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-xs text-neutral-600 hover:bg-neutral-50">
            <MessageCircle className="h-4 w-4" />
            {post.comments > 0 && <span>{post.comments}</span>}
          </button>
          {onMessage && (
            <button onClick={() => onMessage(post)} className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-xs text-neutral-600 hover:bg-neutral-50">
              <MessageCircle className="h-4 w-4 text-blue-500" />
              <span>DM</span>
            </button>
          )}
          <button onClick={() => onShare?.(post)} className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-xs text-neutral-600 hover:bg-neutral-50">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
        {onClaim && (
          <button onClick={() => onClaim(post)} className="ml-2 shrink-0 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700">{post.claimCta || 'Claim'}</button>
        )}
      </footer>
    </article>
  )
}
