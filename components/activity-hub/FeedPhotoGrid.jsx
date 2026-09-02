'use client'

// FeedPhotoGrid — the photo strip on an Activity Hub feed card.
//
// Shows up to three photos side by side. A fourth and beyond collapse into a
// "+N" overlay on the last visible tile, so a post with ten photos still costs
// exactly one row of feed height.
//
// Layout notes:
//   • One photo  → a single wide 16:9 tile (a lone square would look stranded).
//   • Two/three  → equal columns, each a 1:1 tile.
//   • Each tile uses a padding-based aspect box (pb-[%]) rather than
//     `aspect-ratio`. An aspect-ratio box whose only child is position:absolute
//     collapses to zero height on mobile Safari / Android WebView, hiding the
//     image — the padding spacer reserves the height everywhere.

import Link from 'next/link'
import SafeImage from '@/components/SafeImage'

const MAX_VISIBLE = 3

export default function FeedPhotoGrid({ photos, href, alt = '' }) {
  const list = Array.isArray(photos) ? photos.filter(Boolean) : []
  if (list.length === 0) return null

  const visible = list.slice(0, MAX_VISIBLE)
  const overflow = list.length - visible.length
  const single = visible.length === 1

  return (
    <div className={`grid gap-2 ${single ? 'grid-cols-1' : visible.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {visible.map((src, i) => {
        const isLast = i === visible.length - 1
        return (
          <Tile
            key={`${src}-${i}`}
            src={src}
            href={href}
            alt={alt}
            // 16:9 for a lone photo, square when they sit side by side.
            padding={single ? 'pb-[56.25%]' : 'pb-[100%]'}
            overflow={isLast && overflow > 0 ? overflow : 0}
          />
        )
      })}
    </div>
  )
}

function Tile({ src, href, alt, padding, overflow }) {
  const inner = (
    <div className={`relative w-full overflow-hidden rounded-xl bg-neutral-100 ${padding}`}>
      <SafeImage src={src} alt={alt} kind="post" className="absolute inset-0 h-full w-full object-cover" />
      {overflow > 0 && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[22px] font-semibold text-white">
          +{overflow}
        </span>
      )}
    </div>
  )
  return href ? <Link href={href} className="block">{inner}</Link> : inner
}
