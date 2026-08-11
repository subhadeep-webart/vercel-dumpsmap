'use client'

// PortalCard — shared card chrome for the portal's operational sections: a header
// row (title, optional info tooltip, action slot) over a padded body, with the
// dm-rise-in entrance + hover lift used across the app. Each card is a scroll
// anchor (id) so the sidebar scroll-spy can target it. Kept separate from the
// profile editor's ProfileCard because the portal header layout differs (action
// on the right, no gradient icon chip).

import { Info } from 'lucide-react'
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip'

export default function PortalCard({ id, title, info, action, index = 0, children, bodyClassName = '' }) {
  return (
    <section
      id={id}
      style={{ '--dm-i': index }}
      className="dm-rise-in scroll-mt-20 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-neutral-900/5"
    >
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-bold text-neutral-900">{title}</h2>
          {info && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger aria-label="More info">
                  <Info className="h-4 w-4 text-neutral-300 hover:text-neutral-500" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">{info}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {action}
      </div>
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  )
}
