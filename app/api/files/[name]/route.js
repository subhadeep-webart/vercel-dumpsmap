// Serves persisted uploads from /data/uploads/<name>.
//
// Why a dedicated route?
//   • /public/uploads is wiped on every container rebuild in production
//   • Next.js dev server doesn't always pick up newly written /public/ files
//     without a restart
//   • /data/* is mounted as a persistent volume in this environment
//
// This route streams the file from disk on every request (no build-time
// inclusion needed). It also falls back to /public/uploads/<name> so legacy
// listings that still reference `/uploads/xxx.png` continue to render after
// you migrate to the new URL scheme.

import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import nodePath from 'path'

const MIME_BY_EXT = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.bmp':  'image/bmp',
  '.svg':  'image/svg+xml',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.ogv':  'video/ogg',
  '.mov':  'video/quicktime',
}

export async function GET(_request, context) {
  // Next 15: route context `params` is now a Promise and must be awaited.
  const params = await context.params
  const raw = params?.name || ''
  // Hard sanitize: only basename, no path traversal
  const safe = nodePath.basename(raw)
  if (!safe || safe.startsWith('.') || safe !== raw) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Search order:
  //   1. /data/db/uploads  (current persistent path \u2014 alongside MongoDB data)
  //   2. /data/uploads     (legacy path from previous build \u2014 ephemeral but
  //                         may still have files in the running container)
  //   3. /app/public/uploads (oldest legacy path, served as Next.js static)
  // First hit wins. Falls through to 404 if all three miss.
  const tryPaths = [
    nodePath.join('/data', 'db', 'uploads', safe),
    nodePath.join('/data', 'uploads', safe),
    nodePath.join(process.cwd(), 'public', 'uploads', safe),
  ]

  for (const p of tryPaths) {
    try {
      const buf = await fs.readFile(p)
      const ext = nodePath.extname(safe).toLowerCase()
      const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch (e) {
      // try the next path
    }
  }
  return new NextResponse('Not found', { status: 404 })
}
