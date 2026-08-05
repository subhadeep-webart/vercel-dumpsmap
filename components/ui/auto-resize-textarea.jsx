'use client'

// AutoResizeTextarea — a <textarea> that grows to fit its content and hides its
// scrollbar. It expands line-by-line as you type (and shrinks back on delete),
// capped by `maxHeight`; past the cap it scrolls internally, but the scrollbar
// stays hidden (scroll still works via wheel/touch/keys).
//
// Drop-in for the base Textarea: forwards a ref (merged with the internal resize
// ref) and spreads all other props. Control it with value/onChange as usual.

import React, { useCallback, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const AutoResizeTextarea = React.forwardRef(function AutoResizeTextarea(
  { className, value, maxHeight = 160, minHeight = 44, style, ...props },
  forwardedRef,
) {
  const innerRef = useRef(null)

  // Reset to 'auto' first so the field can also shrink, then fit to content
  // (capped at maxHeight). Keeps overflow hidden until the cap is hit.
  const autosize = useCallback((el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [maxHeight])

  // Merge the caller's ref with our internal one.
  const setRef = useCallback((node) => {
    innerRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])

  // Re-fit on every value change (typing, paste, and clearing after submit).
  // useLayoutEffect avoids a one-frame flicker at the new height.
  useLayoutEffect(() => { autosize(innerRef.current) }, [value, autosize])

  return (
    <textarea
      ref={setRef}
      value={value}
      rows={1}
      style={{ maxHeight, minHeight, ...style }}
      className={cn(
        // Auto-grow: no manual resize, hide the scrollbar in every engine even
        // while overflowing (scroll still works).
        'w-full resize-none overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    />
  )
})

// Base chrome copied from the standard <Textarea> (components/ui/textarea.jsx),
// minus its fixed min-height (height is managed here). Kept in sync so the
// styled variant looks identical to a normal textarea.
const TEXTAREA_BASE =
  'rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

// StyledAutoResizeTextarea — same auto-grow + hidden-scrollbar behavior, but
// with the standard Textarea look (border, padding, focus ring) baked in, so
// call sites don't have to repeat those classes. `className` still merges on top.
const StyledAutoResizeTextarea = React.forwardRef(function StyledAutoResizeTextarea(
  { className, ...props },
  ref,
) {
  return <AutoResizeTextarea ref={ref} className={cn(TEXTAREA_BASE, className)} {...props} />
})

export { AutoResizeTextarea, StyledAutoResizeTextarea }
export default AutoResizeTextarea
