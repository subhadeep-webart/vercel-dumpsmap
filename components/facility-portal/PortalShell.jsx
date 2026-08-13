'use client'

// PortalShell — the responsive frame for the unified Portal (dashboard + profile
// merged into one container): sticky top bar, a fixed left sidebar on desktop, a
// Sheet drawer on mobile, and the main content column.
//
// Navigation is PANEL-SWAP, not scroll: the shell owns the `activeSection` and
// hands it to renderPanel(), which returns ONLY that section's view. Clicking a
// sidebar item swaps the main panel (SaaS-style, one section at a time). The
// hero + status strip stay pinned above the panel as persistent context.

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import AppHeader from '@/components/AppHeader'
import PortalSidebar from './PortalSidebar'
import { menuForRole, DEFAULT_SECTION } from '@/constants/facility_portal_constants'

export default function PortalShell({ facility, header, renderPanel, isOwner = false }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // The menu is role-scoped: residents never see (or can deep-link to) the
  // facility-management sections. Validating ?section= against THIS menu means a
  // resident hitting ?section=pricing falls back to their default panel.
  const menu = menuForRole(isOwner)
  const validSections = new Set(menu.filter((m) => m.section).map((m) => m.section))

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // The active section is DERIVED from the URL (?section=…) so it survives a
  // refresh and is shareable/back-button friendly. Falls back to the default when
  // the param is missing or invalid.
  const paramSection = searchParams.get('section')
  const activeSection = paramSection && validSections.has(paramSection) ? paramSection : DEFAULT_SECTION

  // The page (window) scrollbar lives on <html>, not this component's tree, so
  // tag the document with .portal-scroll while the portal is mounted to give the
  // PAGE scrollbar the emerald tint too. Cleaned up on unmount so other pages
  // keep the neutral global scrollbar.
  useEffect(() => {
    const el = document.documentElement
    el.classList.add('portal-scroll')
    return () => el.classList.remove('portal-scroll')
  }, [])

  // Sidebar click → write the section to the URL (so a refresh holds it). Close
  // the mobile drawer and scroll the panel back to the top.
  const selectSection = (section) => {
    setDrawerOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    if (section === DEFAULT_SECTION) params.delete('section')
    else params.set('section', section)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' })
  }

  // The active menu item, so the top bar / panel can show its label as a heading.
  const active = menu.find((m) => m.section === activeSection) || menu[0]

  return (
    <div className="portal-scroll min-h-[100dvh] bg-brand-surface">
      {/* Shared global header — gives the portal the same cross-page navigation
          (Facilities · Activity Hub · Community · …), the DumpMaps logo, support
          CTA, notifications, and account menu that every other page has. */}
      <AppHeader active="dashboard" />

      {/* Mobile-only sub-bar: opens the portal's section menu (the sidebar lives
          in a drawer on mobile). Desktop shows the fixed rail instead. */}
      <div className="sticky top-14 z-20 flex items-center gap-2 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          <Menu className="h-4 w-4" /> {active.label}
        </button>
      </div>

      {/* Desktop sidebar — FIXED full-height rail below the 56px top bar. It's
          taken out of the scroll flow (position:fixed), so ONLY the main content
          scrolls and the sidebar never moves or jerks. Collapses to an icon rail. */}
      <aside
        className={`fixed left-0 top-14 bottom-0 z-20 hidden flex-col border-r border-neutral-200 bg-white p-3 transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <PortalSidebar
          facility={facility}
          menu={menu}
          isOwner={isOwner}
          activeSection={activeSection}
          onNavigate={selectSection}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* Content column — offset by the fixed sidebar's width on desktop; scrolls
          with the page. */}
      <div className={`mx-auto max-w-[1400px] px-4 py-6 transition-[padding] duration-200 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <main className="min-w-0 space-y-5 pb-16">
          {header}

          {/* Section heading for the active panel */}
          <div className="flex items-center gap-2 px-0.5">
            {active.icon && <active.icon className="h-5 w-5 text-emerald-600" />}
            <h2 className="text-lg font-extrabold tracking-tight text-neutral-900">{active.label}</h2>
          </div>

          {/* The swappable panel — keyed so it re-mounts (and re-animates) per section */}
          <div key={activeSection} className="dm-rise-in space-y-5">
            {renderPanel(activeSection)}
          </div>
        </main>
      </div>

      {/* Mobile drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-4">
          <SheetTitle className="sr-only">Portal menu</SheetTitle>
          <PortalSidebar facility={facility} menu={menu} isOwner={isOwner} activeSection={activeSection} onNavigate={selectSection} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
