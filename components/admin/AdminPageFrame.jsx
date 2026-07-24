'use client'

/**
 * AdminPageFrame — modern SaaS freeze-pane layout for admin pages.
 *
 * Use this for any admin page that has a scrollable list/table where the
 * page-level header, KPI cards, and filter/toolbar must stay visible while
 * only the records list scrolls.
 *
 * Structure:
 *   <AdminPageFrame>
 *     <AdminPageFrame.Header>...page title + breadcrumbs...</AdminPageFrame.Header>   (fixed)
 *     <AdminPageFrame.Kpis>...metric cards...</AdminPageFrame.Kpis>                   (fixed)
 *     <AdminPageFrame.Toolbar>...tabs / filter row...</AdminPageFrame.Toolbar>        (fixed)
 *     <AdminPageFrame.Body>...table/list — scrolls inside its own panel...</AdminPageFrame.Body>
 *   </AdminPageFrame>
 *
 * Visual rules:
 *   - Frame fills available height (min-h-0 + flex-col + overflow-hidden)
 *   - Header/Kpis/Toolbar are shrink-0 so they never collapse
 *   - Body grows to fill remaining space and owns its own scroll
 *
 * Mobile: same behavior. Bottom drawer for filters can be added per-page.
 */

import React from 'react'

function Frame({ children, className = '' }) {
  return (
    <div data-admin-frame className={`flex h-full min-h-0 flex-col overflow-hidden bg-neutral-50 ${className}`}>
      {children}
    </div>
  )
}

function Header({ children, className = '' }) {
  return (
    <div className={`shrink-0 border-b border-neutral-200 bg-white px-4 py-3 md:px-6 md:py-4 ${className}`}>
      {children}
    </div>
  )
}

function Kpis({ children, className = '' }) {
  return (
    <div className={`shrink-0 border-b border-neutral-200 bg-white px-4 py-3 md:px-6 ${className}`}>
      {children}
    </div>
  )
}

function Toolbar({ children, className = '' }) {
  return (
    <div className={`shrink-0 border-b border-neutral-200 bg-white px-4 py-2.5 md:px-6 ${className}`}>
      {children}
    </div>
  )
}

function Body({ children, className = '' }) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-3 md:px-6 ${className}`}>
      {children}
    </div>
  )
}

/**
 * BodyTable — for the common pattern of a table with sticky column headers.
 * The thead row stays glued to the top of the scrolling body.
 */
function BodyTable({ children, header, className = '' }) {
  return (
    <div className={`min-h-0 flex-1 overflow-hidden px-4 pt-3 md:px-6 ${className}`}>
      <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-200 bg-white">
        {header && (
          <div className="shrink-0 border-b border-neutral-200 bg-neutral-50">
            {header}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

Frame.Header = Header
Frame.Kpis = Kpis
Frame.Toolbar = Toolbar
Frame.Body = Body
Frame.BodyTable = BodyTable

export default Frame
