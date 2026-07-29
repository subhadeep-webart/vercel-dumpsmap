'use client'

// components/MediaUploader.jsx
// ----------------------------------------------------------------------------
// Universal upload component used everywhere on DumpMaps:
//
//   • Profile avatar / cover photo
//   • Before / After photos
//   • Receipt scanner attachments
//   • Marketplace listings
//   • Job posts / Work orders
//   • Facility photos / Fleet photos / Contractor portfolio
//
// Features:
//   • Mobile camera capture   (capture="environment" on the input)
//   • Gallery / file picker
//   • Desktop drag-and-drop
//   • Client-side compression (canvas resize) — keeps uploads under 8MB
//   • Loading / progress / retry / remove states
//   • Multiple files (when `multi` is true)
//   • SafeImage preview — no broken icons
//
// API contract:
//   • POSTs multipart/form-data to /api/upload (field name: "file")
//   • Server returns { uploads: [{ id, url, size, mime, originalName }] }
//
// Variants (controls visual size):
//   • avatar  — 96px round
//   • cover   — wide banner
//   • tile    — square card
//   • gallery — multi-image grid
//
// Usage:
//   <MediaUploader
//     variant="avatar"
//     value={user.avatarUrl}
//     onChange={(url) => save({ avatarUrl: url })}
//   />
//
//   <MediaUploader
//     variant="gallery" multi maxFiles={6}
//     value={photos}
//     onChange={(urls) => save({ photos: urls })}
//   />
// ----------------------------------------------------------------------------

import React, { useCallback, useMemo, useRef, useState } from 'react'
import SafeImage from '@/components/SafeImage'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Camera, Image as ImageIcon, Upload, X, Loader2, Trash2, Plus, RotateCw,
  CheckCircle2, AlertCircle, RefreshCw,
} from 'lucide-react'

const MAX_BYTES = 8 * 1024 * 1024        // matches server image limit
const MAX_VIDEO_BYTES = 64 * 1024 * 1024 // matches server video limit
const COMPRESS_LONG_EDGE = 2048    // resize long edge to this many px
const COMPRESS_QUALITY = 0.85      // jpeg quality

// ----------------------------------------------------------------------------
// Compression — uses canvas; never crashes the page if it fails (falls back to
// the original file).
// ----------------------------------------------------------------------------
async function compressImage(file) {
  // SVGs, gifs, and small files skip compression.
  if (!file || !file.type.startsWith('image/')) return file
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  if (file.size <= 512 * 1024) return file // <=512KB already small

  try {
    const bitmap = await createImageBitmap(file).catch(async () => {
      // Fallback for browsers without createImageBitmap (rare)
      const img = new Image()
      const url = URL.createObjectURL(file)
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
      URL.revokeObjectURL(url)
      return img
    })
    const w = bitmap.width || bitmap.naturalWidth
    const h = bitmap.height || bitmap.naturalHeight
    const long = Math.max(w, h)
    const scale = long > COMPRESS_LONG_EDGE ? COMPRESS_LONG_EDGE / long : 1
    const nw = Math.round(w * scale)
    const nh = Math.round(h * scale)
    const canvas = document.createElement('canvas')
    canvas.width = nw; canvas.height = nh
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, nw, nh)
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', COMPRESS_QUALITY))
    if (!blob) return file
    // Only keep the compressed version if it's actually smaller.
    if (blob.size >= file.size) return file
    const out = new File([blob], (file.name || 'photo').replace(/\.[a-z]+$/i, '') + '.jpg', { type: 'image/jpeg' })
    return out
  } catch (e) {
    console.warn('[MediaUploader] compression failed, using original', e)
    return file
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export default function MediaUploader({
  variant = 'tile',                  // 'avatar' | 'cover' | 'tile' | 'gallery'
  value,                             // string URL or string[] URLs (when multi)
  onChange,                          // (urlOrUrls) => void   (caller persists to API)
  multi = false,
  maxFiles = 6,
  label,                             // optional override of empty-state label
  helpText,
  className = '',
  accept = 'image/*',
  showRemove = true,
  showRotate = false,                // (future) rotate preview client-side
}) {
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const dropZoneRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [lastError, setLastError] = useState('')

  const urls = useMemo(() => {
    if (multi) return Array.isArray(value) ? value.filter(Boolean) : []
    return value ? [value] : []
  }, [multi, value])
  const isEmpty = urls.length === 0
  const canAddMore = multi ? urls.length < maxFiles : isEmpty

  // ------------------------------------------------------------------------
  // Upload pipeline (single or batch)
  // ------------------------------------------------------------------------
  const uploadFiles = useCallback(async (rawFiles) => {
    if (!rawFiles || rawFiles.length === 0) return
    setBusy(true); setLastError(''); setProgress(0)
    try {
      // Enforce multi limits before doing work.
      const allowed = multi ? Math.max(0, maxFiles - urls.length) : 1
      const files = Array.from(rawFiles).slice(0, allowed)
      if (rawFiles.length > allowed) {
        toast.warning(`Only ${allowed} more file${allowed === 1 ? '' : 's'} allowed.`)
      }
      const uploaded = []
      for (let i = 0; i < files.length; i++) {
        let file = files[i]
        // Videos can't be canvas-compressed and get a larger server allowance.
        const isVideo = (file.type || '').startsWith('video/')
        const limit = isVideo ? MAX_VIDEO_BYTES : MAX_BYTES
        // Server hard limit. Try compressing oversized files before failing.
        if (file.size > limit) {
          if (!isVideo) file = await compressImage(file)
          if (file.size > limit) {
            throw new Error(`"${file.name}" is too large (>${Math.round(limit / 1024 / 1024)}MB).`)
          }
        } else if (!isVideo) {
          // Small but still benefit from compression on mobile bandwidth
          file = await compressImage(file)
        }
        const fd = new FormData()
        fd.append('file', file)
        const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const resp = await fetch('/api/upload', { method: 'POST', headers, body: fd })
        const j = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(j.error || `Upload failed (HTTP ${resp.status})`)
        const url = j.uploads?.[0]?.url
        if (!url) throw new Error('Server did not return a URL')
        uploaded.push(url)
        setProgress(Math.round(((i + 1) / files.length) * 100))
      }
      // Hand the new URLs back to the parent.
      if (multi) onChange([...urls, ...uploaded])
      else if (uploaded[0]) onChange(uploaded[0])
      toast.success(uploaded.length > 1 ? `${uploaded.length} photos uploaded` : 'Photo uploaded')
    } catch (e) {
      console.error('[MediaUploader] upload failed', e)
      setLastError(e.message || 'Upload failed')
      toast.error(e.message || 'Upload failed')
    } finally {
      setBusy(false); setProgress(0)
      if (fileRef.current) fileRef.current.value = ''
      if (cameraRef.current) cameraRef.current.value = ''
    }
  }, [multi, maxFiles, urls, onChange])

  const handleFileInput = (e) => uploadFiles(e.target.files)
  const handleCameraInput = (e) => uploadFiles(e.target.files)

  // Drag-and-drop (desktop)
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation()
    setDragging(false)
    const files = e.dataTransfer?.files
    if (files && files.length) uploadFiles(files)
  }

  const removeAt = (idx) => {
    if (multi) onChange(urls.filter((_, i) => i !== idx))
    else onChange('')
    toast.success('Photo removed')
  }

  // ------------------------------------------------------------------------
  // Render variants
  // ------------------------------------------------------------------------
  if (variant === 'avatar') {
    return (
      <div className={`relative inline-block ${className}`}>
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-green-600 text-2xl font-extrabold text-white shadow-lg sm:h-28 sm:w-28">
          {urls[0] ? (
            <SafeImage src={urls[0]} alt="Profile" kind="avatar" className="h-full w-full object-cover" />
          ) : (
            <span>{(label || '?').slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <UploadActionPills
          fileRef={fileRef} cameraRef={cameraRef}
          onPick={() => fileRef.current?.click()}
          onCamera={() => cameraRef.current?.click()}
          onRemove={() => removeAt(0)}
          hasValue={!!urls[0]} busy={busy} compact showRemove={showRemove}
        />
        <HiddenInputs accept={accept} multi={multi}
          fileRef={fileRef} cameraRef={cameraRef}
          onFile={handleFileInput} onCamera={handleCameraInput} />
        {busy && <UploadingBadge progress={progress} />}
      </div>
    )
  }

  if (variant === 'cover') {
    return (
      <div
        ref={dropZoneRef}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative h-40 w-full overflow-hidden bg-gradient-to-br from-green-100 via-emerald-50 to-white sm:h-56 ${className} ${dragging ? 'ring-4 ring-green-400' : ''}`}
      >
        {urls[0] ? (
          <SafeImage src={urls[0]} alt="Cover" kind="facility" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.18),transparent_55%)]" />
        )}
        {/* Top-right actions */}
        <div className="absolute right-3 top-3 flex gap-1.5">
          {urls[0] && showRemove && (
            <button
              onClick={() => removeAt(0)}
              className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-red-700 shadow backdrop-blur hover:bg-white"
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow backdrop-blur hover:bg-white"
            disabled={busy}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {urls[0] ? 'Replace' : 'Upload'}
          </button>
          <button
            onClick={() => cameraRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow backdrop-blur hover:bg-white sm:hidden"
            disabled={busy}
          >
            <Camera className="h-3.5 w-3.5" /> Camera
          </button>
        </div>
        {dragging && <DragOverlay />}
        {busy && <UploadingBanner progress={progress} />}
        <HiddenInputs accept={accept} multi={multi}
          fileRef={fileRef} cameraRef={cameraRef}
          onFile={handleFileInput} onCamera={handleCameraInput} />
      </div>
    )
  }

  if (variant === 'gallery') {
    return (
      <div className={className}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {urls.map((u, i) => (
            <div key={u + i} className="group relative aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
              <SafeImage src={u} alt="" className="h-full w-full object-cover" />
              {showRemove && (
                <button
                  onClick={() => removeAt(i)}
                  className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-red-600 shadow hover:bg-white opacity-0 transition group-hover:opacity-100"
                  disabled={busy}
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {canAddMore && (
            <GalleryAddTile
              onPick={() => fileRef.current?.click()}
              onCamera={() => cameraRef.current?.click()}
              busy={busy} progress={progress}
            />
          )}
        </div>
        {!!lastError && (
          <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" /> {lastError}
          </p>
        )}
        {!!helpText && <p className="mt-2 text-[11px] text-neutral-500">{helpText}</p>}
        <HiddenInputs accept={accept} multi
          fileRef={fileRef} cameraRef={cameraRef}
          onFile={handleFileInput} onCamera={handleCameraInput} />
      </div>
    )
  }

  // Default: 'tile' variant — square uploader for single images
  return (
    <div
      ref={dropZoneRef}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`relative overflow-hidden rounded-xl border-2 border-dashed transition ${dragging ? 'border-green-500 bg-green-50' : 'border-neutral-300 bg-neutral-50'} ${className}`}
    >
      {urls[0] ? (
        <div className="relative">
          <SafeImage src={urls[0]} alt="" className="aspect-square w-full object-cover" />
          <div className="absolute inset-x-2 bottom-2 flex gap-1.5">
            <Button size="sm" variant="outline" className="bg-white/95" onClick={() => fileRef.current?.click()} disabled={busy}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Replace
            </Button>
            {showRemove && (
              <Button size="sm" variant="outline" className="bg-white/95 text-red-700" onClick={() => removeAt(0)} disabled={busy}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-2 p-6 text-center"
        >
          {busy ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              <span className="text-xs font-semibold text-neutral-700">Uploading… {progress}%</span>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-neutral-400" />
              <span className="text-sm font-bold text-neutral-800">{label || 'Upload photo'}</span>
              <span className="text-[11px] text-neutral-500">{helpText || 'Drag & drop or click to choose'}</span>
            </>
          )}
        </button>
      )}
      {dragging && <DragOverlay />}
      <HiddenInputs accept={accept} multi={multi}
        fileRef={fileRef} cameraRef={cameraRef}
        onFile={handleFileInput} onCamera={handleCameraInput} />
    </div>
  )
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
function HiddenInputs({ accept, multi, fileRef, cameraRef, onFile, onCamera }) {
  return (
    <>
      <input ref={fileRef} type="file" accept={accept} multiple={multi} onChange={onFile} className="hidden" />
      <input ref={cameraRef} type="file" accept={accept} capture="environment" onChange={onCamera} className="hidden" />
    </>
  )
}

function UploadActionPills({ fileRef, cameraRef, onPick, onCamera, onRemove, hasValue, busy, compact, showRemove }) {
  return (
    <>
      <button
        type="button"
        onClick={onCamera}
        disabled={busy}
        className={`absolute -bottom-1 -right-1 inline-flex ${compact ? 'h-8 w-8' : 'h-9 w-9'} items-center justify-center rounded-full bg-green-600 text-white shadow ring-2 ring-white hover:bg-green-700 sm:hidden`}
        title="Take photo"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className={`absolute -bottom-1 -right-1 hidden ${compact ? 'h-8 w-8' : 'h-9 w-9'} items-center justify-center rounded-full bg-green-600 text-white shadow ring-2 ring-white hover:bg-green-700 sm:inline-flex`}
        title="Upload photo"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
      </button>
      {hasValue && showRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className={`absolute -top-1 -right-1 inline-flex ${compact ? 'h-6 w-6' : 'h-7 w-7'} items-center justify-center rounded-full bg-white text-red-600 shadow ring-2 ring-white hover:bg-red-50`}
          title="Remove photo"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  )
}

function GalleryAddTile({ onPick, onCamera, busy, progress }) {
  return (
    <div className="aspect-square">
      <div className="flex h-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50">
        {busy ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
            <span className="text-[10px] font-semibold text-neutral-600">{progress}%</span>
          </>
        ) : (
          <>
            <button onClick={onPick} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-neutral-800 shadow-sm hover:bg-neutral-100">
              <Plus className="h-3 w-3" /> Add
            </button>
            <button onClick={onCamera} className="inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-500 hover:text-neutral-800 sm:hidden">
              <Camera className="h-3 w-3" /> Camera
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function DragOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-green-50/80 backdrop-blur-sm">
      <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-green-700 shadow">
        Drop to upload
      </div>
    </div>
  )
}

function UploadingBanner({ progress }) {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</span>
        <span>{progress}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/30">
        <div className="h-full bg-green-400 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function UploadingBadge({ progress }) {
  return (
    <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
      {progress}%
    </div>
  )
}
