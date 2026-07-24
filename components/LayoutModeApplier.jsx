'use client'

// LayoutModeApplier — pure side-effect component that has zero render output.
// We keep it separate so the provider remains a pure data container while the
// DOM-touching effect (data-forced-layout attr + viewport meta override) is
// scoped to one client component mounted under <LayoutModeProvider>.
//
// Currently all DOM effects live inside the provider, so this component is
// reserved for future expansions (e.g. body-class toggling for analytics).

import React from 'react'

export default function LayoutModeApplier() {
  return null
}
