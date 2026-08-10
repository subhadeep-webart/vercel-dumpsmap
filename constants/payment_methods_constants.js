// payment_methods_constants.js
// ---------------------------------------------------------------------------
// Constants for the Payment Methods page (app/settings/payment-methods/page.js)
// and its data/action hooks. Extracted so the page, its saved-card rows, and the
// helpers share a single source of truth for the card-brand label map and the
// login return path.

// Stripe card brand → display label. Hoisted out of the helper module so the map
// isn't re-created on every brandLabel() call.
export const CARD_BRAND_LABELS = {
  visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover',
  diners: 'Diners', jcb: 'JCB', unionpay: 'UnionPay', unknown: 'Card', card: 'Card',
}

// Where to send an unauthenticated visitor. Used both by the pre-fetch redirect
// and the "no user" branch after /auth/me.
export const LOGIN_RETURN_TO = '/?login=1&returnTo=/settings/payment-methods'
