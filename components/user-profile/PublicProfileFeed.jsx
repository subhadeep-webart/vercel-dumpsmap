'use client'

// Feed tabs for the public profile: Posts (community) and Listings (B2B
// marketplace) are data-backed and lazily loaded; Reviews is a themed stub for
// now. Cards link out to the existing detail routes. Loading/empty states keep
// the page from looking broken while a tab's first request is in flight.

import React from 'react'
import Link from 'next/link'
import SafeImage from '@/components/SafeImage'
import { formatPrice } from '@/components/user-profile/public-profile-helpers'
import { usePublicProfileFeed } from '@/hooks/use-public-profile'
import { Heart, MessageCircle, MapPin, Star, Newspaper, Store, Loader2 } from 'lucide-react'

// ---- shared shells ----------------------------------------------------------

function FeedLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-400">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  )
}

function EmptyState({ icon: Icon, title, detail }) {
  return (
    <div className="dm-rise-in rounded-2xl border border-dashed border-neutral-200 bg-white py-14 text-center">
      <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-sm font-semibold text-neutral-700">{title}</div>
      <div className="mt-1 text-xs text-neutral-400">{detail}</div>
    </div>
  )
}

// ---- Posts ------------------------------------------------------------------

function PostCard({ post, index }) {
  return (
    <Link
      href={post.href}
      style={{ '--dm-i': index }}
      className="dm-rise-in group block overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg hover:shadow-neutral-900/5"
    >
      <div className="flex gap-3 p-4">
        {post.photos?.[0] && (
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg">
            <SafeImage src={post.photos[0]} alt="" kind="post" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {post.title && <div className="truncate text-sm font-bold text-neutral-900">{post.title}</div>}
          {post.body && <p className="mt-0.5 line-clamp-2 text-sm text-neutral-600">{post.body}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 font-medium capitalize text-neutral-600">
              {(post.category || 'general').replace(/_/g, ' ')}
            </span>
            <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {post.likes}</span>
            <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {post.comments}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function PostsTab({ id, enabled, name }) {
  const { items, loading } = usePublicProfileFeed(id, 'posts', enabled)
  if (loading) return <FeedLoading />
  if (!items.length) return <EmptyState icon={Newspaper} title="No posts yet" detail={`${name || 'This member'} hasn't shared anything in the community.`} />
  return <div className="space-y-3">{items.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}</div>
}

// ---- Listings ---------------------------------------------------------------

function ListingCard({ listing, index }) {
  const price = formatPrice(listing.price)
  const location = [listing.city, listing.state].filter(Boolean).join(', ')
  return (
    <Link
      href={listing.href}
      style={{ '--dm-i': index }}
      className="dm-rise-in group block overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg hover:shadow-neutral-900/5"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-100">
        <SafeImage src={listing.photo} alt={listing.title} kind="listing" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-bold text-neutral-900">{listing.title}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          {price && <span className="text-sm font-extrabold text-green-700">{price}</span>}
          {listing.condition && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{listing.condition.replace(/_/g, ' ')}</span>}
        </div>
        {location && <div className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-400"><MapPin className="h-3 w-3" /> {location}</div>}
      </div>
    </Link>
  )
}

function ListingsTab({ id, enabled, name }) {
  const { items, loading } = usePublicProfileFeed(id, 'listings', enabled)
  if (loading) return <FeedLoading />
  if (!items.length) return <EmptyState icon={Store} title="No listings yet" detail={`${name || 'This member'} has no active marketplace listings.`} />
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}</div>
}

// ---- Reviews (stub) ---------------------------------------------------------

function ReviewsTab() {
  return <EmptyState icon={Star} title="Reviews coming soon" detail="Ratings and reviews for members will appear here." />
}

// ---- dispatcher -------------------------------------------------------------

export default function PublicProfileFeed({ activeTab, id, name, loadedTabs }) {
  switch (activeTab) {
    case 'posts':
      return <PostsTab id={id} name={name} enabled={loadedTabs.has('posts')} />
    case 'listings':
      return <ListingsTab id={id} name={name} enabled={loadedTabs.has('listings')} />
    case 'reviews':
      return <ReviewsTab />
    default:
      return null
  }
}
