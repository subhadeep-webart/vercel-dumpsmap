// Facility-type configuration.
// Drives both the Submit Facility form (which fields show) and the facility card preview
// (which details get rendered). Edit values here to add/rename categories or change tags.

export const FACILITY_TYPE_CONFIG = {
  crv: {
    value: 'crv',
    label: 'CRV / Buyback Center',
    icon: '💵',
    helper: 'CA Redemption Value redemption — typically aluminum cans, plastic & glass bottles. May also buy back scrap metal.',
    accepted: [
      'Aluminum cans', 'Plastic bottles', 'Glass bottles', 'Scrap aluminum',
      'Copper', 'Brass', 'Stainless steel', 'Tin', 'Cardboard',
    ],
    pricing: ['pricePerPound', 'pricePerItem', 'crvRate', 'minimumWeight', 'paymentMethods', 'dailyLimits'],
    extras: ['idRequired'],
    defaultTags: ['CRV', 'buyback', 'cans', 'bottles', 'aluminum', 'pays cash'],
    cardFields: ['accepted', 'pricePerPound', 'crvRate', 'paymentMethods', 'hours'],
  },
  donation: {
    value: 'donation',
    label: 'Donation Center / Thrift Store',
    icon: '🎁',
    helper: 'Non-profit drop-off for clothing, household goods, and furniture. Donation receipts usually available.',
    accepted: [
      'Clothing', 'Shoes', 'Toys', 'Books', 'Home decor', 'Small furniture',
      'Bulky furniture', 'Electronics', 'Kitchenware', 'Mattresses', 'Appliances',
    ],
    pricing: ['free'],
    extras: ['donationReceipt', 'pickupAvailable', 'appointmentRequired', 'currentNeeds'],
    defaultTags: ['donation accepted', 'thrift', 'reuse', 'free drop-off', 'receipt available'],
    cardFields: ['accepted', 'currentNeeds', 'donationReceipt', 'appointmentRequired', 'hours'],
  },
  recycling: {
    value: 'recycling',
    label: 'Recycling Center',
    icon: '♻️',
    helper: 'General recycling drop-off. Some materials may have fees; some buyback rates may apply.',
    accepted: [
      'Cardboard', 'Paper', 'Plastic', 'Glass', 'Metal', 'Aluminum',
      'E-waste', 'Appliances', 'Batteries', 'Mattresses', 'Green waste',
    ],
    pricing: ['free', 'paidDisposal', 'pricePerTon', 'pricePerPound', 'pricePerItem'],
    extras: [],
    defaultTags: ['recycling', 'free drop-off'],
    cardFields: ['accepted', 'free', 'paidDisposal', 'pricePerTon', 'hours'],
  },
  scrap_yard: {
    value: 'scrap_yard',
    label: 'Scrap Yard',
    icon: '🔧',
    helper: 'Buys scrap metal by weight. Most pay cash or check; ID usually required.',
    accepted: [
      'Copper', 'Brass', 'Aluminum', 'Stainless steel', 'Steel', 'Iron',
      'Appliances', 'Motors', 'Wire', 'Batteries', 'Catalytic converters',
    ],
    pricing: ['pricePerPound', 'materialRates', 'paymentMethods', 'minimumWeight'],
    extras: ['idRequired'],
    defaultTags: ['scrap', 'metal', 'pays cash', 'contractor-friendly', 'buyback'],
    cardFields: ['accepted', 'pricePerPound', 'paymentMethods', 'idRequired', 'hours'],
  },
  transfer_station: {
    value: 'transfer_station',
    label: 'Landfill / Transfer Station',
    icon: '🚚',
    helper: 'Paid disposal of mixed loads. Scale-in / scale-out typically required; covered loads often discounted.',
    accepted: [
      'Mixed debris', 'Construction debris', 'Concrete', 'Dirt', 'Wood',
      'Green waste', 'Furniture', 'Mattresses', 'Appliances', 'Household junk',
    ],
    pricing: ['pricePerTon', 'minimumCharge', 'scaleInRequired', 'sortingFees', 'surgeFees', 'coveredLoadRequired'],
    extras: [],
    defaultTags: ['paid disposal', 'per ton', 'scale required', 'contractor-friendly'],
    cardFields: ['accepted', 'pricePerTon', 'minimumCharge', 'scaleInRequired', 'coveredLoadRequired', 'hours'],
  },
  ewaste: {
    value: 'ewaste',
    label: 'E-Waste Center',
    icon: '💻',
    helper: 'Electronics recycling — TVs, monitors, computers. Often free for residents; businesses may pay per pound.',
    accepted: [
      'TVs', 'Monitors', 'Computers', 'Laptops', 'Printers', 'Phones',
      'Cables', 'Batteries', 'Small electronics', 'Appliances',
    ],
    pricing: ['free', 'paid', 'pricePerItem', 'pricePerPound'],
    extras: ['businessAccepted', 'residentialOnly'],
    defaultTags: ['e-waste', 'electronics', 'free drop-off'],
    cardFields: ['accepted', 'free', 'pricePerItem', 'businessAccepted', 'hours'],
  },
  reuse: {
    value: 'reuse',
    label: 'Reuse Center',
    icon: '🛠️',
    helper: 'Accepts reusable building materials and household goods for resale at low prices (Habitat ReStore, etc.).',
    accepted: [
      'Building materials', 'Fixtures', 'Cabinets', 'Doors', 'Windows',
      'Lumber', 'Tools', 'Furniture', 'Appliances', 'Home goods',
    ],
    pricing: ['free', 'donationReceipt'],
    extras: ['donationReceipt', 'pickupAvailable', 'appointmentRequired', 'qualityRequirements', 'currentNeeds'],
    defaultTags: ['reuse', 'salvage', 'building materials', 'donation accepted', 'resale'],
    cardFields: ['accepted', 'currentNeeds', 'donationReceipt', 'pickupAvailable', 'hours'],
  },
  construction: {
    value: 'construction',
    label: 'Construction Debris Facility',
    icon: '🏗️',
    helper: 'Specialized C&D facility — clean loads typically discounted, mixed loads incur surcharge.',
    accepted: [
      'Concrete', 'Asphalt', 'Dirt', 'Tile', 'Drywall', 'Lumber',
      'Metal', 'Roofing', 'Pallets', 'Fixtures',
    ],
    pricing: ['pricePerTon', 'minimumCharge', 'cleanLoadDiscount', 'mixedLoadSurcharge', 'scaleInRequired'],
    extras: [],
    defaultTags: ['construction debris', 'contractor-friendly', 'per ton', 'clean load', 'paid disposal'],
    cardFields: ['accepted', 'pricePerTon', 'minimumCharge', 'cleanLoadDiscount', 'hours'],
  },
}

// Pricing field metadata
export const PRICING_FIELDS = {
  pricePerPound:        { label: 'Price per pound ($/lb)',         placeholder: '0.85',   kind: 'text' },
  pricePerItem:         { label: 'Price per item ($)',             placeholder: '5',      kind: 'text' },
  pricePerTon:          { label: 'Price per ton ($)',              placeholder: '95',     kind: 'text' },
  crvRate:              { label: 'CRV rate (e.g. $0.05/can)',      placeholder: '$0.05',  kind: 'text' },
  minimumWeight:        { label: 'Minimum weight (lb)',            placeholder: '5',      kind: 'text' },
  minimumCharge:        { label: 'Minimum charge ($)',             placeholder: '25',     kind: 'text' },
  paymentMethods:       { label: 'Payment methods',                kind: 'multi', options: ['Cash', 'Check', 'Card', 'ACH', 'Venmo / Zelle'] },
  dailyLimits:          { label: 'Daily / monthly limits',         placeholder: '50 lb aluminum/day', kind: 'text' },
  materialRates:        { label: 'Material-specific rates (notes)',placeholder: 'Cu #1 $3.20/lb · Al cans $0.60/lb', kind: 'textarea' },
  sortingFees:          { label: 'Sorting / cleanup fees ($)',     placeholder: '15/ton mixed', kind: 'text' },
  surgeFees:            { label: 'Surge / peak fees',              placeholder: 'Mon AM +$10', kind: 'text' },
  cleanLoadDiscount:    { label: 'Clean load discount',            placeholder: '20% off clean concrete', kind: 'text' },
  mixedLoadSurcharge:   { label: 'Mixed load surcharge',           placeholder: '+$15/ton mixed', kind: 'text' },
  free:                 { label: 'Free drop-off available',        kind: 'bool' },
  paid:                 { label: 'Paid drop-off',                  kind: 'bool' },
  paidDisposal:         { label: 'Paid disposal',                  kind: 'bool' },
  scaleInRequired:      { label: 'Scale-in / scale-out required',  kind: 'bool' },
  coveredLoadRequired:  { label: 'Covered load required',          kind: 'bool' },
}

// Extra-field metadata
export const EXTRA_FIELDS = {
  donationReceipt:      { label: 'Donation receipt available',     kind: 'bool' },
  pickupAvailable:      { label: 'Pickup service available',       kind: 'bool' },
  appointmentRequired:  { label: 'Appointment required',           kind: 'bool' },
  currentNeeds:         { label: 'Currently needed items',         placeholder: 'Winter coats, twin mattresses, kitchenware…', kind: 'textarea' },
  idRequired:           { label: 'Government ID required',         kind: 'bool' },
  businessAccepted:     { label: 'Business drop-off accepted',     kind: 'bool' },
  residentialOnly:      { label: 'Residential only',               kind: 'bool' },
  qualityRequirements:  { label: 'Quality / condition requirements',placeholder: 'No broken items; cabinets must be intact',  kind: 'textarea' },
}

// ------------------------------------------------------------
// NOT-ACCEPTED presets (per facility type)
// Haulers care about restrictions just as much as accepted material lists.
// ------------------------------------------------------------
export const NOT_ACCEPTED_PRESETS = {
  crv: ['Non-CRV containers', 'Hazardous waste', 'Broken glass', 'Contaminated containers', 'Plastic bags'],
  donation: ['Stained/torn clothing', 'Broken furniture', 'Mattresses', 'Hazardous waste', 'Large appliances', 'Tube TVs'],
  recycling: ['Hazardous waste', 'Wet materials', 'Mixed loads', 'Mattresses', 'Tires', 'Asbestos', 'Paint'],
  scrap_yard: ['Sealed tanks', 'Hazardous waste', 'Radioactive material', 'Asbestos', 'Refrigerators w/ freon'],
  transfer_station: ['Hazardous waste', 'Tires', 'Asbestos', 'Refrigerators w/ freon', 'Liquids', 'Wet materials', 'Medical waste'],
  ewaste: ['Large appliances', 'Hazardous waste', 'Items w/ freon', 'Batteries (lead-acid)', 'Light bulbs'],
  reuse: ['Broken items', 'Stained items', 'Hazardous materials', 'Mattresses', 'Tube TVs', 'Wet materials'],
  construction: ['Hazardous waste', 'Asbestos', 'Treated wood', 'Wet materials', 'Mixed household trash', 'Mattresses'],
}

// ------------------------------------------------------------
// Current operational STATUS options (community-reported)
// ------------------------------------------------------------
export const FACILITY_STATUS_OPTIONS = [
  { value: 'open',                label: 'Open',                          color: 'green',  icon: '🟢' },
  { value: 'closed',              label: 'Closed',                        color: 'red',    icon: '🔴' },
  { value: 'full',                label: 'Full / Turning away loads',     color: 'red',    icon: '⛔' },
  { value: 'moving_fast',         label: 'Moving Fast',                   color: 'green',  icon: '⚡' },
  { value: 'long_wait',           label: 'Long Wait',                     color: 'amber',  icon: '⏳' },
  { value: 'appointment',         label: 'Appointment Required',          color: 'blue',   icon: '📅' },
  { value: 'scale_down',          label: 'Scale Down',                    color: 'red',    icon: '⚠️' },
  { value: 'partial_accept',      label: 'Not Accepting Certain Materials', color: 'amber', icon: '🚫' },
]

export function getStatusMeta(value) {
  return FACILITY_STATUS_OPTIONS.find((s) => s.value === value) || null
}

// ------------------------------------------------------------
// Contractor notes — pre-set checkboxes haulers want to know
// ------------------------------------------------------------
export const CONTRACTOR_NOTE_PRESETS = [
  'Tight access',
  'Covered load required',
  'Attendant strict',
  'Cash only',
  'Card accepted',
  'Best time AM',
  'Best time PM',
  'Scale closes early',
  'No box trucks over 20 ft',
  'No commercial vehicles',
  'No after-hours drop',
  'Tarping enforced',
  'Manifest required',
  'Tipping floor only',
  'Sort on arrival',
  'Walk-in customers OK',
]

// ------------------------------------------------------------
// Auto-generate searchable tags from a facility submission
// ------------------------------------------------------------
export function buildAutoTags({ typeKey, accepted = [], notAccepted = [], pricingFields = {}, extraFields = {}, currentStatus = '', contractorNotes = [] } = {}) {
  const config = typeKey ? FACILITY_TYPE_CONFIG[typeKey] : null
  const tagSet = new Set()

  // 1. defaults from type
  if (config?.defaultTags) config.defaultTags.forEach((t) => tagSet.add(t))

  // 2. accepted materials → lowercased tags
  accepted.forEach((m) => tagSet.add(String(m).toLowerCase()))

  // 3. pricing → derived tags
  if (pricingFields.free === true) tagSet.add('free drop-off')
  if (pricingFields.paid === true || pricingFields.paidDisposal === true) tagSet.add('paid disposal')
  if (pricingFields.pricePerTon) tagSet.add('per ton')
  if (pricingFields.pricePerPound) tagSet.add('per pound')
  if (pricingFields.pricePerItem) tagSet.add('per item')
  if (pricingFields.crvRate) tagSet.add('CRV rate')
  if (pricingFields.scaleInRequired) tagSet.add('scale required')
  if (pricingFields.coveredLoadRequired) tagSet.add('covered load required')
  if (pricingFields.cleanLoadDiscount) tagSet.add('clean load discount')
  if (pricingFields.mixedLoadSurcharge) tagSet.add('mixed load surcharge')
  if (Array.isArray(pricingFields.paymentMethods)) {
    if (pricingFields.paymentMethods.includes('Cash')) tagSet.add('pays cash')
    if (pricingFields.paymentMethods.includes('Card')) tagSet.add('accepts card')
  }

  // 4. extras
  if (extraFields.donationReceipt) tagSet.add('receipt available')
  if (extraFields.pickupAvailable) tagSet.add('pickup available')
  if (extraFields.appointmentRequired) tagSet.add('appointment required')
  if (extraFields.idRequired) tagSet.add('ID required')
  if (extraFields.businessAccepted) tagSet.add('business accepted')
  if (extraFields.residentialOnly) tagSet.add('residential only')

  // 5. status snapshot
  if (currentStatus) {
    const meta = getStatusMeta(currentStatus)
    if (meta) tagSet.add(meta.label.toLowerCase())
  }

  // 6. contractor notes → lowercased tags
  contractorNotes.forEach((n) => tagSet.add(String(n).toLowerCase()))

  // 7. restrictions → searchable as "no <material>"
  notAccepted.forEach((m) => tagSet.add(`no ${String(m).toLowerCase()}`))

  return Array.from(tagSet)
}

export function getFacilityTypeConfig(typeValue) {
  return FACILITY_TYPE_CONFIG[typeValue] || null
}

export const FACILITY_TYPE_OPTIONS = Object.values(FACILITY_TYPE_CONFIG).map((c) => ({
  value: c.value,
  label: c.label,
  icon: c.icon,
}))
