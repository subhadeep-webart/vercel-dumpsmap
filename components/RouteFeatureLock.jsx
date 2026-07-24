'use client'

// RouteFeatureLock
// ---------------------------------------------------------------------------
// Drop-in client-side wrapper that gates an entire route by feature flag.
// Use this when you want to wrap a server-component page WITHOUT converting
// it to a client component. The wrapper renders the locked screen via
// <FeatureLock> when the feature isn't allowed, otherwise renders children.
//
// Usage in a server component page.js:
//   import RouteFeatureLock from '@/components/RouteFeatureLock'
//   export default function JobsPage() {
//     return (
//       <RouteFeatureLock featureKey="jobs">
//         <JobsLandingContent />
//       </RouteFeatureLock>
//     )
//   }

import React from 'react'
import FeatureLock from '@/components/FeatureLock'

export default function RouteFeatureLock({ featureKey, children }) {
  return <FeatureLock featureKey={featureKey}>{children}</FeatureLock>
}
