// Shared label helpers for facility cards/rows.
//
// Extracted from HomeShell.jsx so FacilityRow (and any future facility card)
// can format pricing/extras keys without importing the whole shell.

// Convert camelCase pricing/extras key → "Camel Case" human label
export function humanLabel(k) {
  if (k === 'pricePerPound') return '$/lb'
  if (k === 'pricePerTon') return '$/ton'
  if (k === 'pricePerItem') return '$/item'
  if (k === 'crvRate') return 'CRV'
  if (k === 'minimumCharge') return 'Min charge'
  if (k === 'minimumWeight') return 'Min weight'
  if (k === 'paymentMethods') return 'Pays'
  if (k === 'scaleInRequired') return 'Scale required'
  if (k === 'coveredLoadRequired') return 'Covered load required'
  if (k === 'cleanLoadDiscount') return 'Clean load discount'
  if (k === 'mixedLoadSurcharge') return 'Mixed load surcharge'
  if (k === 'idRequired') return 'ID required'
  if (k === 'donationReceipt') return 'Receipt available'
  if (k === 'pickupAvailable') return 'Pickup available'
  if (k === 'appointmentRequired') return 'Appointment required'
  if (k === 'businessAccepted') return 'Business accepted'
  if (k === 'residentialOnly') return 'Residential only'
  if (k === 'free') return 'Free drop-off'
  if (k === 'paidDisposal') return 'Paid disposal'
  if (k === 'paid') return 'Paid'
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}
