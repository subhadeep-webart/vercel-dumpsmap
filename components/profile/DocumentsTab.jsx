'use client'

// Documents tab — a tile per category (license, insurance, W9, etc.) where the
// user uploads files. Each upload appends a document record (with a generated
// id) to form.documents and persists the whole array. Categories live in
// constants/profile_constants (DOCUMENT_CATEGORIES).

import React from 'react'
import { Badge } from '@/components/ui/badge'
import MediaUploader from '@/components/MediaUploader'
import { SavingHint, ProfileCard } from '@/components/profile/primitives'
import { DOCUMENT_CATEGORIES } from '@/constants/profile_constants'
import { Image as ImageIcon, FileText } from 'lucide-react'

// Cheap heuristic: does this URL point at an image we can thumbnail? (Data URLs
// and common image extensions.) PDFs / others fall back to the file icon.
const isImageUrl = (url = '') =>
  /^data:image\//i.test(url) || /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(url)

export default function DocumentsTab({ form, setForm, save, saving }) {
  const documents = form.documents || []

  const addDocument = React.useCallback(async (category, url, label) => {
    if (!url) return
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `doc_${Date.now()}`
    const next = [...documents, { id, category, url, label, uploadedAt: new Date().toISOString() }]
    setForm((f) => ({ ...f, documents: next }))
    await save({ documents: next }, 'Documents')
  }, [documents, setForm, save])

  const removeDocument = React.useCallback(async (id) => {
    const next = documents.filter((d) => d.id !== id)
    setForm((f) => ({ ...f, documents: next }))
    await save({ documents: next }, 'Documents')
  }, [documents, setForm, save])

  return (
    <ProfileCard title="Documents & uploads" desc="Licenses, insurance, W9, logo, and certifications" icon={FileText}>
      <p className="text-xs text-neutral-600">Upload your licenses, insurance, W9, business logo, and certifications. Documents are private by default — only admins and verified parties can view them. Verification queue is launching in a later sprint.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {DOCUMENT_CATEGORIES.map((cat, i) => {
          const Icon = cat.icon
          const matches = documents.filter((d) => d.category === cat.key)
          const hasFiles = matches.length > 0
          return (
            // Each tile rises in with a stagger, lifts on hover, and turns a
            // faint green when it already holds a document so "done" reads at a
            // glance.
            <div
              key={cat.key}
              style={{ '--dm-i': i }}
              className={`dm-rise-in group/doc rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                hasFiles ? 'border-green-200 bg-green-50/40 hover:border-green-300' : 'border-neutral-200 bg-white hover:border-neutral-300'
              }`}
            >
              <div className="mb-2.5 flex items-center gap-2">
                <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover/doc:scale-110 group-hover/doc:-rotate-3 ${
                  hasFiles ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-sm shadow-green-600/25' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-bold text-neutral-900">{cat.label}</span>
                {hasFiles && <Badge className="ml-auto gap-1 bg-green-100 text-[10px] text-green-700 hover:bg-green-100">{matches.length} uploaded</Badge>}
              </div>
              <MediaUploader
                variant="tile"
                value=""
                onChange={(url) => addDocument(cat.key, url, cat.label)}
                label={`Upload ${cat.label}`}
                helpText="JPG/PNG/PDF · ≤8MB"
                className="aspect-video"
                accept="image/*"
              />
              {hasFiles && (
                <ul className="mt-3 space-y-1.5">
                  {matches.map((d) => {
                    const img = isImageUrl(d.url)
                    return (
                    <li key={d.id} className="group/file flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-2 py-1.5 transition-colors hover:border-green-200 hover:bg-green-50/50">
                      <a href={d.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 truncate text-xs text-neutral-700 transition-colors hover:text-green-700">
                        {/* Image docs get a tiny thumbnail that zooms into a
                            floating preview on hover; non-images keep the icon. */}
                        {img ? (
                          // Thumbnail expands in place on hover into a larger
                          // preview — stays within the card so it never clips,
                          // and the row grows smoothly to fit it.
                          <span className="shrink-0 overflow-hidden rounded-md border border-neutral-200">
                            <img
                              src={d.url}
                              alt=""
                              className="h-7 w-7 object-cover transition-all duration-300 ease-out group-hover/file:h-24 group-hover/file:w-24"
                            />
                          </span>
                        ) : (
                          <ImageIcon className="h-3 w-3 shrink-0 text-neutral-400 transition-colors group-hover/file:text-green-600" />
                        )}
                        <span className="truncate">{d.label || d.url.split('/').pop()}</span>
                        <span className="ml-1 shrink-0 text-[10px] text-neutral-400">{new Date(d.uploadedAt).toLocaleDateString()}</span>
                      </a>
                      <button onClick={() => removeDocument(d.id)} className="ml-2 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium text-red-500 opacity-70 transition-all hover:bg-red-50 hover:text-red-700 hover:opacity-100 active:scale-95">Remove</button>
                    </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
      {saving && <SavingHint label={saving} />}
    </ProfileCard>
  )
}
