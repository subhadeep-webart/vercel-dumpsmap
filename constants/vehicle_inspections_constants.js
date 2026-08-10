// vehicle_inspections_constants.js
// ---------------------------------------------------------------------------
// Constants shared by the Vehicle Inspections pages:
//   • app/(app)/vehicle-inspections/page.js          (list + dashboard)
//   • app/(app)/vehicle-inspections/[id]/page.js     (detail)
//   • app/(app)/vehicle-inspections/new/page.js      (create form)
// and their hooks. Extracted so the label maps, select/option lists, and the
// safety checklist definition live in a single source of truth instead of being
// re-declared (and drifting) across the three pages.

// Fuel-level value → display label. Used by the list, detail, and new-form
// (via FUEL_OPTIONS below).
export const FUEL_LABEL = { empty: 'Empty', '1_4': '¼', '1_2': '½', '3_4': '¾', full: 'Full' }

// Load-status value → display label.
export const LOAD_LABEL = { empty: 'Empty', half: 'Half full', full: 'Full' }

// Cleanliness value → display label (detail view).
export const CLEAN_LABEL = { clean: 'Clean', dirty: 'Dirty', needs_wash: 'Needs wash', needs_interior: 'Needs interior cleaning' }

// Ordered fuel levels — the pill row in the detail edit panel iterates this.
export const FUEL = ['empty', '1_4', '1_2', '3_4', 'full']

// Fuel options ({ v, l }) for the new-inspection form's fuel button rows.
export const FUEL_OPTIONS = FUEL.map((v) => ({ v, l: FUEL_LABEL[v] }))

// Load-status options for the new-inspection form's pill row.
export const LOAD_OPTIONS = [
  { v: 'empty', l: 'Empty' }, { v: 'half', l: 'Half full' }, { v: 'full', l: 'Full' },
]

// Cleanliness options for the new-inspection form's select.
export const CLEAN_OPTIONS = [
  { v: 'clean', l: 'Clean' }, { v: 'dirty', l: 'Dirty' },
  { v: 'needs_wash', l: 'Needs wash' }, { v: 'needs_interior', l: 'Needs interior cleaning' },
]

// Selectable dashboard-warning lights (new-inspection form).
export const DASH_LIGHTS = [
  'Check engine', 'Oil pressure', 'Battery', 'Brake', 'Tire pressure',
  'ABS', 'Transmission', 'Coolant', 'Other',
]

// Selectable damage locations (new-inspection form).
export const DAMAGE_LOCATIONS = [
  'Front', 'Rear', 'Driver side', 'Passenger side', 'Roof', 'Interior', 'Tires', 'Other',
]

// Safety checklist: [fieldKey, label]. Drives both the form's checkbox grid and
// the initial (all-true) checklist state.
export const CHECKLIST = [
  ['tires',           'Tires checked'],
  ['lights',          'Lights working'],
  ['brakes',          'Brakes working'],
  ['mirrors',         'Mirrors okay'],
  ['backupCamera',    'Backup camera okay'],
  ['liftgate',        'Liftgate / dump bed working'],
  ['registration',    'Registration & insurance present'],
  ['safetyEquipment', 'Safety equipment present'],
  ['firstAid',        'First aid kit present'],
  ['strapsTools',     'Straps / tools secured'],
]
