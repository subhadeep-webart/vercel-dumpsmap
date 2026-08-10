// receipts_constants.js
// ---------------------------------------------------------------------------
// Static config for the Receipt Center page (app/(app)/receipts/page.js) and
// its hooks. Extracted so the page, its sub-views (form + batch panel), and the
// data/action hooks share one source of truth for the payment-method and
// load-type select options, the material-type list, and the list fetch limit.

// Payment-method select options (value + label).
export const PAY_METHODS = [
  { v: 'card',    l: 'Card' },
  { v: 'cash',    l: 'Cash' },
  { v: 'check',   l: 'Check' },
  { v: 'account', l: 'Account / invoice' },
  { v: 'other',   l: 'Other' },
]

// Load-type select options (value + label).
export const LOAD_TYPES = [
  { v: 'mixed',  l: 'Mixed C&D' },
  { v: 'clean',  l: 'Clean (single material)' },
  { v: 'cnd',    l: 'C&D only' },
  { v: 'green',  l: 'Yard waste / green' },
  { v: 'metal',  l: 'Metal' },
  { v: 'other',  l: 'Other' },
]

// Material-type select options (the form's "Material type" dropdown).
export const MATERIAL_TYPES = [
  'Mixed C&D', 'Concrete', 'Wood', 'Metal', 'Green Waste', 'Cardboard',
  'E-Waste', 'Appliances', 'Furniture', 'Dirt', 'Household Junk', 'Other',
]

// How many receipts the history table requests.
export const RECEIPTS_LIMIT = 50

// Max rows a single batch upload allows.
export const BATCH_MAX_ROWS = 10
