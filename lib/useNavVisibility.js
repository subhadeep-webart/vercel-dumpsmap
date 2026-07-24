'use client'

// useNavVisibility
// ---------------------------------------------------------------------------
// Lightweight helper for nav/dashboard components to decide whether to render
// or hide a link/card based on the Super Admin feature flag for that page.
//
// Built on top of /api/me/feature-access (used by useFeatureAccess) so it
// shares the same 30s cache — zero extra network traffic.
//
// Returns:
//   { ready, visible, status, lockedState, allowed, requiresApply, isSuperAdmin }
//
// `visible` is what nav code should render with — it follows these rules:
//   • Super Admin → always visible (status badge shown in UI when not 'live')
//   • status='not_active' (Hidden)  → visible=false (full disappear)
//   • status='demo'                 → visible=false for non-admin
//   • status='paused'               → visible=true (rendered as locked)
//   • status='beta' + grant         → visible=true
//   • status='beta' + no grant      → visible=false
//   • status='live' + roleAllowed   → visible=true
//   • Otherwise                     → visible=false
//
// Use `allowed` if you want to know whether the user can actually USE the
// feature (vs just see the tab). `lockedState` carries the same semantics
// returned by canAccessFeature for inline pause badges.

import { useFeatureAccess } from '@/lib/useFeatureAccess'

// Compute "should this nav link/card render?" from a canAccessFeature result.
// `allowed`/`reason`/`status`/`lockedState` follow the schema from
// lib/feature-control.js. Returns true if the user should see the entry
// (either active or paused/read-only). Returns false if the feature is
// hidden, demo (non-admin), beta (no grant), or auth required.
function computeVisible({ allowed, reason, status, lockedState }) {
  if (reason === 'super_admin') return true
  if (status === 'not_active') return false
  if (status === 'demo') return false
  if (status === 'paused') return true                  // visible as locked
  if (status === 'beta' && !allowed) return false       // no grant
  if (status === 'live' && allowed) return true
  if (status === 'live' && !allowed) {
    // Role/tier mismatch → hide from nav (user wouldn't pass on click).
    // But auth_required → still show (encourage sign-in).
    return lockedState === 'auth'
  }
  return !!allowed
}

export function useNavVisibility(featureKey) {
  const fa = useFeatureAccess(featureKey)
  // While loading, treat as visible so the nav doesn't flicker. Components
  // already handle the locked-screen on direct route entry via <FeatureLock>.
  if (fa.loading) {
    return {
      ready: false, visible: true, allowed: false, status: 'loading',
      lockedState: null, isSuperAdmin: false,
    }
  }
  return {
    ready: true,
    visible: computeVisible(fa),
    allowed: !!fa.allowed,
    status: fa.status,
    lockedState: fa.lockedState,
    requiresApply: !!fa.requiresApply,
    isSuperAdmin: fa.reason === 'super_admin',
  }
}
