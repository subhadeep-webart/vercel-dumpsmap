'use client'

import { useRef, useState } from 'react'
import { Camera, ImagePlus, X, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const MAX_BYTES = 8 * 1024 * 1024
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/*'

// Uploads a single File via XHR so we get progress events.
// Resolves to { id, url, size, mime } returned by the server.
function uploadOne(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300 && j.uploads?.[0]) {
          resolve(j.uploads[0])
        } else {
          reject(new Error(j.error || `Upload failed (${xhr.status})`))
        }
      } catch (e) {
        reject(new Error('Bad server response'))
      }
    }
    xhr.onerror = () => reject(new Error('Network error'))
    const form = new FormData()
    form.append('file', file, file.name)
    xhr.send(form)
  })
}

/**
 * Reusable photo uploader.
 *
 * Props:
 *  - value:    array of strings (urls) or { url, id } objects   — current photos
 *  - onChange: (next) => void                                     — fires with full updated array
 *  - max:      number                                             — max photos (default 6)
 *  - label:    string                                             — header label (default "Photos")
 *  - hint:     string                                             — small hint under header
 *  - showCamera:boolean                                           — show separate Camera button (default true on mobile)
 *  - compact:  boolean                                            — small thumbnails (default false)
 */
export default function PhotoUploader({
  value = [],
  onChange,
  max = 6,
  label = 'Photos',
  hint,
  showCamera = true,
  compact = false,
  disabled = false,
}) {
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const [uploading, setUploading] = useState([]) // [{tempId, name, progress, error?}]

  const normalized = (value || []).map((v) => (typeof v === 'string' ? { url: v } : v))
  const total = normalized.length + uploading.filter((u) => !u.error).length

  const handleFiles = async (filesList) => {
    if (!filesList || filesList.length === 0) return
    const files = Array.from(filesList)
    const remaining = Math.max(0, max - normalized.length - uploading.filter((u) => !u.error).length)
    if (files.length > remaining) {
      toast.error(`Only ${remaining} more photo${remaining === 1 ? '' : 's'} allowed (max ${max})`)
    }
    const accepted = files.slice(0, remaining)
    if (accepted.length === 0) return
    // Pre-validate
    for (const f of accepted) {
      if (f.size > MAX_BYTES) { toast.error(`"${f.name}" exceeds 8 MB`); return }
      if (!f.type.startsWith('image/')) { toast.error(`"${f.name}" is not an image`); return }
    }
    const placeholders = accepted.map((f) => ({ tempId: `t-${Date.now()}-${Math.random()}`, name: f.name, progress: 0 }))
    setUploading((prev) => [...prev, ...placeholders])
    const completed = []
    for (let i = 0; i < accepted.length; i++) {
      const f = accepted[i]
      const ph = placeholders[i]
      try {
        const result = await uploadOne(f, (p) => {
          setUploading((prev) => prev.map((u) => (u.tempId === ph.tempId ? { ...u, progress: p } : u)))
        })
        completed.push(result)
        setUploading((prev) => prev.filter((u) => u.tempId !== ph.tempId))
      } catch (e) {
        setUploading((prev) => prev.map((u) => (u.tempId === ph.tempId ? { ...u, error: e.message || 'Failed', progress: 0 } : u)))
        toast.error(e.message || 'Upload failed')
      }
    }
    if (completed.length > 0) onChange?.([...normalized, ...completed])
  }

  const removeAt = async (idx) => {
    const item = normalized[idx]
    const next = normalized.filter((_, i) => i !== idx)
    onChange?.(next)
    if (item?.id) {
      // Fire-and-forget delete on the server
      try { await fetch(`/api/upload/${item.id}`, { method: 'DELETE' }) } catch {}
    }
  }

  const removeFailed = (tempId) => setUploading((prev) => prev.filter((u) => u.tempId !== tempId))

  const thumbCls = compact ? 'h-16 w-16' : 'h-24 w-24'

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-neutral-800">{label}</div>
          {hint && <div className="text-[11px] text-neutral-500">{hint}</div>}
        </div>
        <div className="text-[11px] text-neutral-500">{total} / {max}</div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {/* Existing photos */}
        {normalized.map((p, i) => (
          <div key={p.id || p.url || i} className={`relative shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 ${thumbCls}`}>
            <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            {!disabled && (
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/80"
                aria-label="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}

        {/* Uploading placeholders */}
        {uploading.map((u) => (
          <div key={u.tempId} className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border bg-neutral-50 ${thumbCls} ${u.error ? 'border-red-300' : 'border-neutral-200'}`}>
            {u.error ? (
              <>
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div className="mt-0.5 line-clamp-1 px-1 text-center text-[9px] text-red-600">{u.error}</div>
                <button onClick={() => removeFailed(u.tempId)} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white" aria-label="Dismiss">
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                <div className="mt-1 text-[10px] font-semibold text-neutral-600">{u.progress}%</div>
                <div className="absolute bottom-0 left-0 h-1 bg-brand-500" style={{ width: `${u.progress}%` }} />
              </>
            )}
          </div>
        ))}

        {/* Upload buttons */}
        {!disabled && total < max && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 bg-white text-neutral-600 hover:border-brand-500 hover:text-brand-700 active:bg-neutral-50 ${thumbCls}`}
              aria-label="Add photos"
            >
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px] font-semibold">Add</span>
            </button>
            {showCamera && (
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className={`flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 bg-white text-neutral-600 hover:border-brand-500 hover:text-brand-700 active:bg-neutral-50 sm:hidden ${thumbCls}`}
                aria-label="Take photo"
              >
                <Camera className="h-5 w-5" />
                <span className="text-[10px] font-semibold">Camera</span>
              </button>
            )}
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}

// Helper to extract plain URL list from PhotoUploader value (use when sending to API)
export function toUrlList(value) {
  return (value || []).map((v) => (typeof v === 'string' ? v : v.url)).filter(Boolean)
}
