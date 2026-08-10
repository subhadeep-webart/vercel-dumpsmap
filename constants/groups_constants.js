// groups_constants.js
// ---------------------------------------------------------------------------
// Constants for the community Groups pages (app/community/groups/page.js and
// app/community/groups/[id]/page.js) and their hooks. Both pages hardcoded
// their own group-category lists (the list page as an array, the detail page as
// a label map); hoisting them here gives the list, the detail view, the create
// dialog, and the category chips a single source of truth.

// Ordered category list for the browse chips and the create-group picker.
export const GROUP_CATEGORIES = [
  { key: 'haulers',     label: 'Haulers' },
  { key: 'cleanup',     label: 'Cleanup Crew' },
  { key: 'reuse',       label: 'Reuse / Free' },
  { key: 'contractors', label: 'Contractors' },
  { key: 'recycling',   label: 'Recycling' },
  { key: 'property',    label: 'Property Mgmt' },
  { key: 'scrap',       label: 'Scrap Metal' },
  { key: 'donation',    label: 'Donation Network' },
  { key: 'agency',      label: 'Agency / Public' },
  { key: 'general',     label: 'General' },
]

// key → category lookup, used to resolve a group's category label/meta.
export const CAT_BY_KEY = Object.fromEntries(GROUP_CATEGORIES.map((c) => [c.key, c]))

// Detail-page label overrides. The group detail header historically shows a
// couple of shorter labels than the browse list (e.g. "Agency" instead of
// "Agency / Public"). Kept as an explicit override so the shared list stays the
// single source of ordering while these exact labels are preserved.
export const CAT_DETAIL_LABELS = {
  ...Object.fromEntries(GROUP_CATEGORIES.map((c) => [c.key, c.label])),
  agency: 'Agency',
}
export const CAT_DETAIL_BY_KEY = Object.fromEntries(
  Object.entries(CAT_DETAIL_LABELS).map(([key, label]) => [key, { label }]),
)

// Tabs on the group detail page.
export const GROUP_TABS = ['feed', 'chat', 'members']

// Staff roles that can moderate any group (remove members, open settings).
export const STAFF_ROLES = ['super_admin', 'admin', 'moderator']

// Number of groups requested for the list view.
export const GROUPS_LIMIT = 60

// Number of posts / members requested on the detail page.
export const GROUP_POSTS_LIMIT = 60
export const GROUP_MEMBERS_LIMIT = 100

// Empty create-group form. The category picker is a button grid registered
// manually via react-hook-form's setValue/watch, so it starts blank here.
export const GROUP_FORM_DEFAULTS = {
  name: '', category: '', description: '', city: '', state: 'CA', tags: '', photoUrl: '', rules: '',
}
