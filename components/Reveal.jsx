'use client'

// Reveal
// ---------------------------------------------------------------------------
// Wraps any content so it gently fades + slides up the first time it scrolls
// into view. Pure CSS transition on opacity + transform (GPU-accelerated) so
// there is no performance cost. Falls back to instant display for users who
// prefer reduced motion (handled inside useReveal).
//
// Usage:
//   <Reveal>            ...content...      </Reveal>
//   <Reveal delay={120}> ...content...     </Reveal>   // stagger in a list
//   <Reveal as="section" className="py-16"> ... </Reveal>

import { useReveal } from '@/lib/useReveal'

export default function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
  ...rest
}) {
  const { ref, shown } = useReveal()

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
      className={[
        'transition-all duration-700 ease-out will-change-[opacity,transform] motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  )
}
