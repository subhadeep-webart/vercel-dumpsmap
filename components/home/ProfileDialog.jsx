'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Navigation, BadgeCheck, User as UserIcon, LogOut } from 'lucide-react'
import { AlertCard } from '@/components/AlertSystem'
import PhotoUploader from '@/components/PhotoUploader'
import ProfileTypeCard from '@/components/home/ProfileTypeCard'
import { PROFILE_TYPES } from '@/components/home/home-facility-meta'

// ---------- Profile Dialog ----------
export default function ProfileDialog({ open, onOpenChange, user, onUpdated, onLogout }) {
  const [contributions, setContributions] = useState({ alerts: [], reviews: [], submissions: [], favoriteIds: [] })
  const [favorites, setFavorites] = useState([])
  const [name, setName] = useState(user?.name || '')
  const [avatar, setAvatar] = useState(user?.avatarUrl ? [{ url: user.avatarUrl }] : [])

  const loadAll = () => {
    fetch('/api/users/me/contributions')
      .then((r) => r.json())
      .then(setContributions)
    fetch('/api/favorites')
      .then((r) => r.json())
      .then((j) => setFavorites(j.favorites || []))
  }

  useEffect(() => {
    if (!open || !user) return
    setName(user.name || '')
    loadAll()
  }, [open, user])

  const save = async () => {
    const r = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const j = await r.json()
    if (j.user) {
      toast.success('Profile updated')
      onUpdated?.(j.user)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-brand-600" /> {user.name}
            <Badge className="ml-1 bg-amber-100 text-amber-900 hover:bg-amber-100">Karma · {user.karma || 0}</Badge>
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="profiles" className="pt-2">
          <TabsList className="flex-wrap">
            <TabsTrigger value="profiles">Profile types</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="favorites">Favorites ({favorites.length})</TabsTrigger>
            <TabsTrigger value="alerts">My alerts ({contributions.alerts.length})</TabsTrigger>
            <TabsTrigger value="submissions">Submissions ({contributions.submissions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="profiles" className="space-y-3 pt-4">
            <p className="text-sm text-neutral-600">
              Pick all the ways you use DumpMaps. Your <b>primary</b> profile controls smart defaults on the map.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROFILE_TYPES.map((pt) => {
                const selected = (user.profileTypes || []).includes(pt.key)
                const isPrimary = user.primaryProfile === pt.key
                return (
                  <ProfileTypeCard
                    key={pt.key}
                    pt={pt}
                    selected={selected}
                    isPrimary={isPrimary}
                    onClick={async () => {
                      const r = await fetch('/api/auth/profile-types', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(selected ? { remove: pt.key } : { add: pt.key }),
                      })
                      const j = await r.json()
                      if (j.user) {
                        toast.success(selected ? `Removed ${pt.title}` : `Added ${pt.title}`)
                        onUpdated?.(j.user)
                      }
                    }}
                    onMakePrimary={async () => {
                      const r = await fetch('/api/auth/profile-types', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ primary: pt.key }),
                      })
                      const j = await r.json()
                      if (j.user) {
                        toast.success(`${pt.title} is now your primary profile`)
                        onUpdated?.(j.user)
                      }
                    }}
                  />
                )
              })}
            </div>
            {user.primaryProfile && (
              <Card className="border-brand-200 bg-brand-50/60">
                <CardContent className="space-y-1 pt-4 text-sm">
                  <div className="font-semibold text-neutral-900">
                    {PROFILE_TYPES.find((p) => p.key === user.primaryProfile)?.title} toolkit:
                  </div>
                  <ul className="ml-4 list-disc text-neutral-700">
                    {PROFILE_TYPES.find((p) => p.key === user.primaryProfile)?.tools.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="account" className="space-y-3 pt-4">
            <div>
              <Label className="text-xs">Profile photo</Label>
              <div className="mt-1 flex items-center gap-3">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full border border-neutral-200 object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                    <UserIcon className="h-7 w-7" />
                  </div>
                )}
                <PhotoUploader
                  value={avatar}
                  onChange={async (next) => {
                    setAvatar(next)
                    const url = (next && next[0]?.url) || null
                    const r = await fetch('/api/auth/profile', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ avatarUrl: url }),
                    })
                    const j = await r.json()
                    if (j.user) onUpdated?.(j.user)
                  }}
                  max={1}
                  label=""
                  hint="Square crop · ≤ 8 MB"
                  compact
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} className="bg-brand-600 hover:bg-brand-700">Save</Button>
              <Button variant="outline" onClick={onLogout}><LogOut className="mr-1 h-4 w-4" /> Log out</Button>
            </div>
          </TabsContent>
          <TabsContent value="favorites" className="space-y-2 pt-4">
            {favorites.map((f) => (
              <div key={f.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{f.name} {f.verified && <BadgeCheck className="inline h-4 w-4 text-brand-600" />}</div>
                    <div className="text-xs text-neutral-500">{f.type} · {f.address}</div>
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button size="sm" className="bg-brand-600 hover:bg-brand-700">
                      <Navigation className="mr-1 h-3 w-3" /> Go
                    </Button>
                  </a>
                </div>
              </div>
            ))}
            {!favorites.length && <div className="text-sm text-neutral-500">No favorites yet. Tap the heart on a facility.</div>}
          </TabsContent>
          <TabsContent value="alerts" className="space-y-2 pt-4">
            {contributions.alerts.map((a) => (
              <AlertCard key={a.id} alert={a} showFacilityName={false} onVote={() => {}} />
            ))}
            {!contributions.alerts.length && <div className="text-sm text-neutral-500">You haven&apos;t posted any alerts yet.</div>}
          </TabsContent>
          <TabsContent value="submissions" className="space-y-2 pt-4">
            {contributions.submissions.map((s) => (
              <div key={s.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-neutral-500">{s.type} · {s.address}</div>
                <Badge variant="outline" className="mt-1 text-xs">{s.status}</Badge>
              </div>
            ))}
            {!contributions.submissions.length && <div className="text-sm text-neutral-500">No facility submissions yet.</div>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
