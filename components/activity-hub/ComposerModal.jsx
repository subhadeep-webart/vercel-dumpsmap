'use client'

// ComposerModal — the "create a post" sheet. Two stages: a type picker and the
// compose form. Types with an `href` (Job, Bounty) route away to their dedicated
// page instead of composing inline. When opened via a deep link (?compose=<type>)
// the picker is skipped and it opens straight on that type.

import { useState } from 'react'
import { X, Send, Loader2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import MediaUploader from '@/components/MediaUploader'
import { POST_TYPES } from '@/constants/activity_hub_constants'

export default function ComposerModal({ initialType, onClose, onCreated, user, router, createPost }) {
  const [stage, setStage] = useState(initialType ? 'compose' : 'pick') // 'pick' | 'compose'
  const [type, setType] = useState(initialType || 'general')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)

  const meta = POST_TYPES.find((p) => p.value === type) || POST_TYPES[0]

  const submit = async () => {
    if (!user) {
      toast.error('Please log in to post')
      onClose?.()
      return
    }
    if (!title.trim() && !body.trim()) {
      toast.error('Add a title or some text')
      return
    }
    setBusy(true)
    try {
      const post = await createPost({ type, title, body, photos })
      toast.success('Post published')
      onCreated?.(post)
    } catch (e) {
      toast.error(e?.message || 'Post failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <button onClick={stage === 'compose' ? () => setStage('pick') : onClose} className="text-neutral-500 hover:text-neutral-900">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-base font-bold">{stage === 'pick' ? 'Create Post' : meta.label}</h2>
          {stage === 'compose' ? (
            <Button size="sm" onClick={submit} disabled={busy} className="bg-green-700 hover:bg-green-800">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          ) : <span className="w-9" />}
        </header>

        {stage === 'pick' && (
          <div className="max-h-[70vh] overflow-y-auto p-2">
            <p className="px-2 py-2 text-center text-xs text-neutral-500">What would you like to post?</p>
            <div className="space-y-1.5">
              {POST_TYPES.map((opt) => {
                const Icon = opt.icon
                return (
                  <button key={opt.value}
                    onClick={() => {
                      if (opt.href) { router.push(opt.href); onClose(); return }
                      setType(opt.value); setStage('compose')
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left hover:border-green-300 hover:bg-green-50/30"
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${opt.tone}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-neutral-900">{opt.label}</div>
                      <div className="text-xs text-neutral-500">{opt.desc}</div>
                    </div>
                    <ChevronDown className="-rotate-90 text-neutral-400" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {stage === 'compose' && (
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${meta.tone}`}>
              <meta.icon className="h-3 w-3" /> {meta.label}
            </div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="What's happening?" />
            <MediaUploader
              variant="gallery" multi maxFiles={6}
              value={photos}
              onChange={setPhotos}
              helpText="Add up to 6 photos (optional)"
            />
          </div>
        )}
      </div>
    </div>
  )
}
