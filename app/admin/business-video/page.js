'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PlayCircle, Video } from 'lucide-react'
import MediaUploader from '@/components/MediaUploader'

// CMS: manages ONLY the "Request a Demo" video shown in the Business page banner.
// Backed by the platform_settings singleton (businessVideo key).
export default function AdminBusinessVideo() {
  const { authFetch } = useAdmin()
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const r = await authFetch('/api/admin/platform-settings')
    const j = await r.json()
    setS(j.settings)
  }
  useEffect(() => { load() }, [])

  // Persist a partial patch of the businessVideo object.
  const saveVideo = async (patch) => {
    setSaving(true)
    const next = { ...(s?.businessVideo || {}), ...patch }
    const r = await authFetch('/api/admin/platform-settings', { method: 'PATCH', body: JSON.stringify({ businessVideo: next }) })
    const j = await r.json()
    setS(j.settings); setSaving(false)
    toast.success('Saved')
  }

  if (!s) return <div className="p-6 text-sm text-neutral-500">Loading…</div>

  const v = s.businessVideo || {}

  return (
    <div className="mx-auto max-w-3xl space-y-4 overflow-y-auto p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Video className="h-6 w-6 text-emerald-600" /> Business Page Video
        </h1>
        <p className="text-sm text-neutral-500">
          The “Request a Demo” video shown in the banner of the public <span className="font-medium">Business</span> page.
          Upload a video file or paste a YouTube / Vimeo / MP4 link.
        </p>
      </div>

      {/* Show / hide on the site */}
      <Card className={v.enabled ? 'border-emerald-300 bg-emerald-50/40' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PlayCircle className={`h-4 w-4 ${v.enabled ? 'text-emerald-600' : 'text-neutral-400'}`} />
            Show video on Business page
            {v.enabled && <Badge variant="outline" className="border-emerald-400 bg-emerald-100 text-emerald-800">LIVE</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Display in the banner</div>
              <div className="text-xs text-neutral-500">When off, the default banner image is shown instead.</div>
            </div>
            <Switch checked={!!v.enabled} onCheckedChange={(val) => saveVideo({ enabled: val })} disabled={saving} />
          </div>
        </CardContent>
      </Card>

      {/* Video source */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Video</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 text-xs font-semibold text-neutral-600">Video URL</div>
            <Input
              value={v.videoUrl || ''}
              onChange={(e) => setS({ ...s, businessVideo: { ...v, videoUrl: e.target.value } })}
              onBlur={(e) => saveVideo({ videoUrl: e.target.value.trim() })}
              placeholder="https://youtu.be/… or https://…/video.mp4"
            />
            <p className="mt-1 text-[11px] text-neutral-500">
              Paste a YouTube, Vimeo, or direct <code>.mp4</code> link — or upload a file below.
            </p>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-neutral-600">Upload a video file</div>
            {/* Uploader is an upload control only — value stays empty so it
                doesn't try to render the video as an image. The URL field above
                and the Preview below reflect the current video. */}
            <MediaUploader
              variant="tile"
              accept="video/*"
              value=""
              showRemove={false}
              onChange={(url) => saveVideo({ videoUrl: url })}
              label="Upload video (MP4/WebM, max 64MB)"
              helpText="Drag & drop or click to choose"
            />
          </div>

          {v.videoUrl && (
            <div>
              <div className="mb-1 text-xs font-semibold text-neutral-600">Preview</div>
              <VideoPreview url={v.videoUrl} poster={v.posterUrl} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Poster + text */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Poster & text <span className="text-xs font-normal text-neutral-500">(optional)</span></CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 text-xs font-semibold text-neutral-600">Poster image (shown before play)</div>
            <MediaUploader
              variant="cover"
              value={v.posterUrl || ''}
              onChange={(url) => saveVideo({ posterUrl: url })}
              className="rounded-xl border border-neutral-200"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-neutral-600">Title</div>
            <Input
              value={v.title || ''}
              onChange={(e) => setS({ ...s, businessVideo: { ...v, title: e.target.value } })}
              onBlur={(e) => saveVideo({ title: e.target.value })}
              placeholder="See how it works"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-neutral-600">Subtitle</div>
            <Input
              value={v.subtitle || ''}
              onChange={(e) => setS({ ...s, businessVideo: { ...v, subtitle: e.target.value } })}
              onBlur={(e) => saveVideo({ subtitle: e.target.value })}
              placeholder="A 60-second overview for partners"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Small preview that handles both YouTube/Vimeo embeds and direct video files.
function VideoPreview({ url, poster }) {
  const embed = toEmbedUrl(url)
  if (embed) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-neutral-200 bg-black">
        <iframe src={embed} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Video preview" />
      </div>
    )
  }
  return (
    <video src={url} poster={poster || undefined} controls className="aspect-video w-full rounded-xl border border-neutral-200 bg-black" />
  )
}

// Convert a YouTube/Vimeo watch URL to its embeddable form. Returns null for
// direct file URLs (mp4/webm/etc.), which should use a <video> tag instead.
export function toEmbedUrl(url) {
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
