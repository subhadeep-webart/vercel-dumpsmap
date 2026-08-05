'use client'

// SignOutButton — clears the session and toasts. Self-contained so the settings
// page doesn't need the logout wiring.

import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/hooks/use-logout'

export default function SignOutButton() {
  const logout = useLogout()

  const signOut = () => {
    toast.success('Signed out')
    logout()
  }

  return (
    <Button variant="outline" onClick={signOut} className="border-red-300 text-red-700 hover:bg-red-50">
      <LogOut className="mr-2 h-4 w-4" /> Sign out
    </Button>
  )
}
