'use client'

// Mobile bottom navigation for HomeShell (feed-first architecture):
// Home / Community / + Post / Jobs / Alerts / Profile. Hidden at md+ where the
// SiteHeader primary nav takes over. Extracted from HomeShell.jsx.

import { Activity, Users, Plus, Briefcase, Bell, User as UserIcon } from 'lucide-react'
import { BottomNavBtn } from '@/components/home/ShellControls'

export default function HomeBottomNav({
  tab,
  setTab,
  user,
  unread,
  onPost,
  onAlerts,
  onProfile,
  onLogin,
}) {
  return (
    <nav className="z-30 grid flex-none grid-cols-6 items-stretch gap-0.5 border-t border-neutral-200 bg-white px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 md:hidden">
      <BottomNavBtn active={tab === 'feed'} onClick={() => setTab('feed')} icon={Activity} label="Home" />
      <BottomNavBtn active={false} onClick={() => { window.location.href = '/community' }} icon={Users} label="Community" />
      <button
        onClick={onPost}
        className="flex flex-col items-center justify-center"
        aria-label="Post"
      >
        <span className="-mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-md shadow-brand-600/30 active:scale-95">
          <Plus className="h-6 w-6" />
        </span>
        <span className="-mt-0.5 text-[10px] font-semibold text-neutral-700">Post</span>
      </button>
      <BottomNavBtn active={tab === 'jobs'} onClick={() => setTab('jobs')} icon={Briefcase} label="Jobs" />
      <button
        onClick={() => (user ? onAlerts?.() : onLogin?.())}
        className="relative flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[10px] font-semibold text-neutral-600 active:bg-neutral-100"
        aria-label="Alerts"
      >
        <Bell className="h-5 w-5 text-neutral-500" />
        Alerts
        {unread > 0 && (
          <span className="absolute right-3 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <button
        onClick={() => (user ? onProfile?.() : onLogin?.())}
        className="relative flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[10px] font-semibold text-neutral-600 active:bg-neutral-100"
        aria-label="Profile"
      >
        {user ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[10px] font-bold text-white">
            {(user.name || user.email || '?')[0].toUpperCase()}
          </span>
        ) : (
          <UserIcon className="h-5 w-5 text-neutral-500" />
        )}
        Profile
      </button>
    </nav>
  )
}
