'use client'

// ReactionBar — the Facebook-style divided action row under a post:
// React · Comment · Save/Share, plus the animated reaction picker panel.
//
// Interaction (owned here, not by the page):
//   • Tap React        → toggles the default reaction (like FB tap = Like)
//   • Long-press React → opens the full emoji panel (touch)
//   • Hover React      → opens the panel (pointers with real hover)
//   • Pick an emoji    → applies it and closes the panel
//
// Pure presentational + local UI state; all persistence is delegated to the
// `onReact` / `onComment` / `onToggleSave` / `onShare` callbacks.

import React, { useEffect, useRef, useState } from 'react'
import { MessageCircle, Share2, Bookmark, ThumbsUp } from 'lucide-react'
import { REACTION_TYPES, REACTION_BY_KEY } from '@/lib/community-categories'
import { ReactionIcon, getReactionIcon } from '@/lib/community-icons'
import {
  DEFAULT_REACTION, REACTION_LONG_PRESS_MS, REACTION_HOVER_CLOSE_MS,
} from '@/constants/community_post_detail_constants'

export default function ReactionBar({
  myReaction, reacting, savedByMe, saving,
  onReact, onComment, onToggleSave, onShare,
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const wrapRef = useRef(null)
  const longPressRef = useRef(null)     // long-press timer (touch) → opens panel
  const suppressClickRef = useRef(false) // swallow the click after a long-press
  const myR = myReaction ? REACTION_BY_KEY[myReaction] : null
  const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches

  // Close the panel on outside click / Escape.
  useEffect(() => {
    if (!pickerOpen) return
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setPickerOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setPickerOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [pickerOpen])

  useEffect(() => () => clearTimeout(longPressRef.current), [])

  const pick = (type) => { setPickerOpen(false); onReact(type) }

  const tapReact = () => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    onReact(myReaction || DEFAULT_REACTION)
  }
  const startLongPress = () => {
    clearTimeout(longPressRef.current)
    longPressRef.current = setTimeout(() => { suppressClickRef.current = true; setPickerOpen(true) }, REACTION_LONG_PRESS_MS)
  }
  const cancelLongPress = () => clearTimeout(longPressRef.current)

  return (
    <div className="relative grid grid-cols-3 border-t border-neutral-100">
      {/* React */}
      <div
        ref={wrapRef}
        className="relative"
        onMouseEnter={() => { clearTimeout(longPressRef.current); if (canHover()) setPickerOpen(true) }}
        onMouseLeave={() => { if (canHover()) { clearTimeout(longPressRef.current); longPressRef.current = setTimeout(() => setPickerOpen(false), REACTION_HOVER_CLOSE_MS) } }}
      >
        {pickerOpen && (
          <div className="reaction-panel absolute bottom-full left-1/2 z-30 mb-2.5 flex items-center gap-1 rounded-full border border-neutral-200 bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.14)] backdrop-blur">
            {REACTION_TYPES.map((r, i) => {
              const Icon = getReactionIcon(r.key)
              const mine = myReaction === r.key
              return (
                <button
                  key={r.key}
                  onClick={() => pick(r.key)}
                  aria-label={r.label}
                  style={{ animationDelay: `${i * 45}ms` }}
                  className={`reaction-emoji group relative flex h-10 w-10 items-center justify-center rounded-full transition-[transform,background-color] duration-150 will-change-transform ${mine ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-300' : 'text-neutral-600 hover:bg-neutral-100'}`}
                >
                  <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 scale-90 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100">
                    {r.label}
                  </span>
                  <span className="reaction-emoji-glyph inline-flex">
                    <Icon className="h-[22px] w-[22px]" />
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <button
          onClick={tapReact}
          onTouchStart={startLongPress}
          onTouchEnd={cancelLongPress}
          onTouchMove={cancelLongPress}
          onContextMenu={(e) => { e.preventDefault(); setPickerOpen(true) }}
          disabled={reacting}
          className={`flex w-full items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors hover:bg-neutral-50 ${myR ? 'text-brand-700' : 'text-neutral-600'}`}
        >
          {myR ? <ReactionIcon reactionKey={myReaction} className="h-[18px] w-[18px]" /> : <ThumbsUp className="h-[18px] w-[18px]" />}
          <span>{myR ? myR.label : 'React'}</span>
        </button>
      </div>

      {/* Comment */}
      <button onClick={onComment} className="flex items-center justify-center gap-1.5 border-x border-neutral-100 py-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50">
        <MessageCircle className="h-[18px] w-[18px]" />
        <span>Comment</span>
      </button>

      {/* Save / Share */}
      <div className="flex items-center justify-center">
        <button onClick={onToggleSave} disabled={saving} title={savedByMe ? 'Saved' : 'Save'} className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors hover:bg-neutral-50 ${savedByMe ? 'text-brand-700' : 'text-neutral-600'}`}>
          <Bookmark className={`h-[18px] w-[18px] ${savedByMe ? 'fill-brand-600 text-brand-600' : ''}`} />
          <span>Save</span>
        </button>
        <button onClick={onShare} title="Share" className="flex items-center justify-center px-3 py-2.5 text-neutral-600 transition-colors hover:bg-neutral-50">
          <Share2 className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  )
}
