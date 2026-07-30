'use client'

// Renders the CMS-managed "Request a Demo" video in the Business page banner.
// Handles YouTube/Vimeo embeds and direct video files, with an optional poster
// that reveals the player on click.
//
// For uploaded/direct video files we render our OWN minimal controls — only a
// play/pause button and a mute button — instead of the browser's full control
// bar (which also exposes a seek bar, fullscreen, and a download menu). No
// title/subtitle caption is shown.

import { useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
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

// Strip as much of the embed chrome as each provider allows. The full control
// bar can't be removed on third-party embeds, but these params minimize it.
function minimalEmbed(embed, { autoplay } = {}) {
  if (!embed) return embed
  const sep = embed.includes('?') ? '&' : '?'
  const isYouTube = embed.includes('youtube.com')
  const params = isYouTube
    ? `controls=1&modestbranding=1&rel=0&fs=0&disablekb=1${autoplay ? '&autoplay=1' : ''}`
    : `title=0&byline=0&portrait=0${autoplay ? '&autoplay=1' : ''}`
  return `${embed}${sep}${params}`
}

// Direct video file (mp4/webm) with a custom two-button control overlay.
function DirectVideo({ video, autoPlay }) {
  const ref = useRef(null)
  const [isPlaying, setIsPlaying] = useState(!!autoPlay)
  const [isMuted, setIsMuted] = useState(false)

  const togglePlay = () => {
    const el = ref.current
    if (!el) return
    if (el.paused) el.play()
    else el.pause()
  }

  const toggleMute = () => {
    const el = ref.current
    if (!el) return
    el.muted = !el.muted
    setIsMuted(el.muted)
  }

  return (
    <>
      <video
        ref={ref}
        src={video.videoUrl}
        poster={video.posterUrl || undefined}
        autoPlay={autoPlay}
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
        onContextMenu={(e) => e.preventDefault()}
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        className="absolute inset-0 h-full w-full bg-black object-cover"
      />
      {/* Minimal controls: play/pause + mute only, themed to match emerald. */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/90 text-white shadow-lg shadow-emerald-900/30 ring-1 ring-white/30 backdrop-blur transition hover:scale-105 hover:bg-emerald-500"
        >
          {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="ml-0.5 h-5 w-5 fill-white" />}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/90 text-white shadow-lg shadow-emerald-900/30 ring-1 ring-white/30 backdrop-blur transition hover:scale-105 hover:bg-emerald-500"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>
    </>
  )
}

export default function BusinessHeroVideo({ video }) {
  const [playing, setPlaying] = useState(false)
  if (!video?.enabled || !video?.videoUrl) return null

  const embed = toEmbedUrl(video.videoUrl)
  const hasPoster = !!video.posterUrl

  return (
    <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-black shadow-2xl shadow-emerald-100">
      {/* Soft, slow emerald glow on the play button — a quiet breathe, not a
          radar ping. Pauses on hover so the interaction feels deliberate. */}
      <style jsx>{`
        /* Layered shadows give the button real depth (raised 3D feel):
           - a top inner highlight + bottom inner shade sculpt the disc,
           - a tight contact shadow anchors it,
           - a soft drop shadow lifts it off the poster,
           - the animated ring is the slow emerald glow. */
        .dm-play-btn {
          box-shadow: inset 0 2px 3px rgba(255, 255, 255, 0.45),
            inset 0 -3px 5px rgba(0, 0, 0, 0.28),
            0 3px 6px rgba(6, 78, 59, 0.35), 0 10px 22px rgba(6, 78, 59, 0.35),
            0 0 0 0 rgba(16, 185, 129, 0.45);
          animation: dm-play-glow 2.8s ease-in-out infinite;
        }
        .group:hover .dm-play-btn {
          animation-play-state: paused;
          box-shadow: inset 0 2px 3px rgba(255, 255, 255, 0.5),
            inset 0 -3px 6px rgba(0, 0, 0, 0.3),
            0 6px 10px rgba(6, 78, 59, 0.4), 0 16px 34px rgba(6, 78, 59, 0.42);
        }
        .group:active .dm-play-btn {
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.35),
            inset 0 -1px 2px rgba(255, 255, 255, 0.25),
            0 2px 5px rgba(6, 78, 59, 0.3);
        }
        @keyframes dm-play-glow {
          0%,
          100% {
            box-shadow: inset 0 2px 3px rgba(255, 255, 255, 0.45),
              inset 0 -3px 5px rgba(0, 0, 0, 0.28),
              0 3px 6px rgba(6, 78, 59, 0.35), 0 10px 22px rgba(6, 78, 59, 0.35),
              0 0 0 0 rgba(16, 185, 129, 0.4);
          }
          50% {
            box-shadow: inset 0 2px 3px rgba(255, 255, 255, 0.45),
              inset 0 -3px 5px rgba(0, 0, 0, 0.28),
              0 3px 6px rgba(6, 78, 59, 0.35), 0 10px 22px rgba(6, 78, 59, 0.35),
              0 0 0 12px rgba(16, 185, 129, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .dm-play-btn {
            animation: none;
          }
        }
      `}</style>
      <div className="relative aspect-video w-full">
        {/* Poster / play gate — shown until the visitor starts playback. */}
        {hasPoster && !playing ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 h-full w-full"
            aria-label="Play video"
          >
            <SafeImage src={video.posterUrl} alt="Request a Demo" className="h-full w-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent transition group-hover:from-black/50" />
            <span className="absolute inset-0 flex items-center justify-center">
              {/* Frosted emerald play button with a soft, slow glow (no radar ping). */}
              <span
                className="dm-play-btn flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-emerald-400 via-emerald-600 to-emerald-700 text-white ring-1 ring-white/40 transition-transform duration-300 ease-out group-hover:scale-110 group-active:scale-95"
              >
                <Play className="ml-1 h-7 w-7 fill-white text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]" />
              </span>
            </span>
          </button>
        ) : embed ? (
          <iframe
            src={minimalEmbed(embed, { autoplay: playing })}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title="Request a Demo"
          />
        ) : (
          <DirectVideo video={video} autoPlay={playing} />
        )}
      </div>
    </div>
  )
}
