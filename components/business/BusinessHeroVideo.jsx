'use client'

// Renders the CMS-managed "How it works" video in the Business page banner.
// Handles YouTube/Vimeo embeds and direct video files, with an optional poster
// that reveals the player on click.

import { useState } from 'react'
import { PlayCircle } from 'lucide-react'
import SafeImage from '@/components/SafeImage'

// Convert a YouTube/Vimeo watch URL to its embeddable form. Returns null for
// direct file URLs (mp4/webm/etc.), which use a <video> tag instead.
function toEmbedUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1)
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v')
        return id ? `https://www.youtube.com/embed/${id}` : null
      }
      if (u.pathname.startsWith('/embed/')) return url
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2]
        return id ? `https://www.youtube.com/embed/${id}` : null
      }
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
    if (host === 'player.vimeo.com') return url
  } catch {
    return null
  }
  return null
}

export default function BusinessHeroVideo({ video }) {
  const [playing, setPlaying] = useState(false)
  if (!video?.enabled || !video?.videoUrl) return null

  const embed = toEmbedUrl(video.videoUrl)
  const hasPoster = !!video.posterUrl

  return (
    <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-black shadow-2xl shadow-emerald-100">
      <div className="relative aspect-video w-full">
        {/* Poster / play gate — shown until the visitor starts playback. */}
        {hasPoster && !playing ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 h-full w-full"
            aria-label={video.title || 'Play video'}
          >
            <SafeImage src={video.posterUrl} alt={video.title || 'How it works'} className="h-full w-full object-cover" />
            <span className="absolute inset-0 bg-black/25 transition group-hover:bg-black/35" />
            <span className="absolute inset-0 flex items-center justify-center">
              <PlayCircle className="h-16 w-16 text-white drop-shadow-lg transition group-hover:scale-110" />
            </span>
          </button>
        ) : embed ? (
          <iframe
            src={playing ? `${embed}${embed.includes('?') ? '&' : '?'}autoplay=1` : embed}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={video.title || 'How it works'}
          />
        ) : (
          <video
            src={video.videoUrl}
            poster={video.posterUrl || undefined}
            controls
            autoPlay={playing}
            playsInline
            className="absolute inset-0 h-full w-full bg-black object-cover"
          />
        )}
      </div>

      {(video.title || video.subtitle) && (
        <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/95 p-4 shadow-lg backdrop-blur">
          {video.title && <div className="text-sm font-bold text-neutral-900">{video.title}</div>}
          {video.subtitle && <div className="text-[11px] text-neutral-500">{video.subtitle}</div>}
        </div>
      )}
    </div>
  )
}
