// app_constants.js
// ---------------------------------------------------------------------------
// Global, app-wide constants shared across pages. Page-specific constants live
// in their own file in this folder (e.g. business_constants.js).

// Brand / product
export const APP_NAME = 'DumpMaps'
export const SUPPORT_EMAIL = 'contact@webart.technology'

// localStorage key holding the auth JWT. Single source of truth so logout and
// token reads never drift apart.
export const AUTH_TOKEN_KEY = 'dm_token'

// API endpoints used from the client.
export const API_ROUTES = {
  businessInquiry: '/api/business-inquiry',
}

// Shared copy reused across marketing pages.
export const RESPONSE_TIME_COPY = "We'll be in touch within 1 business day."
