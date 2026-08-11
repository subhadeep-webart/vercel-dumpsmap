'use client'

// Left menu for the unified Portal. Renders PORTAL_MENU from constants — section
// items swap the main panel (active item highlighted emerald), href items
// navigate. A collapse toggle shrinks the rail to icons only. Footer shows the
// facility avatar + Verified badge + Log Out. Reused inside the mobile drawer
// (PortalShell), which always renders it expanded.

import Link from 'next/link'
import Image from 'next/image'
import { ShieldCheck, LogOut, ChevronsLeft, ChevronsRight, LifeBuoy, ArrowUpRight } from 'lucide-react'
import { useLogout } from '@/hooks/use-logout'
import { PORTAL_MENU } from '@/constants/facility_portal_constants'
import { SUPPORT_EMAIL } from '@/constants/app_constants'
import { deriveInitials } from '@/components/profile/primitives'

export default function PortalSidebar({ facility, activeSection, onNavigate, collapsed = false, onToggleCollapse }) {
  const logout = useLogout()

  return (
    <div className="flex min-h-full flex-col">
      {/* Header: brand + collapse toggle. Collapsed → logo stacked over the
          expand button, both centered. */}
      {collapsed ? (
        <div className="mb-3 flex flex-col items-center gap-2">
          <Link
            href="/activity-hub"
            className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg transition-transform duration-200 hover:scale-105 active:scale-95"
            aria-label="Go to Activity Hub"
            title="Activity Hub"
          >
            <Image src="/logo-64.png" alt="DumpMaps" width={24} height={24} className="h-6 w-6 object-contain" />
          </Link>
          {onToggleCollapse && (
            <>
              <div className="my-1 h-px w-8 bg-neutral-200" />
              <button
                type="button"
                onClick={onToggleCollapse}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm transition-colors hover:bg-emerald-500"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <ChevronsRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between px-1">
          <Link
            href="/activity-hub"
            className="group/logo flex items-center gap-2 rounded-lg transition-opacity hover:opacity-90"
            aria-label="Go to Activity Hub"
            title="Activity Hub"
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-transform duration-200 group-hover/logo:scale-105">
              <Image src="/logo-64.png" alt="DumpMaps" width={24} height={24} className="h-6 w-6 object-contain" />
            </span>
            <div className="leading-tight">
              <div className="text-[15px] font-extrabold tracking-tight text-neutral-900">
                Dump<span className="text-emerald-600">Maps</span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Facility Portal</div>
            </div>
          </Link>
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

      {/* Menu — natural height (no internal scroll, so no stray scrollbar/jerk). */}
      <nav className="space-y-1.5">
        {PORTAL_MENU.map((item) => {
          const Icon = item.icon
          const active = item.section && item.section === activeSection
          // Collapsed → a compact centered square; expanded → a full-width row.
          // `relative` + `group` so the active accent bar + icon micro-motion work.
          const base = collapsed
            ? 'group relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-[13px] transition-all duration-200'
            : 'group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] tracking-tight transition-all duration-200'
          const tone = active
            ? 'bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-100 shadow-sm shadow-emerald-600/5'
            : 'font-medium text-neutral-500 hover:bg-neutral-100/80 hover:text-neutral-900'

          const inner = (
            <>
              {/* Active accent bar (expanded only) — a small emerald tab on the left. */}
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

      {/* Footer: Need-Help card + facility identity + logout — mt-auto anchors
          it to the bottom of the full-height rail. */}
      <div className="mt-auto shrink-0 pt-3">
        {/* Need Help? — Contact Support (per the mockup). Collapsed → a compact
            support icon button; expanded → the full card. */}
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
