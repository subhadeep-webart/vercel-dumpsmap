'use client'

// Documents tab — a tile per category (license, insurance, W9, etc.) where the
// user uploads files. Each upload appends a document record (with a generated
// id) to form.documents and persists the whole array. Categories live in
// constants/profile_constants (DOCUMENT_CATEGORIES).

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import MediaUploader from '@/components/MediaUploader'
import { SavingHint } from '@/components/profile/primitives'
import { DOCUMENT_CATEGORIES } from '@/constants/profile_constants'
import { Image as ImageIcon } from 'lucide-react'

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
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Documents & uploads</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-neutral-600">Upload your licenses, insurance, W9, business logo, and certifications. Documents are private by default — only admins and verified parties can view them. Verification queue is launching in a later sprint.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {DOCUMENT_CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const matches = documents.filter((d) => d.category === cat.key)
              return (
                <div key={cat.key} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-bold text-neutral-900">{cat.label}</span>
                    {matches.length > 0 && <Badge variant="outline" className="text-[10px]">{matches.length}</Badge>}
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
                  {matches.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {matches.map((d) => (
                        <li key={d.id} className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5">
                          <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate text-xs text-neutral-700 hover:text-green-700">
                            <ImageIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{d.label || d.url.split('/').pop()}</span>
                            <span className="ml-1 shrink-0 text-[10px] text-neutral-400">{new Date(d.uploadedAt).toLocaleDateString()}</span>
                          </a>
                          <button onClick={() => removeDocument(d.id)} className="ml-2 text-xs text-red-600 hover:text-red-800">Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
          {saving && <SavingHint label={saving} />}
        </CardContent>
      </Card>
    </div>
  )
}
