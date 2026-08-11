'use client'

// Left menu for the unified Portal. Renders PORTAL_MENU — section items swap the
// main panel (active item highlighted emerald), href items navigate. A collapse
// toggle shrinks the rail to icons only. The logo now lives in the shared global
// header (AppHeader), so the sidebar starts with a compact "Portal" label + the
// collapse toggle.
//
// PREMIUM SCROLL: the menu has NO visible scrollbar. Instead, when it overflows,
// up/down chevron buttons appear at the top/bottom of the menu and scroll it —
// a distinctive SaaS-console touch. Buttons auto-hide when there's nothing more
// to scroll in that direction.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, LogOut, ChevronsLeft, ChevronsRight, LifeBuoy, ArrowUpRight, ChevronUp, ChevronDown } from 'lucide-react'
import { useLogout } from '@/hooks/use-logout'
import { PORTAL_MENU } from '@/constants/facility_portal_constants'
import { SUPPORT_EMAIL } from '@/constants/app_constants'
import { deriveInitials } from '@/components/profile/primitives'

export default function PortalSidebar({ facility, activeSection, onNavigate, collapsed = false, onToggleCollapse }) {
  const logout = useLogout()

  // Scroll-button state for the menu region.
  const scrollRef = useRef(null)
  const [canUp, setCanUp] = useState(false)
  const [canDown, setCanDown] = useState(false)

  const recompute = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    setCanUp(scrollTop > 2)
    setCanDown(scrollTop + clientHeight < scrollHeight - 2)
  }, [])

  useEffect(() => {
    recompute()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', recompute, { passive: true })
    window.addEventListener('resize', recompute)
    return () => {
      el.removeEventListener('scroll', recompute)
      window.removeEventListener('resize', recompute)
    }
  }, [recompute, collapsed])

  const scrollBy = (dir) => {
    const el = scrollRef.current
    if (el) el.scrollBy({ top: dir * 160, behavior: 'smooth' })
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Header: "Facility Portal" label + collapse toggle (logo is in the global
          header now). Collapsed → just the expand toggle, centered. */}
      {collapsed ? (
        <div className="mb-2 flex justify-center">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm transition-all duration-200 hover:bg-emerald-600 active:scale-95"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronsRight className="h-5 w-5" />
            </button>
          )}
        </div>
      ) : (
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Facility Portal</span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Scroll-up button — appears only when there's content above. */}
      {canUp && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          className="mb-1 flex h-6 w-full items-center justify-center rounded-md bg-gradient-to-b from-white to-transparent text-neutral-400 transition-colors hover:text-emerald-600"
          aria-label="Scroll up"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      )}

      {/* Menu — scrolls with NO visible scrollbar (hidden via .no-scrollbar). */}
      <nav ref={scrollRef} className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto">
        {PORTAL_MENU.map((item) => {
          const Icon = item.icon
          const active = item.section && item.section === activeSection
          const base = collapsed
            ? 'group relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-[13px] transition-all duration-200'
            : 'group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] tracking-tight transition-all duration-200'
          const tone = active
            ? 'bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-100 shadow-sm shadow-emerald-600/5'
            : 'font-medium text-neutral-500 hover:bg-neutral-100/80 hover:text-neutral-900'

          const inner = (
            <>
              {active && !collapsed && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-500" />
              )}
              <Icon
                className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${
                  active ? '' : 'group-hover:scale-110'
                } ${active && !collapsed ? 'group-hover:-rotate-3' : ''}`}
                strokeWidth={active ? 2.25 : 2}
              />
              {!collapsed && item.label}
            </>
          )

          if (item.href) {
            return (
              <Link key={item.key} href={item.href} className={`${base} ${tone}`} title={collapsed ? item.label : undefined}>
                {inner}
              </Link>
            )
          }
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate?.(item.section)}
              className={`${base} ${tone} ${collapsed ? '' : 'text-left'}`}
              aria-current={active ? 'true' : undefined}
              title={collapsed ? item.label : undefined}
            >
              {inner}
            </button>
          )
        })}
      </nav>

      {/* Scroll-down button — appears only when there's more below. */}
      {canDown && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          className="mt-1 flex h-6 w-full items-center justify-center rounded-md bg-gradient-to-t from-white to-transparent text-neutral-400 transition-colors hover:text-emerald-600"
          aria-label="Scroll down"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      )}

      {/* Footer: Need-Help card + facility identity + logout. */}
      <div className="mt-auto shrink-0 pt-3">
        {collapsed ? (
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="group mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 transition-all duration-200 hover:bg-emerald-100 hover:text-emerald-700 hover:shadow-sm active:scale-95"
            aria-label="Contact Support"
            title="Contact Support"
          >
            <LifeBuoy className="h-[18px] w-[18px] transition-transform duration-300 group-hover:rotate-12" />
          </a>
        ) : (
          <div className="group mb-3 overflow-hidden rounded-xl border border-neutral-200/80 bg-gradient-to-b from-emerald-50/60 to-white p-3.5 shadow-sm transition-all duration-300 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-600/5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-6">
                <LifeBuoy className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <h3 className="text-sm font-bold tracking-tight text-neutral-900">Need Help?</h3>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
              We&apos;re here to help you keep your info accurate.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[13px] font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow active:scale-[0.98]"
            >
              Contact Support
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        )}

        <div className="border-t border-neutral-200 pt-3">
          {facility && !collapsed && (
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-[11px] font-bold text-neutral-600 ring-1 ring-neutral-200">
                {facility.photos?.[0] || facility.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={facility.photos?.[0] || facility.images?.[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  deriveInitials(facility.name)
                )}
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-neutral-800">{facility.name}</div>
                {facility.verified && (
                  <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700">
                    <ShieldCheck className="h-3 w-3" /> Verified Facility
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className={`flex items-center rounded-lg text-sm font-medium text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-700 ${
              collapsed ? 'mx-auto h-9 w-9 justify-center' : 'w-full gap-2.5 px-2.5 py-2'
            }`}
            title={collapsed ? 'Log Out' : undefined}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" /> {!collapsed && 'Log Out'}
          </button>
        </div>
      </div>
    </div>
  )
}
