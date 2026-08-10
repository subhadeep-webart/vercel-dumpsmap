// time_clock_constants.js
// ---------------------------------------------------------------------------
// Constants for the Time Clock page (app/(app)/time-clock/page.js) and its
// hooks. Extracted so the page, its views, and the data/action hooks share a
// single source of truth for status colours, roles, tabs, filters, and the
// settings-form select options.

import {
  Clock, Calendar, ShieldCheck, Settings, ClipboardList,
} from 'lucide-react'

// Status pill colour classes, keyed by entry.status. Hoisted out of the row
// component so the map isn't re-created on every render.
export const STATUS_COLOR = {
  active:    'bg-emerald-100 text-emerald-800',
  completed: 'bg-neutral-200 text-neutral-700',
  submitted: 'bg-amber-100 text-amber-800',
  approved:  'bg-blue-100 text-blue-800',
  rejected:  'bg-red-100 text-red-800',
}

// Fallback for an unknown status.
export const STATUS_COLOR_FALLBACK = 'bg-neutral-100 text-neutral-700'

// Roles that unlock the manager approval queue. Checked against user.role,
// user.profileType, and the user.isManager flag.
export const MANAGER_ROLES = ['super_admin', 'admin', 'moderator', 'manager']

// KPI tile tone → colour classes. Keyed by the tile's `tone` prop.
export const KPI_TONES = {
  brand:   'text-brand-700 bg-brand-50',
  emerald: 'text-emerald-700 bg-emerald-50',
  amber:   'text-amber-700 bg-amber-50',
  red:     'text-red-700 bg-red-50',
  violet:  'text-violet-700 bg-violet-50',
}
export const KPI_TONE_FALLBACK = KPI_TONES.brand

// Main tab definitions. The 'approvals' tab is manager-gated — see managerTabs()
// below, which splices it in only when the current user is a manager.
export const BASE_TABS = [
  { key: 'today',    label: 'Today',       icon: Clock },
  { key: 'week',     label: 'Week',        icon: Calendar },
  { key: 'calendar', label: 'Calendar',    icon: Calendar },
  { key: 'entries',  label: 'All Entries', icon: ClipboardList },
]
export const APPROVALS_TAB = { key: 'approvals', label: 'Approvals', icon: ShieldCheck }
export const SETTINGS_TAB = { key: 'settings', label: 'Settings', icon: Settings }

// Build the tab list for the current user. Managers get the approvals tab; the
// settings tab always comes last.
export const managerTabs = (isManager) => [
  ...BASE_TABS,
  ...(isManager ? [APPROVALS_TAB] : []),
  SETTINGS_TAB,
]

// Status filters for the "All Entries" view.
export const ENTRY_FILTERS = ['all', 'completed', 'submitted', 'approved', 'rejected']

// Weekday column headers, Monday-first (matches the week + calendar grids).
export const WEEKDAYS_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Settings-form select options.
export const ROUNDING_OPTIONS = [
  { value: 1,  label: 'No rounding' },
  { value: 5,  label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes (quarter hour)' },
  { value: 30, label: '30 minutes (half hour)' },
]
export const ROUNDING_DIRECTIONS = [
  { value: 'nearest', label: 'Nearest (default)' },
  { value: 'up',      label: 'Always up' },
  { value: 'down',    label: 'Always down' },
]

// Default (empty) work-association form used by the clock-in and entry dialogs.
export const EMPTY_TAG_FORM = {
  jobLabel: '', workOrderLabel: '', vehicleLabel: '', facilityName: '', notes: '',
}

// Number of entries to request for the list views.
export const ENTRIES_LIMIT = 200
