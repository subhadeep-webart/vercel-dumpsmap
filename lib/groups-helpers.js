// groups-helpers.js
// ---------------------------------------------------------------------------
// Pure helper functions for the community Groups pages. These were inlined in
// app/community/groups/page.js (query-string building for the list filter, the
// create-form payload shaping) and app/community/groups/[id]/page.js (the
// organizer / staff role derivations). Hoisting them keeps the page and hook
// code focused and lets both the read hooks and the pages share one copy.
//
// Everything here is pure (no React, no I/O): same input → same output.

import { STAFF_ROLES, GROUPS_LIMIT } from '@/constants/groups_constants'

// --- List query ------------------------------------------------------------

// Build the query string for the groups list request from the filter state.
// Only non-empty filters are appended; the limit is always set.
export function buildGroupsQuery(filter = {}) {
  const p = new URLSearchParams()
  if (filter.city) p.set('city', filter.city)
  if (filter.category) p.set('category', filter.category)
  if (filter.q) p.set('q', filter.q)
  if (filter.mine) p.set('mine', 'true')
  p.set('limit', String(GROUPS_LIMIT))
  return p.toString()
}

// --- Create-group form ------------------------------------------------------

// Shape the raw create-group form values into the API payload: comma-separated
// tags and newline-separated rules become trimmed, empty-filtered arrays.
export function buildCreateGroupPayload(values) {
  return {
    ...values,
    tags: (values.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    rules: (values.rules || '').split('\n').map((r) => r.trim()).filter(Boolean),
  }
}

// --- Role derivations -------------------------------------------------------

// Is the current user an organizer of this group (group admin or the owner)?
export function isGroupOrganizer(group, user) {
  if (!group) return false
  return group.myRole === 'group_admin' || group.ownerId === user?.id
}

// Is the current user platform staff (can moderate any group)?
export function isStaffUser(user) {
  return !!user && STAFF_ROLES.includes(user.role)
}
