// profile_constants.js
// ---------------------------------------------------------------------------
// Constants for the unified Profile editor (app/profile/page.js) and its
// components/profile/ pieces. Extracted so the page and its tab components
// share a single source of truth for availability, payment, and tab config.

import {
  User, MapPin, Image as ImageIcon, Briefcase, Wallet, Sparkles,
  CircleCheck, Clock, CircleSlash, Ban, CreditCard, Landmark, Banknote,
  Smartphone, FileText, Receipt, DollarSign, ShieldCheck, Lock, CheckCircle2,
} from 'lucide-react'

// Availability options — the status pill on the hero + the Preferences picker.
export const AVAILABILITY_OPTIONS = [
  { value: 'available',     label: 'Available',          Icon: CircleCheck, tone: 'bg-green-100 text-green-800 border-green-300',       desc: 'Open for work, jobs, calls' },
  { value: 'busy',          label: 'Busy',               Icon: Clock,       tone: 'bg-amber-100 text-amber-900 border-amber-300',       desc: 'On a job, limited availability' },
  { value: 'offline',       label: 'Offline',            Icon: CircleSlash, tone: 'bg-red-100 text-red-800 border-red-300',             desc: 'Off the clock' },
  { value: 'not_accepting', label: 'Not Accepting Work', Icon: Ban,         tone: 'bg-neutral-200 text-neutral-700 border-neutral-300', desc: 'Pausing new requests' },
]

// Payment method options — the toggles in the Payments tab.
export const PAYMENT_OPTIONS = [
  { value: 'stripe',  label: 'Stripe',   Icon: CreditCard },
  { value: 'paypal',  label: 'PayPal',   Icon: Wallet },
  { value: 'cashapp', label: 'Cash App', Icon: Banknote },
  { value: 'zelle',   label: 'Zelle',    Icon: Landmark },
  { value: 'venmo',   label: 'Venmo',    Icon: Smartphone },
  { value: 'check',   label: 'Check',    Icon: FileText },
  { value: 'cash',    label: 'Cash',     Icon: DollarSign },
  { value: 'other',   label: 'Other',    Icon: Receipt },
]

// Top tab bar configuration for the profile editor.
export const TABS = [
  { key: 'personal',     label: 'Personal Info', icon: User },
  { key: 'business',     label: 'Business Info', icon: Briefcase },
  { key: 'payment',      label: 'Payment',       icon: Wallet },
  { key: 'service-area', label: 'Service Area',  icon: MapPin },
  { key: 'documents',    label: 'Documents',     icon: ImageIcon },
  { key: 'preferences',  label: 'Preferences',   icon: Sparkles },
]

// Default notification preferences applied when the user record has none yet.
// Hoisted out of the bootstrap effect so it isn't re-created on every load.
export const DEFAULT_NOTIFICATIONS = {
  email: true,
  sms: false,
  push: true,
  newJobs: true,
  newBounties: true,
  rewardsEarned: true,
  workOrderUpdates: true,
}

// Document upload categories rendered as tiles in the Documents tab.
export const DOCUMENT_CATEGORIES = [
  { key: 'drivers_license',       label: "Driver's License",      icon: User },
  { key: 'contractor_license',    label: 'Contractor License',    icon: Briefcase },
  { key: 'insurance_certificate', label: 'Insurance Certificate', icon: ShieldCheck },
  { key: 'w9',                    label: 'W9 Form',               icon: Lock },
  { key: 'business_logo',         label: 'Business Logo',         icon: ImageIcon },
  { key: 'certification',         label: 'Certifications',        icon: CheckCircle2 },
]
