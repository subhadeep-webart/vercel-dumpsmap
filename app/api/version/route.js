// Build-version endpoint
// ---------------------------------------------------------------------------
// Returns the deployed build's identity so the client-side VersionWatcher can
// detect deploys and prompt users to refresh. Cache-Control is no-store —
// the client MUST hit the server every poll.
//
// Build identity sources (in priority order):
//   1) BUILD_ID env var injected at deploy time
//   2) VERCEL_GIT_COMMIT_SHA / NEXT_PUBLIC_GIT_SHA env vars
//   3) Next.js's .next/BUILD_ID file (production builds)
//   4) Process start time fallback (dev only — changes every restart)

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const PROCESS_BOOT_AT = Date.now()
const PROCESS_BOOT_ISO = new Date(PROCESS_BOOT_AT).toISOString()

let _cachedBuildId = null

function resolveBuildId() {
  if (_cachedBuildId) return _cachedBuildId
  const envBuild =
    process.env.BUILD_ID ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    process.env.GIT_SHA ||
    process.env.NEXT_PUBLIC_GIT_SHA
  if (envBuild) { _cachedBuildId = envBuild; return _cachedBuildId }
  try {
    const p = path.join(process.cwd(), '.next', 'BUILD_ID')
    if (fs.existsSync(p)) {
      const id = fs.readFileSync(p, 'utf8').trim()
      if (id) { _cachedBuildId = id; return _cachedBuildId }
    }
  } catch (_) { /* noop */ }
  _cachedBuildId = `dev-${PROCESS_BOOT_AT}`
  return _cachedBuildId
}

function jsonResponse(payload) {
  return new NextResponse(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

export async function GET() {
  return jsonResponse({
    buildId:   resolveBuildId(),
    bootAt:    PROCESS_BOOT_ISO,
    bootMs:    PROCESS_BOOT_AT,
    serverNow: new Date().toISOString(),
    nodeEnv:   process.env.NODE_ENV || 'development',
  })
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'X-Build-Id':  resolveBuildId(),
      'X-Boot-Ms':   String(PROCESS_BOOT_AT),
      'Cache-Control': 'no-store',
    },
  })
}
