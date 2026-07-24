'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Shield } from 'lucide-react'

export default function MaintenanceGate({ user, children }) {
  const [settings, setSettings] = useState(null)
  useEffect(() => {
    fetch('/api/platform-settings/public').then((r) => r.json()).then((j) => setSettings(j.settings)).catch(() => {})
  }, [])

  const isStaff = ['super_admin', 'admin', 'moderator'].includes(user?.role)

  if (settings?.maintenanceMode && !isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-900 p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20">
            <AlertTriangle className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-white">We’ll be right back</h1>
          <p className="mt-2 text-sm text-neutral-300">
            {settings.maintenanceMessage || 'DumpMaps is briefly down for maintenance. Thanks for your patience.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-1 text-xs text-neutral-500">
            <Shield className="h-3 w-3" /> Staff can sign in via /admin
          </div>
        </div>
      </div>
    )
  }

  return children
}
